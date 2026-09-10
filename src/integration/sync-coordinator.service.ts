import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { AppConfigService } from '../config/config.service';
import { DestinationApiService, type OutboundBatch } from '../http/destination-api.service';
import { CheckpointService } from '../state/checkpoint.service';
import { GenericSqlModelService } from './generic-sql-model.service';
import { ModelCatalogService } from './model-catalog.service';
import type { ModelDefinition } from './model-definition';

@Injectable()
export class SyncCoordinatorService {
  private readonly logger = new Logger(SyncCoordinatorService.name);

  constructor(
    private readonly configService: AppConfigService,
    private readonly catalogService: ModelCatalogService,
    private readonly sqlModelService: GenericSqlModelService,
    private readonly destinationApiService: DestinationApiService,
    private readonly checkpointService: CheckpointService,
  ) {}

  async runCycle(): Promise<void> {
    const models = this.catalogService.getEnabled();

    if (models.length === 0) {
      this.logger.warn('No hay modelos habilitados para sincronizar.');
      return;
    }

    for (const model of models) {
      try {
        await this.syncModel(model);
      } catch (error) {
        this.logger.error(
          `Falló sincronización del modelo ${model.key}: ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
        );
      }
    }
  }

  private async syncModel(model: ModelDefinition): Promise<void> {
    const syncConfig = this.configService.value.sync;
    this.logger.log(`Modelo ${model.key}: iniciando revisión de cambios.`);

    for (let batchNumber = 1; batchNumber <= syncConfig.maxBatchesPerCycle; batchNumber += 1) {
      const checkpoint = await this.checkpointService.get(model.key, model.initialCursor);
      const records = await this.sqlModelService.fetchBatch(model, checkpoint.cursor, syncConfig.batchSize);

      if (records.length === 0) {
        if (batchNumber === 1) {
          this.logger.debug(`Modelo ${model.key}: sin registros nuevos.`);
        }
        return;
      }

      const firstCursor = records[0].cursor;
      const lastCursor = records[records.length - 1].cursor;
      const batchId = this.batchId(model.key, firstCursor, lastCursor, records.length);

      const batch: OutboundBatch = {
        source: this.configService.value.sourceSystem,
        instanceId: this.configService.value.instanceId,
        model: model.key,
        schemaVersion: model.schemaVersion,
        batchId,
        generatedAt: new Date().toISOString(),
        records,
      };

      this.logger.log(
        `Modelo ${model.key}: lote ${batchNumber}/${syncConfig.maxBatchesPerCycle} preparado. cursor ${String(firstCursor)} -> ${String(lastCursor)}, ${records.length} registro(s), batch=${batchId}.`,
      );

      // Este puente NO escribe en SQL Server/CONTPAQi. El cambio en la BD destino lo realiza el receiver HTTP.
      // El checkpoint local se avanza SOLAMENTE después de que el receiver confirme HTTP 2xx.
      await this.destinationApiService.postBatch(model.destinationPath, batch);
      await this.checkpointService.set(model.key, {
        cursor: lastCursor,
        lastBatchId: batchId,
        updatedAt: new Date().toISOString(),
      });

      this.logger.log(
        `Modelo ${model.key}: sincronización confirmada. ${records.length} registro(s) aceptado(s) por receiver, cursor local=${String(lastCursor)}, batch=${batchId}.`,
      );

      if (records.length < syncConfig.batchSize) return;
      if (syncConfig.pauseBetweenBatchesMs > 0) {
        this.logger.debug(
          `Modelo ${model.key}: pausa de ${syncConfig.pauseBetweenBatchesMs} ms antes del siguiente lote.`,
        );
        await delay(syncConfig.pauseBetweenBatchesMs);
      }
    }
  }

  private batchId(
    modelKey: string,
    firstCursor: string | number,
    lastCursor: string | number,
    count: number,
  ): string {
    const stableInput = [
      this.configService.value.instanceId,
      modelKey,
      String(firstCursor),
      String(lastCursor),
      String(count),
    ].join('|');

    const hash = createHash('sha256').update(stableInput).digest('hex').slice(0, 24);
    return `mcaas-${modelKey}-${hash}`;
  }
}
