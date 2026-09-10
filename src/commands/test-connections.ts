import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { SqlServerService } from '../database/sqlserver.service';
import { DestinationApiService } from '../http/destination-api.service';
import { HttpModule } from '../http/http.module';

@Module({
  imports: [ConfigModule, DatabaseModule, HttpModule],
})
class DiagnosticsModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(DiagnosticsModule, {
    logger: ['error', 'warn'],
  });

  try {
    const sqlServer = app.get(SqlServerService);
    const destination = app.get(DestinationApiService);

    await sqlServer.ping();
    // eslint-disable-next-line no-console
    console.log('OK SQL Server: conexión y SELECT 1 correctos.');

    try {
      await destination.ping();
      // eslint-disable-next-line no-console
      console.log('OK HTTP/HTTPS: endpoint de health respondió 2xx.');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`ADVERTENCIA HTTP/HTTPS: ${error instanceof Error ? error.message : String(error)}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Prueba de conexiones falló:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
