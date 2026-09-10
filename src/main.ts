import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PersistentLogger } from './logging/persistent-logger';

const persistentLogger = new PersistentLogger();
Logger.overrideLogger(persistentLogger);

function describeError(error: unknown): string {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}

process.on('unhandledRejection', (reason) => {
  persistentLogger.error(`Promesa rechazada sin manejar: ${describeError(reason)}`, 'Process');
});

process.on('uncaughtException', (error) => {
  persistentLogger.fatal(`Excepción no controlada: ${describeError(error)}`, 'Process');
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  persistentLogger.log(`Directorio de ejecución: ${process.cwd()}`, 'Bootstrap');
  persistentLogger.log(`Logs persistentes: ${persistentLogger.directory}`, 'Bootstrap');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: persistentLogger,
  });

  app.enableShutdownHooks();

  const logger = new Logger('Bootstrap');
  logger.log('MCAAS CONTPAQi Bridge iniciado y ejecutándose. Presiona Ctrl+C para detenerlo.');
}

bootstrap().catch((error: unknown) => {
  persistentLogger.fatal(
    `No fue posible iniciar MCAAS CONTPAQi Bridge: ${describeError(error)}`,
    'Bootstrap',
  );
  process.exitCode = 1;
});
