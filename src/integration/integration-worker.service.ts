import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { AppConfigService } from '../config/config.service';
import { SyncCoordinatorService } from './sync-coordinator.service';

@Injectable()
export class IntegrationWorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationWorkerService.name);
  private stopped = false;
  private disabledNoticeShown = false;
  private cycleNumber = 0;
  private readonly stopController = new AbortController();

  constructor(
    private readonly configService: AppConfigService,
    private readonly coordinatorService: SyncCoordinatorService,
  ) {}

  onApplicationBootstrap(): void {
    const config = this.configService.value.sync;
    this.logger.log(
      `Worker activo. enabled=${config.enabled}, intervalo=${config.intervalMs} ms, batchSize=${config.batchSize}, maxBatches=${config.maxBatchesPerCycle}.`,
    );
    void this.loop();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    this.stopController.abort();
    this.logger.log('Worker detenido.');
  }

  private async loop(): Promise<void> {
    const config = this.configService.value.sync;

    while (!this.stopped) {
      const startedAt = Date.now();
      this.cycleNumber += 1;

      if (!config.enabled) {
        if (!this.disabledNoticeShown) {
          this.logger.warn(
            'SYNC_ENABLED=false. El proceso está vivo, pero la extracción y el envío están desactivados.',
          );
          this.disabledNoticeShown = true;
        }
      } else {
        this.logger.log(`Ciclo #${this.cycleNumber}: buscando cambios.`);
        try {
          await this.coordinatorService.runCycle();
          this.logger.log(`Ciclo #${this.cycleNumber}: terminado en ${Date.now() - startedAt} ms.`);
        } catch (error) {
          this.logger.error(error instanceof Error ? error.stack ?? error.message : String(error));
        }
      }

      const elapsed = Date.now() - startedAt;
      const waitMs = Math.max(100, config.intervalMs - elapsed);
      this.logger.debug(`Próxima revisión en ${waitMs} ms.`);
      try {
        await delay(waitMs, undefined, { signal: this.stopController.signal });
      } catch (error) {
        if (this.stopped) return;
        throw error;
      }
    }
  }
}
