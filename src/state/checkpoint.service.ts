import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { AppConfigService } from '../config/config.service';

export interface ModelCheckpoint {
  cursor: string | number;
  lastBatchId?: string;
  updatedAt?: string;
}

interface CheckpointFile {
  version: 1;
  models: Record<string, ModelCheckpoint>;
}

@Injectable()
export class CheckpointService {
  private readonly logger = new Logger(CheckpointService.name);
  private cache?: CheckpointFile;

  constructor(private readonly configService: AppConfigService) {}

  async get(modelKey: string, initialCursor: string | number): Promise<ModelCheckpoint> {
    const state = await this.load();
    const checkpoint = state.models[modelKey] ?? { cursor: initialCursor };
    this.logger.debug(
      `Checkpoint ${modelKey}: cursor=${String(checkpoint.cursor)}${checkpoint.lastBatchId ? `, lastBatchId=${checkpoint.lastBatchId}` : ''}.`,
    );
    return checkpoint;
  }

  async set(modelKey: string, checkpoint: ModelCheckpoint): Promise<void> {
    const state = await this.load();
    state.models[modelKey] = checkpoint;
    await this.persist(state);
    this.logger.log(
      `Checkpoint actualizado para ${modelKey}: cursor=${String(checkpoint.cursor)}, batch=${checkpoint.lastBatchId ?? '(sin batch)'}.`,
    );
  }

  private async load(): Promise<CheckpointFile> {
    if (this.cache) return this.cache;

    const path = this.configService.value.files.checkpointPath;

    try {
      const raw = await readFile(path, 'utf8');
      const parsed = JSON.parse(raw) as CheckpointFile;
      if (parsed.version !== 1 || typeof parsed.models !== 'object' || parsed.models === null) {
        throw new Error('Formato de checkpoint inválido.');
      }
      this.cache = parsed;
      this.logger.log(`Estado de sincronización cargado desde ${path}.`);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw error;
      this.cache = { version: 1, models: {} };
      this.logger.warn(`No existe ${path}; se iniciará con los cursores iniciales configurados.`);
    }

    return this.cache;
  }

  private async persist(state: CheckpointFile): Promise<void> {
    const path = this.configService.value.files.checkpointPath;
    const directory = dirname(path);
    const temporaryPath = `${path}.tmp`;

    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, path);
    this.cache = state;
    this.logger.debug(`Estado persistido en ${path}.`);
  }
}
