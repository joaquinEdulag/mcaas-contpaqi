import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  '.env.example',
  'config/sync-models.json',
  'deploy/windows/MCAASContpaqiBridge.xml',
  'deploy/windows/install-service.ps1',
  'scripts/package-windows.ps1',
  'src/main.ts',
  'src/app.module.ts',
];

for (const file of requiredFiles) {
  await access(file);
}


const tsconfig = JSON.parse(await readFile('tsconfig.json', 'utf8'));
const configuredTypes = tsconfig?.compilerOptions?.types;
if (!Array.isArray(configuredTypes) || !configuredTypes.includes('node')) {
  throw new Error('tsconfig.json debe declarar compilerOptions.types = ["node"].');
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
if (!packageJson?.devDependencies?.['@types/node']) {
  throw new Error('package.json debe incluir @types/node en devDependencies.');
}

const typescriptVersion = packageJson?.devDependencies?.typescript;
if (!typescriptVersion) {
  throw new Error('package.json debe incluir TypeScript en devDependencies.');
}

const typescriptMajor = Number(String(typescriptVersion).replace(/^[^0-9]*/, '').split('.')[0]);
if (!Number.isInteger(typescriptMajor) || typescriptMajor > 6) {
  throw new Error(
    `TypeScript ${typescriptVersion} no es compatible con el compilador programático usado por Nest CLI 12. Usa TypeScript 6.x.`,
  );
}

const models = JSON.parse(await readFile('config/sync-models.json', 'utf8'));
if (!Array.isArray(models)) {
  throw new Error('config/sync-models.json no contiene un arreglo.');
}

const env = await readFile('.env.example', 'utf8');
for (const key of ['MYSQL_HOST=', 'DESTINATION_BASE_URL=', 'SYNC_ENABLED=']) {
  if (!env.includes(key)) throw new Error(`.env.example no contiene ${key}`);
}

console.log('OK: estructura base del proyecto verificada.');
