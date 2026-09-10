# MCAAS CONTPAQi Bridge - Empleados / SQL Server

Esta variante lee empleados desde **SQL Server / CONTPAQi Nóminas** (`dbo.nom10001`) y envía lotes JSON por HTTP/HTTPS al receiver del ERP EDULAG.

## Antes de iniciar

Debes conocer:

1. La PC/IP donde está SQL Server.
2. La instancia (`COMPAC`).
3. El **nombre de la base de datos** donde existe `dbo.nom10001`.
4. Usuario y contraseña de solo lectura.
5. La URL del receiver.

`edulag_pruebas` es la base MySQL/Aiven del receiver; NO se configura como `SQLSERVER_DATABASE`.

## Instalación local

```powershell
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --no-frozen-lockfile
Copy-Item .env.example .env
notepad .env
pnpm typecheck
pnpm test
pnpm build
pnpm config:check
pnpm connections:test
```

Mantén `SYNC_ENABLED=false` hasta que `connections:test` indique que SQL Server y el receiver responden correctamente.

Después cambia en `.env`:

```env
SYNC_ENABLED=true
SYNC_BATCH_SIZE=5
SYNC_MAX_BATCHES_PER_CYCLE=1
```

y ejecuta:

```powershell
pnpm start:dev
```

## Consulta de empleados

La consulta está en `queries/employees.sql`. Usa `IdEmpleado` como cursor técnico y `CodigoEmpleado` como `numero_empleado` para el vínculo de negocio con EDULAG/Entra.

## Repetir una prueba desde cero

Detén el servicio y elimina `data/checkpoints.json`. Al iniciar otra vez comenzará desde `initialCursor: 0`.

## Importante

Esta primera versión prueba la carga de los campos solicitados de `nom10001`. No crea periodos laborales ni asignaciones de puesto en el ERP porque para eso aún se deben incorporar `FechaAlta`, `FechaBaja`, `EstadoEmpleado` y resolver los catálogos de puesto/departamento del ERP.
