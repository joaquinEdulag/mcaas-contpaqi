import { Injectable } from '@nestjs/common';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { URL } from 'node:url';
import type { AppConfig, DestinationAuthMode } from './config.types';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable obligatoria ${name}.`);
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Falta la variable obligatoria ${name}.`);
  }
  return value;
}

function optionalSecret(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.length === 0 ? undefined : value;
}

function integer(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : fallback;

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max}.`);
  }

  return value;
}

function booleanValue(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} debe ser true o false.`);
}

function authMode(): DestinationAuthMode {
  const value = optional('DESTINATION_AUTH_MODE', 'bearer').toLowerCase();
  if (value !== 'bearer' && value !== 'api-key' && value !== 'none') {
    throw new Error('DESTINATION_AUTH_MODE debe ser bearer, api-key o none.');
  }
  return value;
}

@Injectable()
export class AppConfigService {
  readonly value: AppConfig;

  constructor() {
    const mode = authMode();
    const baseUrl = required('DESTINATION_BASE_URL');
    const allowInsecureHttp = booleanValue('DESTINATION_ALLOW_INSECURE_HTTP', false);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(baseUrl);
    } catch {
      throw new Error('DESTINATION_BASE_URL no es una URL válida.');
    }

    if (parsedUrl.protocol !== 'https:' && !(allowInsecureHttp && parsedUrl.protocol === 'http:')) {
      throw new Error(
        'DESTINATION_BASE_URL debe usar HTTPS. Para permitir HTTP explícitamente usa DESTINATION_ALLOW_INSECURE_HTTP=true.',
      );
    }

    if (mode === 'bearer' && !optionalSecret('DESTINATION_API_TOKEN')) {
      throw new Error('DESTINATION_API_TOKEN es obligatorio cuando DESTINATION_AUTH_MODE=bearer.');
    }

    if (mode === 'api-key' && !optionalSecret('DESTINATION_API_KEY')) {
      throw new Error('DESTINATION_API_KEY es obligatorio cuando DESTINATION_AUTH_MODE=api-key.');
    }

    const apiKeyHeader = optional('DESTINATION_API_KEY_HEADER', 'x-api-key');
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(apiKeyHeader)) {
      throw new Error('DESTINATION_API_KEY_HEADER no es un nombre de header HTTP válido.');
    }

    const instanceId = optional('INSTANCE_ID', hostname());
    const allowlist = optional('SYNC_MODELS')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    this.value = {
      appEnv: optional('APP_ENV', 'production'),
      appName: optional('APP_NAME', 'MCAAS CONTPAQi Bridge'),
      instanceId,
      sourceSystem: optional('SOURCE_SYSTEM', 'CONTPAQI'),
      mysql: {
        host: required('MYSQL_HOST'),
        port: integer('MYSQL_PORT', 3306, 1, 65535),
        database: required('MYSQL_DATABASE'),
        user: required('MYSQL_USER'),
        password: requiredSecret('MYSQL_PASSWORD'),
        connectionLimit: integer('MYSQL_CONNECTION_LIMIT', 5, 1, 50),
        connectTimeoutMs: integer('MYSQL_CONNECT_TIMEOUT_MS', 10000, 1000, 120000),
        ssl: booleanValue('MYSQL_SSL', false),
        sslCaPath: optional('MYSQL_SSL_CA_PATH') || undefined,
        sslRejectUnauthorized: booleanValue('MYSQL_SSL_REJECT_UNAUTHORIZED', true),
      },
      destination: {
        baseUrl: parsedUrl.toString(),
        healthPath: optional('DESTINATION_HEALTH_PATH') || undefined,
        authMode: mode,
        apiToken: optionalSecret('DESTINATION_API_TOKEN'),
        apiKey: optionalSecret('DESTINATION_API_KEY'),
        apiKeyHeader,
        allowInsecureHttp,
        timeoutMs: integer('HTTP_TIMEOUT_MS', 15000, 1000, 120000),
        retryAttempts: integer('HTTP_RETRY_ATTEMPTS', 3, 1, 10),
        retryBaseDelayMs: integer('HTTP_RETRY_BASE_DELAY_MS', 1000, 100, 60000),
      },
      sync: {
        enabled: booleanValue('SYNC_ENABLED', false),
        intervalMs: integer('SYNC_INTERVAL_MS', 30000, 1000, 86400000),
        batchSize: integer('SYNC_BATCH_SIZE', 100, 1, 5000),
        maxBatchesPerCycle: integer('SYNC_MAX_BATCHES_PER_CYCLE', 10, 1, 1000),
        pauseBetweenBatchesMs: integer('SYNC_PAUSE_BETWEEN_BATCHES_MS', 250, 0, 60000),
        modelAllowlist: allowlist,
      },
      files: {
        modelConfigPath: resolve(optional('MODEL_CONFIG_PATH', './config/sync-models.json')),
        checkpointPath: resolve(optional('CHECKPOINT_PATH', './data/checkpoints.json')),
      },
    };
  }

  public safeSummary(): Record<string, unknown> {
    const config = this.value;
    return {
      appEnv: config.appEnv,
      appName: config.appName,
      instanceId: config.instanceId,
      sourceSystem: config.sourceSystem,
      mysql: {
        host: config.mysql.host,
        port: config.mysql.port,
        database: config.mysql.database,
        user: config.mysql.user,
        password: '***',
        ssl: config.mysql.ssl,
      },
      destination: {
        baseUrl: config.destination.baseUrl,
        healthPath: config.destination.healthPath,
        authMode: config.destination.authMode,
        credential: config.destination.authMode === 'none' ? 'none' : '***',
      },
      sync: config.sync,
      files: config.files,
    };
  }
}
