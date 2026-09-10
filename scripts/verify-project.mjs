import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  '.env.example',
  'config/sync-models.json',
  'queries/employees.sql',
  'deploy/windows/MCAASContpaqiBridge.xml',
  'deploy/windows/install-service.ps1',
  'scripts/package-windows.ps1',
  'src/main.ts',
  'src/app.module.ts',
  'src/database/sqlserver.service.ts',
];

for (const file of requiredFiles) await access(file);

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
]) {
  if (!env.includes(key)) throw new Error(`.env.example no contiene ${key}`);
}

console.log('OK: proyecto SQL Server/CONTPAQi Empleados verificado.');
