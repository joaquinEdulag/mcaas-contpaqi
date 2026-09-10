# MCAAS CONTPAQi Bridge — Consola persistente Windows

Esta versión lee empleados desde **SQL Server / CONTPAQi Nóminas** (`dbo.nom10001`) y envía lotes JSON por HTTP/HTTPS al receiver del ERP EDULAG.

## Arquitectura actual

A partir de la versión `0.3.0` **ya no se instala ni se ejecuta como servicio de Windows**. Se eliminó WinSW y toda la administración mediante Service Control Manager.

En Windows, MCAAS funciona como un proceso **foreground** administrado por una CMD visible y persistente:

```text
MCAAS.cmd
   └─ console-host.ps1
       ├─ valida .env
       ├─ mantiene un lock de instancia única
       ├─ ejecuta runtime\node.exe
       │    └─ app\dist\main.js (NestJS)
       ├─ muestra stdout/stderr en la misma CMD
       ├─ registra caídas en logs\console-host.log
       └─ reinicia Node automáticamente si termina o falla
```

Mientras la ventana `MCAAS.cmd` permanezca abierta, el bridge permanece administrado desde esa terminal. **Cerrar la ventana detiene MCAAS.**

## Qué se ve en la terminal

La consola muestra en tiempo real:

- arranque y configuración del proceso;
- conexión a SQL Server / CONTPAQi;
- carga de consultas SQL;
- cursor y checkpoint actual;
- número de filas leídas;
- IDs/cursor de registros encontrados;
- lotes generados;
- POST enviados al receiver;
- respuesta HTTP del receiver;
- reintentos;
- actualización del checkpoint;
- excepciones, errores de red y errores SQL;
- caída y reinicio automático del proceso Node.

El bridge **no escribe en SQL Server/CONTPAQi**. La base origen se usa en modo lectura. Los INSERT/UPDATE de la base destino corresponden al receiver HTTP.

## Logs persistentes

Dentro de la misma carpeta de ejecución:

```text
logs\mcaas-AAAA-MM-DD.log   actividad general
logs\errors-AAAA-MM-DD.log errores de aplicación
logs\console-host.log       arranques, cierres, fallos y reinicios del host CMD
```

El contenido completo de registros está desactivado por defecto. Para pruebas controladas:

```env
LOG_RECORD_PAYLOADS=true
```

Después conviene volverlo a `false` para no conservar datos personales innecesariamente.

## Construcción local

Necesitas Node/pnpm únicamente en la PC donde construyes el paquete:

```powershell
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --no-frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

Para generar el paquete portable de Windows:

```powershell
pnpm package:windows
```

El paquete incluye su propio `runtime\node.exe`, por lo que **el servidor Windows de pruebas no necesita Node.js instalado**.

Si quieres generar un ZIP privado que además copie el `.env` actual:

```powershell
pnpm package:windows:configured
```

Ese ZIP puede contener credenciales y no debe publicarse ni subirse a repositorios.

## Uso en el servidor Windows

1. Extrae el ZIP generado.
2. Si no incluiste `.env`, copia `.env.example` como `.env` y configúralo.
3. Ejecuta `test-config.cmd`.
4. Ejecuta `test-connections.cmd`.
5. Deja `SYNC_ENABLED=true` cuando las pruebas sean correctas.
6. Abre **`MCAAS.cmd`**.
7. No cierres esa CMD mientras quieras que el bridge siga activo.

No hay `install-service`, `start-service`, WinSW ni procesos administrados por Windows Services.

## Herramientas de diagnóstico

- `MCAAS.cmd`: inicia y mantiene el bridge.
- `status.cmd`: muestra estado del host y checkpoint actual.
- `test-config.cmd`: valida `.env` sin iniciar la sincronización.
- `test-connections.cmd`: prueba SQL Server y receiver.
- `view-errors.cmd`: sigue el archivo de errores más reciente.
- `open-log-folder.cmd`: abre la carpeta de logs.
- `reset-checkpoint.cmd`: elimina el checkpoint después de confirmación explícita.
- `diagnostico.cmd`: ejecuta revisión de archivos, versión de Node, configuración, conexiones, checkpoint y últimos errores; guarda todo en `logs\diagnostico-*.txt`.

## Repetir sincronización desde el cursor inicial

Cierra primero `MCAAS.cmd` y luego ejecuta `reset-checkpoint.cmd`. Se crea un backup y se elimina `data\checkpoints.json`. En el siguiente arranque se usará el `initialCursor` configurado.

## Configuración principal

Consulta `.env.example`. Para CONTPAQi normalmente:

- `SQLSERVER_HOST`: IP/host del SQL Server.
- `SQLSERVER_INSTANCE=COMPAC` si utiliza instancia nombrada.
- `SQLSERVER_DATABASE`: nombre real de la base donde existe `dbo.nom10001`.
- `SQLSERVER_USER` / `SQLSERVER_PASSWORD`: credenciales de solo lectura.
- `DESTINATION_BASE_URL`: URL del receiver.
- `SYNC_MODELS=employees`.

`edulag_pruebas` es una base del lado receptor y **no** debe usarse como `SQLSERVER_DATABASE` salvo que realmente sea la base SQL Server que contiene `dbo.nom10001`.
