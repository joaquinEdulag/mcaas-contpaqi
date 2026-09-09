import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { MysqlService } from '../database/mysql.service';
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
    const mysql = app.get(MysqlService);
    const destination = app.get(DestinationApiService);

    await mysql.ping();
    // eslint-disable-next-line no-console
    console.log('OK MySQL: conexión y SELECT 1 correctos.');

    try {
      await destination.ping();
      // eslint-disable-next-line no-console
      console.log('OK HTTP: endpoint de health respondió 2xx.');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`ADVERTENCIA HTTP: ${error instanceof Error ? error.message : String(error)}`);
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
