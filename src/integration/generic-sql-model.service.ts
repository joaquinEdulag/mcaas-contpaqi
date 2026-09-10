import { Injectable } from '@nestjs/common';
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
    const rows = await this.sqlServerService.queryRows<SqlServerRow>(query, cursor, batchSize);

    return rows.map((row, index) => {
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
    return query;
  }
}
