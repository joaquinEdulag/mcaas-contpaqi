export type DestinationAuthMode = 'bearer' | 'api-key' | 'none';

export interface AppConfig {
  appEnv: string;
  appName: string;
  instanceId: string;
  sourceSystem: string;
  mysql: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    connectionLimit: number;
    connectTimeoutMs: number;
    ssl: boolean;
    sslCaPath?: string;
    sslRejectUnauthorized: boolean;
  };
  destination: {
    baseUrl: string;
    healthPath?: string;
    authMode: DestinationAuthMode;
    apiToken?: string;
    apiKey?: string;
    apiKeyHeader: string;
    allowInsecureHttp: boolean;
    timeoutMs: number;
    retryAttempts: number;
    retryBaseDelayMs: number;
  };
  sync: {
    enabled: boolean;
    intervalMs: number;
    batchSize: number;
    maxBatchesPerCycle: number;
    pauseBetweenBatchesMs: number;
    modelAllowlist: string[];
  };
  files: {
    modelConfigPath: string;
    checkpointPath: string;
  };
}
