import 'reflect-metadata';
import { AppConfigService } from '../config/config.service';

function main(): void {
  const config = new AppConfigService();

  // eslint-disable-next-line no-console
  console.log('Configuración válida. Resumen sin secretos:');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(config.safeSummary(), null, 2));
}

try {
  main();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('Configuración inválida:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
