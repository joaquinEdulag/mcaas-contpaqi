import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { createPool, type Pool, type RowDataPacket } from 'mysql2/promise';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class MysqlService implements OnModuleDestroy {
  private readonly logger = new Logger(MysqlService.name);
  private readonly pool: Pool;

  constructor(private readonly configService: AppConfigService) {
    const config = configService.value.mysql;

    const ssl = config.ssl
      ? {
          ca: config.sslCaPath ? readFileSync(config.sslCaPath, 'utf8') : undefined,
          rejectUnauthorized: config.sslRejectUnauthorized,
        }
      : undefined;

    this.pool = createPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      connectionLimit: config.connectionLimit,
      connectTimeout: config.connectTimeoutMs,
      waitForConnections: true,
      queueLimit: 0,
      multipleStatements: false,
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: false,
      ssl,
    });
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1 AS ok');
  }

  async queryRows<T extends RowDataPacket = RowDataPacket>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const [rows] = await this.pool.query<T[]>(sql, [...params]);
    return rows;
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Cerrando pool MySQL.');
    await this.pool.end();
  }
}
