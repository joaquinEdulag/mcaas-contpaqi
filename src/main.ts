import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  app.enableShutdownHooks();

  const logger = new Logger('Bootstrap');
  logger.log('MCAAS CONTPAQi Bridge iniciado.');
}

bootstrap().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[FATAL] No fue posible iniciar MCAAS CONTPAQi Bridge.', error);
  process.exitCode = 1;
});
