import { Injectable, Logger } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';
import { AppConfigService } from '../config/config.service';

export interface OutboundBatch {
  source: string;
  instanceId: string;
  model: string;
  schemaVersion: number;
  batchId: string;
  generatedAt: string;
  records: Array<{
    sourceId: string;
    cursor: string | number;
    data: Record<string, unknown>;
  }>;
}

@Injectable()
export class DestinationApiService {
  private readonly logger = new Logger(DestinationApiService.name);

  constructor(private readonly configService: AppConfigService) {}

  async ping(): Promise<void> {
    const healthPath = this.configService.value.destination.healthPath;
    if (!healthPath) {
      throw new Error('DESTINATION_HEALTH_PATH no está configurado; prueba HTTP omitida.');
    }

    const url = this.buildUrl(healthPath);
    this.logger.log(`Health HTTP GET ${url}.`);
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
      signal: AbortSignal.timeout(this.configService.value.destination.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Health HTTP respondió ${response.status} ${response.statusText}.`);
    }
    this.logger.log(`Health HTTP correcto: ${response.status} ${response.statusText}.`);
  }

  async postBatch(destinationPath: string, batch: OutboundBatch): Promise<void> {
    const config = this.configService.value.destination;
    const url = this.buildUrl(destinationPath);
    let lastError: unknown;

    for (let attempt = 1; attempt <= config.retryAttempts; attempt += 1) {
      let response: Response;
      const startedAt = Date.now();

      this.logger.log(
        `POST ${url} | modelo=${batch.model} | batch=${batch.batchId} | registros=${batch.records.length} | intento=${attempt}/${config.retryAttempts}.`,
      );

      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            ...this.headers(),
            'content-type': 'application/json',
            accept: 'application/json',
            'idempotency-key': batch.batchId,
          },
          body: JSON.stringify(batch),
          signal: AbortSignal.timeout(config.timeoutMs),
        });
      } catch (error) {
        lastError = error;
        this.logger.error(
          `Fallo de red enviando batch ${batch.batchId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (attempt === config.retryAttempts) throw error;
        await this.waitBeforeRetry(attempt, config.retryAttempts);
        continue;
      }

      const responseBody = (await response.text()).slice(0, 2000);
      const bodyInfo = responseBody ? ` | respuesta=${responseBody}` : '';

      if (response.ok) {
        this.logger.log(
          `Receiver confirmó batch ${batch.batchId}: HTTP ${response.status} ${response.statusText} en ${Date.now() - startedAt} ms${bodyInfo}.`,
        );
        return;
      }

      const error = new Error(`HTTP ${response.status} ${response.statusText}: ${responseBody}`);
      lastError = error;
      this.logger.error(
        `Receiver rechazó batch ${batch.batchId}: HTTP ${response.status} ${response.statusText}${bodyInfo}.`,
      );

      if (!this.isRetryableStatus(response.status) || attempt === config.retryAttempts) {
        throw error;
      }

      await this.waitBeforeRetry(attempt, config.retryAttempts);
    }

    throw lastError instanceof Error ? lastError : new Error('Error HTTP desconocido.');
  }

  private async waitBeforeRetry(attempt: number, maxAttempts: number): Promise<void> {
    const waitMs = this.configService.value.destination.retryBaseDelayMs * 2 ** (attempt - 1);
    this.logger.warn(`Envío fallido. Reintento ${attempt + 1}/${maxAttempts} en ${waitMs} ms.`);
    await delay(waitMs);
  }

  private headers(): Record<string, string> {
    const config = this.configService.value;
    const headers: Record<string, string> = {
      'user-agent': 'mcaas-contpaqi/0.2.0',
      'x-mcaas-source': config.sourceSystem,
      'x-mcaas-instance': config.instanceId,
    };

    if (config.destination.authMode === 'bearer' && config.destination.apiToken) {
      headers.authorization = `Bearer ${config.destination.apiToken}`;
    }

    if (config.destination.authMode === 'api-key' && config.destination.apiKey) {
      headers[config.destination.apiKeyHeader] = config.destination.apiKey;
    }

    return headers;
  }

  private buildUrl(path: string): string {
    const base = this.configService.value.destination.baseUrl.endsWith('/')
      ? this.configService.value.destination.baseUrl
      : `${this.configService.value.destination.baseUrl}/`;

    return new URL(path.replace(/^\/+/, ''), base).toString();
  }

  private isRetryableStatus(status: number): boolean {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }
}
