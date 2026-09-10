export type DestinationAuthMode = 'bearer' | 'api-key' | 'none';

export interface AppConfig {
  appEnv: string;
  appName: string;
  instanceId: string;
  sourceSystem: string;
  sqlServer: {
    host: string;
    port?: number;
    instanceName?: string;
    database: string;
    user: string;
    password: string;
    poolMax: number;
    poolMin: number;
    poolIdleTimeoutMs: number;
    connectTimeoutMs: number;
    requestTimeoutMs: number;
    encrypt: boolean;
    trustServerCertificate: boolean;
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
