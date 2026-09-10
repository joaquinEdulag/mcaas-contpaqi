import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import sql from 'mssql';
import { AppConfigService } from '../config/config.service';

export type SqlServerRow = Record<string, unknown>;

@Injectable()
export class SqlServerService implements OnModuleDestroy {
  private readonly logger = new Logger(SqlServerService.name);
  private readonly pool: sql.ConnectionPool;
  private connectionPromise?: Promise<sql.ConnectionPool>;

  constructor(private readonly configService: AppConfigService) {
    const config = configService.value.sqlServer;

    const connectionConfig: sql.config = {
      server: config.host,
      database: config.database,
      user: config.user,
      password: config.password,
      connectionTimeout: config.connectTimeoutMs,
      requestTimeout: config.requestTimeoutMs,
      pool: {
        max: config.poolMax,
        min: config.poolMin,
        idleTimeoutMillis: config.poolIdleTimeoutMs,
      },
      options: {
        encrypt: config.encrypt,
        trustServerCertificate: config.trustServerCertificate,
        ...(config.instanceName ? { instanceName: config.instanceName } : {}),
      },
      ...(config.port ? { port: config.port } : {}),
    };

    this.pool = new sql.ConnectionPool(connectionConfig);
  }

  async ping(): Promise<void> {
    const startedAt = Date.now();
    this.logger.log('Probando conexión SQL Server con SELECT 1.');
    const pool = await this.getPool();
    await pool.request().query('SELECT 1 AS ok');
    this.logger.log(`SQL Server respondió correctamente en ${Date.now() - startedAt} ms.`);
  }

  async queryRows<T extends SqlServerRow = SqlServerRow>(
    query: string,
    cursor: string | number,
    batchSize: number,
  ): Promise<T[]> {
    const pool = await this.getPool();
    const request = pool.request();

    const numericCursor = Number(cursor);
    if (!Number.isSafeInteger(numericCursor) || numericCursor < 0) {
      throw new Error(`El cursor debe ser un entero >= 0. Recibido: ${String(cursor)}.`);
    }

    request.input('cursor', sql.BigInt, numericCursor);
    request.input('batchSize', sql.Int, batchSize);

    const startedAt = Date.now();
    this.logger.log(
      `Consulta SQL Server iniciada. cursor=${numericCursor}, batchSize=${batchSize}. La base origen es de solo lectura para este puente.`,
    );
    const result = await request.query<T>(query);
    this.logger.log(
      `Consulta SQL Server terminada: ${result.recordset.length} fila(s) leída(s) en ${Date.now() - startedAt} ms.`,
    );
    return result.recordset;
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Cerrando conexión SQL Server.');
    if (this.connectionPromise) {
      try {
        await this.connectionPromise;
      } catch {
        // Si la conexión nunca abrió, close() no es necesario.
      }
    }
    if (this.pool.connected || this.pool.connecting) {
      await this.pool.close();
    }
  }

  private async getPool(): Promise<sql.ConnectionPool> {
    if (!this.connectionPromise) {
      const config = this.configService.value.sqlServer;
      const target = config.instanceName
        ? `${config.host}\\${config.instanceName}`
        : `${config.host}${config.port ? `:${config.port}` : ''}`;
      this.logger.log(`Abriendo conexión SQL Server a ${target}, base=${config.database}.`);

      this.connectionPromise = this.pool
        .connect()
        .then((pool) => {
          this.logger.log('Conexión SQL Server establecida.');
          return pool;
        })
        .catch((error: unknown) => {
          this.connectionPromise = undefined;
          this.logger.error(
            `Falló la conexión SQL Server: ${error instanceof Error ? error.message : String(error)}`,
          );
          throw error;
        });
    }
    return this.connectionPromise;
  }
}
