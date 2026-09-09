import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type { RowDataPacket } from 'mysql2/promise';
import { MysqlService } from '../database/mysql.service';
import type { ModelDefinition } from './model-definition';
import { ModelCatalogService } from './model-catalog.service';

export interface SyncRecord {
  sourceId: string;
  cursor: string | number;
  data: Record<string, unknown>;
}

@Injectable()
export class GenericSqlModelService {
  private readonly sqlCache = new Map<string, string>();

  constructor(
    private readonly mysqlService: MysqlService,
    private readonly catalogService: ModelCatalogService,
  ) {}

  async fetchBatch(
    model: ModelDefinition,
    cursor: string | number,
    batchSize: number,
  ): Promise<SyncRecord[]> {
    const sql = await this.getSql(model);
    const rows = await this.mysqlService.queryRows<RowDataPacket>(sql, [cursor, batchSize]);

    return rows.map((row, index) => {
      const rawCursor = row[model.cursorColumn] as unknown;
      const rawSourceId = row[model.sourceIdColumn] as unknown;

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
  }

  private async getSql(model: ModelDefinition): Promise<string> {
    const cached = this.sqlCache.get(model.key);
    if (cached) return cached;

    const queryPath = this.catalogService.resolveQueryPath(model.queryFile);
    const sql = (await readFile(queryPath, 'utf8')).trim();
    const withoutLeadingComments = sql.replace(/^(?:\s*--[^\n]*\n|\s*\/\*[\s\S]*?\*\/\s*)+/g, '').trim();

    if (!/^(SELECT|WITH)\b/i.test(withoutLeadingComments)) {
      throw new Error(`La consulta de ${model.key} debe iniciar con SELECT o WITH.`);
    }

    const parameterCount = (sql.match(/\?/g) ?? []).length;
    if (parameterCount !== 2) {
      throw new Error(
        `La consulta de ${model.key} debe contener exactamente 2 parámetros ?: cursor y batchSize. Encontrados: ${parameterCount}.`,
      );
    }

    this.sqlCache.set(model.key, sql);
    return sql;
  }
}
