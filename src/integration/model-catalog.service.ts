import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { AppConfigService } from '../config/config.service';
import type { ModelDefinition } from './model-definition';

@Injectable()
export class ModelCatalogService implements OnModuleInit {
  private readonly logger = new Logger(ModelCatalogService.name);
  private models: ModelDefinition[] = [];

  constructor(private readonly configService: AppConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    const path = this.configService.value.files.modelConfigPath;
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error('MODEL_CONFIG_PATH debe contener un arreglo JSON.');
    }

    const models = parsed.map((value, index) => this.validate(value, index));
    const keys = new Set<string>();

    for (const model of models) {
      if (keys.has(model.key)) {
        throw new Error(`Modelo duplicado en configuración: ${model.key}.`);
      }
      keys.add(model.key);
    }

    this.models = models;
    this.logger.log(`Catálogo cargado: ${models.length} modelo(s), ${models.filter((m) => m.enabled).length} habilitado(s).`);
  }

  getEnabled(): ModelDefinition[] {
    const allowlist = this.configService.value.sync.modelAllowlist;
    return this.models.filter(
      (model) => model.enabled && (allowlist.length === 0 || allowlist.includes(model.key)),
    );
  }

  getAll(): readonly ModelDefinition[] {
    return this.models;
  }

  resolveQueryPath(queryFile: string): string {
    const projectRoot = process.cwd();
    const fullPath = isAbsolute(queryFile) ? queryFile : resolve(projectRoot, queryFile);
    const rel = relative(projectRoot, fullPath);

    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(`queryFile debe permanecer dentro del directorio del proyecto: ${queryFile}.`);
    }

    return fullPath;
  }

  private validate(value: unknown, index: number): ModelDefinition {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Modelo #${index + 1} inválido.`);
    }

    const row = value as Record<string, unknown>;
    const stringField = (name: string): string => {
      const field = row[name];
      if (typeof field !== 'string' || !field.trim()) {
        throw new Error(`Modelo #${index + 1}: ${name} debe ser texto no vacío.`);
      }
      return field.trim();
    };

    const key = stringField('key');
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(key)) {
      throw new Error(`Modelo ${key}: key sólo puede usar minúsculas, números, _ y -.`);
    }

    if (typeof row.enabled !== 'boolean') {
      throw new Error(`Modelo ${key}: enabled debe ser boolean.`);
    }

    if (typeof row.schemaVersion !== 'number' || !Number.isInteger(row.schemaVersion) || row.schemaVersion < 1) {
      throw new Error(`Modelo ${key}: schemaVersion debe ser un entero >= 1.`);
    }

    const initialCursor = row.initialCursor;
    if (typeof initialCursor !== 'string' && typeof initialCursor !== 'number') {
      throw new Error(`Modelo ${key}: initialCursor debe ser string o number.`);
    }

    const destinationPath = stringField('destinationPath');
    if (/^https?:\/\//i.test(destinationPath)) {
      throw new Error(`Modelo ${key}: destinationPath debe ser una ruta relativa, no una URL completa.`);
    }
    if (destinationPath.includes('..') || destinationPath.includes('\\') || destinationPath.includes('?') || destinationPath.includes('#')) {
      throw new Error(`Modelo ${key}: destinationPath contiene segmentos no permitidos.`);
    }

    return {
      key,
      enabled: row.enabled,
      schemaVersion: row.schemaVersion,
      destinationPath,
      queryFile: stringField('queryFile'),
      cursorColumn: stringField('cursorColumn'),
      sourceIdColumn: stringField('sourceIdColumn'),
      initialCursor,
    };
  }
}
