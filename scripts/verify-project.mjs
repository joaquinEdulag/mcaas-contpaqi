import { access, readFile, readdir } from 'node:fs/promises';

const requiredFiles = [
  '.env.example',
  'config/sync-models.json',
  'queries/employees.sql',
  'scripts/package-windows.ps1',
  'src/main.ts',
  'src/app.module.ts',
  'src/database/sqlserver.service.ts',
  'src/logging/persistent-logger.ts',
  'deploy/windows/MCAAS.cmd',
  'deploy/windows/console-host.ps1',
  'deploy/windows/test-config.cmd',
  'deploy/windows/test-connections.cmd',
  'deploy/windows/status.cmd',
  'deploy/windows/view-errors.cmd',
  'deploy/windows/open-log-folder.cmd',
  'deploy/windows/reset-checkpoint.cmd',
  'deploy/windows/README-WINDOWS.txt',
  'deploy/windows/install-autostart.cmd',
  'deploy/windows/remove-autostart.cmd',
  'deploy/windows/diagnostico.cmd',
  'deploy/windows/diagnostico.ps1',
];

for (const file of requiredFiles) await access(file);

const windowsFiles = await readdir('deploy/windows');
for (const forbidden of [
  'MCAASContpaqiBridge.xml',
  'install-service.ps1',
  'uninstall-service.ps1',
  'start-service.ps1',
  'stop-service.ps1',
  'status-service.ps1',
  'update-service.ps1',
]) {
  if (windowsFiles.includes(forbidden)) {
    throw new Error(`La arquitectura de consola no debe contener ${forbidden}.`);
  }
}

const tsconfig = JSON.parse(await readFile('tsconfig.json', 'utf8'));
const configuredTypes = tsconfig?.compilerOptions?.types;
if (!Array.isArray(configuredTypes) || !configuredTypes.includes('node')) {
  throw new Error('tsconfig.json debe declarar compilerOptions.types = ["node"].');
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
if (!packageJson?.dependencies?.mssql) {
  throw new Error('package.json debe incluir mssql en dependencies.');
}
if (packageJson?.dependencies?.mysql2) {
  throw new Error('mysql2 no debe permanecer como fuente en esta versión SQL Server.');
}
if (!packageJson?.devDependencies?.['@types/mssql']) {
  throw new Error('package.json debe incluir @types/mssql en devDependencies.');
}
if (!packageJson?.devDependencies?.['@types/node']) {
  throw new Error('package.json debe incluir @types/node en devDependencies.');
}

const models = JSON.parse(await readFile('config/sync-models.json', 'utf8'));
if (!Array.isArray(models) || !models.some((model) => model?.key === 'employees')) {
  throw new Error('config/sync-models.json debe contener el modelo employees.');
}

const query = await readFile('queries/employees.sql', 'utf8');
for (const token of ['dbo.nom10001', '@cursor', '@batchSize', 'numero_empleado']) {
  if (!query.toLowerCase().includes(token.toLowerCase())) {
    throw new Error(`queries/employees.sql no contiene ${token}.`);
  }
}

const env = await readFile('.env.example', 'utf8');
for (const key of [
  'SQLSERVER_HOST=',
  'SQLSERVER_INSTANCE=',
  'SQLSERVER_DATABASE=',
  'SQLSERVER_USER=',
  'DESTINATION_BASE_URL=',
  'SYNC_ENABLED=',
  'SYNC_MODELS=employees',
  'LOG_DIRECTORY=',
]) {
  if (!env.includes(key)) throw new Error(`.env.example no contiene ${key}`);
}

const packageScript = await readFile('scripts/package-windows.ps1', 'utf8');
for (const token of [
  "deploy\\windows\\*",
  'runtime',
  'node-v',
  'No WinSW',
  'MCAAS.cmd',
]) {
  if (!packageScript.includes(token)) {
    throw new Error(`scripts/package-windows.ps1 no contiene ${token}.`);
  }
}
for (const forbidden of ['WinSW-x64.exe', 'MCAASContpaqiBridge.exe', 'install-service.ps1']) {
  if (packageScript.includes(forbidden)) {
    throw new Error(`El empaquetado de consola no debe depender de ${forbidden}.`);
  }
}

const host = await readFile('deploy/windows/console-host.ps1', 'utf8');
for (const token of [
  'mcaas-console.lock',
  'console-host.log',
  'while ($true)',
  'runtime\\node.exe',
  'check-config.js',
]) {
  if (!host.includes(token)) throw new Error(`console-host.ps1 no contiene ${token}.`);
}

const loggerSource = await readFile('src/logging/persistent-logger.ts', 'utf8');
for (const token of ["dailyPath('mcaas')", "dailyPath('errors')", 'LOG_DIRECTORY']) {
  if (!loggerSource.includes(token)) throw new Error(`Logger persistente no contiene ${token}.`);
}

console.log('OK: MCAAS 0.3.0 usa arquitectura foreground con CMD persistente, reinicio automatico y sin WinSW.');
