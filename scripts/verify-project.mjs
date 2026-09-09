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

const models = JSON.parse(await readFile('config/sync-models.json', 'utf8'));
if (!Array.isArray(models)) {
  throw new Error('config/sync-models.json no contiene un arreglo.');
}

const env = await readFile('.env.example', 'utf8');
for (const key of ['MYSQL_HOST=', 'DESTINATION_BASE_URL=', 'SYNC_ENABLED=']) {
  if (!env.includes(key)) throw new Error(`.env.example no contiene ${key}`);
}

console.log('OK: estructura base del proyecto verificada.');
