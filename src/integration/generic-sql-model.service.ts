import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { SqlServerService, type SqlServerRow } from '../database/sqlserver.service';
import type { ModelDefinition } from './model-definition';
import { ModelCatalogService } from './model-catalog.service';

export interface SyncRecord {
  sourceId: string;
  cursor: string | number;
  data: Record<string, unknown>;
}

@Injectable()
export class GenericSqlModelService {
  private readonly logger = new Logger(GenericSqlModelService.name);
  private readonly sqlCache = new Map<string, string>();

  constructor(
    private readonly sqlServerService: SqlServerService,
    private readonly catalogService: ModelCatalogService,
  ) {}

  async fetchBatch(
    model: ModelDefinition,
    cursor: string | number,
    batchSize: number,
  ): Promise<SyncRecord[]> {
    const query = await this.getSql(model);
    this.logger.log(
      `Modelo ${model.key}: leyendo origen desde cursor ${String(cursor)} (máximo ${batchSize} registro(s)).`,
    );
    const rows = await this.sqlServerService.queryRows<SqlServerRow>(query, cursor, batchSize);

    const records = rows.map((row, index) => {
      const rawCursor = row[model.cursorColumn];
      const rawSourceId = row[model.sourceIdColumn];

      if (typeof rawCursor !== 'string' && typeof rawCursor !== 'number') {
        throw new Error(
          `Modelo ${model.key}, fila ${index + 1}: cursorColumn ${model.cursorColumn} no devolvió string/number.`,
        );
      }

      if (rawSourceId === null || rawSourceId === undefined) {
        throw new Error(
          `Modelo ${model.key}, fila ${index + 1}: sourceIdColumn ${model.sourceIdColumn} es null/undefined.`,
        );
      }

      return {
        sourceId: String(rawSourceId),
        cursor: rawCursor,
        data: { ...row },
      };
    });

    if (records.length > 0) {
      const summary = records.map((record) => `${record.sourceId}@${String(record.cursor)}`).join(', ');
      this.logger.log(`Modelo ${model.key}: filas detectadas [sourceId@cursor]: ${summary}.`);

      if (process.env.LOG_RECORD_PAYLOADS?.trim().toLowerCase() === 'true') {
        this.logger.debug(`Modelo ${model.key}: payload completo leído: ${JSON.stringify(records)}`);
      }
    }

    return records;
  }

  private async getSql(model: ModelDefinition): Promise<string> {
    const cached = this.sqlCache.get(model.key);
    if (cached) return cached;

    const queryPath = this.catalogService.resolveQueryPath(model.queryFile);
    const query = (await readFile(queryPath, 'utf8')).trim();
    const withoutLeadingComments = query
      .replace(/^(?:\s*--[^\n]*\n|\s*\/\*[\s\S]*?\*\/\s*)+/g, '')
      .trim();

    if (!/^(SELECT|WITH)\b/i.test(withoutLeadingComments)) {
      throw new Error(`La consulta de ${model.key} debe iniciar con SELECT o WITH.`);
    }

    const codeOnly = query
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    if (!/@cursor\b/i.test(codeOnly) || !/@batchSize\b/i.test(codeOnly)) {
      throw new Error(
        `La consulta de ${model.key} debe utilizar los parámetros @cursor y @batchSize.`,
      );
    }

    if (/\?(?!\?)/.test(codeOnly)) {
      throw new Error(
        `La consulta de ${model.key} todavía contiene parámetros ? de MySQL. Usa @cursor y @batchSize para SQL Server.`,
      );
    }

    this.sqlCache.set(model.key, query);
    this.logger.log(`Modelo ${model.key}: consulta SQL cargada desde ${queryPath}.`);
    return query;
  }
}
