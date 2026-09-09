# mcaas-contpaqi

Servicio/worker NestJS independiente para leer información desde una base MySQL asociada a CONTPAQi, convertirla en lotes JSON y enviarla por HTTP(S) a una API destino. Está pensado para ejecutarse en segundo plano como **Servicio de Windows**.

> Estado inicial seguro: `SYNC_ENABLED=false` y el modelo de ejemplo está deshabilitado. El servicio no extrae ni envía datos reales hasta que se configure explícitamente.

## Arquitectura

```text
CONTPAQi / MySQL
       |
       | SELECT (usuario de solo lectura)
       v
mcaas-contpaqi
NestJS standalone / Node.js
       |
       | JSON + HTTPS + Idempotency-Key
       v
API MCAAS / servidor destino
```

El proyecto no ejecuta migraciones sobre la fuente MySQL y `mysql2` se configura con `multipleStatements=false`. La protección principal contra escrituras accidentales debe estar también en MySQL: usa un usuario con **SELECT solamente**. El servicio Windows se instala con la cuenta integrada de bajo privilegio `NT AUTHORITY\LocalService`, no como LocalSystem.

## Versiones base

- Node.js: `24.20.0`
- pnpm: `11.24.0`
- NestJS: `12.0.1`
- MySQL2: `3.24.4`
- TypeScript: `7.0.2`
- WinSW: `2.12.0` estable

## Estructura

```text
.github/workflows/       CI y releases
config/                  catálogo de modelos a sincronizar
queries/                 consultas SELECT por modelo
deploy/windows/          WinSW y scripts de servicio
scripts/                 empaquetado y verificaciones
src/config/              validación de .env
src/database/            conexión MySQL
src/http/                cliente HTTP(S) con reintentos
src/state/               checkpoints persistentes
src/integration/         worker, catálogo, lotes e idempotencia
src/commands/            diagnósticos
```

## 1. Preparar el repositorio actual

Tu repositorio GitHub ya se llama `mcaas-contpaqi` y contiene únicamente un README. Descomprime el ZIP entregado por ChatGPT **dentro de la raíz de ese repositorio**, sustituyendo el README si Windows lo solicita. No borres la carpeta oculta `.git`.

Después abre PowerShell en la raíz:

```powershell
cd "C:\RUTA\A\mcaas-contpaqi"
```

## 2. Instalar dependencias de desarrollo

Requiere Node.js 24.20.0 y pnpm 11.24.0. Si Node 24 ya está instalado:

```powershell
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm --version
node --version
pnpm install
```

La primera ejecución de `pnpm install` generará `pnpm-lock.yaml` si todavía no existe. **Súbelo al repositorio** para fijar también las dependencias transitivas:

```powershell
git add pnpm-lock.yaml
git commit -m "chore: add pnpm lockfile"
```

## 3. Crear `.env`

```powershell
Copy-Item ".env.example" ".env"
notepad ".env"
```

Nunca subas `.env`. Ya está incluido en `.gitignore`.

Variables más importantes:

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=
MYSQL_USER=
MYSQL_PASSWORD=

DESTINATION_BASE_URL=https://servidor-destino
DESTINATION_AUTH_MODE=bearer
DESTINATION_API_TOKEN=

SYNC_ENABLED=false
```

`DESTINATION_AUTH_MODE` admite `bearer`, `api-key` o `none`. HTTP plano está bloqueado salvo que se defina expresamente `DESTINATION_ALLOW_INSECURE_HTTP=true`.

## 4. Validar, compilar y probar conexiones

Primero compila:

```powershell
pnpm typecheck
pnpm test
pnpm build
```

Valida `.env` sin mostrar secretos:

```powershell
pnpm config:check
```

Prueba MySQL con `SELECT 1` y, si existe `DESTINATION_HEALTH_PATH`, prueba la API:

```powershell
pnpm connections:test
```

Resultado esperado para MySQL:

```text
OK MySQL: conexión y SELECT 1 correctos.
```

## 5. Ejecutar en desarrollo

```powershell
pnpm start:dev
```

Con `SYNC_ENABLED=false` verás un aviso indicando que el proceso está vivo pero la sincronización está desactivada.

Para ejecutar el build:

```powershell
pnpm build
pnpm start:prod
```

## 6. Definir modelos reales de CONTPAQi

El motor incluido es genérico para modelos con **un cursor monotónico y único**. Primero adapta una consulta dentro de `queries/`.

Ejemplo:

```sql
SELECT
  CIDCLIENTEPROVEEDOR AS id,
  CCODIGOCLIENTE AS code,
  CRAZONSOCIAL AS legalName,
  CRFC AS rfc
FROM admClientes
WHERE CIDCLIENTEPROVEEDOR > ?
ORDER BY CIDCLIENTEPROVEEDOR ASC
LIMIT ?
```

La consulta debe cumplir:

1. Empezar con `SELECT` o `WITH`.
2. Tener exactamente dos parámetros `?`.
3. Primer `?`: cursor actual.
4. Segundo `?`: tamaño del lote.
5. Devolver la columna configurada como `cursorColumn`.
6. Devolver la columna configurada como `sourceIdColumn`.
7. Usar un cursor único y creciente.

Luego agrega/edita el modelo en `config/sync-models.json`:

```json
{
  "key": "customers",
  "enabled": true,
  "schemaVersion": 1,
  "destinationPath": "api/integrations/contpaqi/customers",
  "queryFile": "queries/customers.sql",
  "cursorColumn": "id",
  "sourceIdColumn": "id",
  "initialCursor": 0
}
```

Finalmente:

```dotenv
SYNC_ENABLED=true
SYNC_MODELS=customers
```

### Importante sobre actualizaciones

El adaptador genérico usa un único cursor. Si una tabla puede modificar registros ya enviados y necesitas detectar `UPDATE`, no uses ingenuamente sólo `id > último_id`. Para esos modelos conviene crear una estrategia específica con `fecha_modificacion + id`, CDC/binlog u otro cursor compuesto. El proyecto está preparado para añadir adaptadores específicos posteriormente.

## 7. JSON enviado

Cada POST usa un lote similar a:

```json
{
  "source": "CONTPAQI",
  "instanceId": "PC-CONTABILIDAD-01",
  "model": "customers",
  "schemaVersion": 1,
  "batchId": "mcaas-customers-...",
  "generatedAt": "2026-09-09T21:30:00.000Z",
  "records": [
    {
      "sourceId": "15",
      "cursor": 15,
      "data": {
        "id": 15,
        "code": "C00015"
      }
    }
  ]
}
```

El header `Idempotency-Key` contiene el mismo `batchId`. El ID del lote es determinista a partir de instancia, modelo, primer cursor, último cursor y cantidad. Si un timeout provoca que el mismo lote se reenvíe antes de avanzar el checkpoint, el receptor puede reconocerlo.

## 8. Checkpoints

Los checkpoints se guardan por defecto en:

```text
data/checkpoints.json
```

Orden garantizado por el worker:

```text
SELECT -> JSON -> POST -> HTTP 2xx -> guardar checkpoint
```

Nunca se avanza el checkpoint antes de recibir un HTTP satisfactorio.

## 9. Generar paquete Windows autocontenido

En Windows, desde la raíz del repo:

```powershell
pnpm build
.\scripts\package-windows.ps1 -Version v0.1.0 -SkipBuild
```

O dejando que el script compile:

```powershell
.\scripts\package-windows.ps1 -Version v0.1.0
```

Se generan:

```text
artifacts\mcaas-contpaqi-v0.1.0-win-x64.zip
artifacts\mcaas-contpaqi-v0.1.0-win-x64.zip.sha256
```

El empaquetador:

- compila NestJS;
- instala sólo dependencias de producción;
- descarga Node.js 24.20.0 para Windows x64;
- verifica el SHA-256 oficial de Node;
- descarga WinSW 2.12.0;
- verifica el SHA-256 fijado de WinSW;
- copia configuración, queries y scripts;
- genera el ZIP y su SHA-256.

El equipo donde se instala el servicio **no necesita Node.js ni pnpm instalados**.

## 10. Contenido del paquete de producción

```text
MCAASContpaqiBridge.exe
MCAASContpaqiBridge.xml
.env.example
VERSION
README.md
install-service.ps1
uninstall-service.ps1
start-service.ps1
stop-service.ps1
status-service.ps1
test-config.ps1
test-connections.ps1
update-service.ps1
app/
  dist/
  node_modules/
  package.json
runtime/
  node.exe
  ...
config/
queries/
data/
logs/
```

## 11. Instalar como Servicio de Windows

Descomprime el paquete, por ejemplo en:

```text
C:\MCAAS\CONTPAQiBridge
```

Abre PowerShell **como Administrador**:

```powershell
cd "C:\MCAAS\CONTPAQiBridge"
Get-ChildItem -Filter *.ps1 | Unblock-File
Copy-Item ".env.example" ".env"
notepad ".env"
```

Antes de instalar:

```powershell
.\test-config.ps1
.\test-connections.ps1
```

Instala:

```powershell
.\install-service.ps1
```

Resultado esperado:

```text
Status   Name                    DisplayName
------   ----                    -----------
Running  MCAASContpaqiBridge     MCAAS - CONTPAQi Bridge
```

También puedes verlo con:

```powershell
services.msc
```

## 12. Administrar el servicio

Estado:

```powershell
.\status-service.ps1
```

Detener:

```powershell
.\stop-service.ps1
```

Iniciar:

```powershell
.\start-service.ps1
```

Desinstalar:

```powershell
.\uninstall-service.ps1
```

La desinstalación no borra `.env`, `data` ni `logs`.

## 13. Actualizar una instalación

Descomprime una versión nueva en otra carpeta, por ejemplo:

```text
C:\MCAAS\Downloads\mcaas-contpaqi-v0.2.0-win-x64
```

Desde la instalación actual, PowerShell como Administrador:

```powershell
cd "C:\MCAAS\CONTPAQiBridge"
.\update-service.ps1 -NewPackageDirectory "C:\MCAAS\Downloads\mcaas-contpaqi-v0.2.0-win-x64"
```

El script preserva expresamente:

```text
.env
data\
logs\
```

## 14. GitHub Actions

### CI

`.github/workflows/ci.yml` se ejecuta en `push` a `main`/`develop` y en Pull Requests hacia `main`. Ejecuta:

```text
typecheck -> verificación -> build
```

### Release automático

`.github/workflows/release.yml` se ejecuta al publicar un tag `vX.Y.Z`.

Ejemplo:

```powershell
git add .
git commit -m "feat: initial contpaqi bridge"
git push origin main

git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions crea automáticamente un GitHub Release y adjunta:

```text
mcaas-contpaqi-v0.1.0-win-x64.zip
mcaas-contpaqi-v0.1.0-win-x64.zip.sha256
```

No se guardan credenciales MySQL/API en GitHub Actions ni en el ZIP.

## 15. Recomendaciones antes de activar producción

- Crear un usuario MySQL exclusivo para este servicio con `SELECT` solamente.
- Mantener el servicio bajo `NT AUTHORITY\LocalService`; usa otra cuenta sólo si una política de red concreta lo exige.
- Mantener `SYNC_ENABLED=false` hasta validar queries y endpoint.
- Usar HTTPS para la API destino.
- Implementar idempotencia del lado receptor usando `Idempotency-Key`.
- Probar primero con un único modelo y un lote pequeño.
- Respaldar `data/checkpoints.json` antes de cambios manuales de cursor.
- No copiar `.env` entre servidores sin revisar credenciales e `INSTANCE_ID`.
- Para tablas con modificaciones retroactivas, implementar cursor compuesto/estrategia específica.

## 16. Qué no hace este repo

Este repo está pensado para lectura MySQL + HTTP(S). Si una integración futura requiere invocar directamente un SDK nativo de CONTPAQi disponible sólo para .NET/COM, conviene agregar un componente/gateway .NET separado para esa responsabilidad en lugar de cargarla dentro del proceso Node.js.
