MCAAS CONTPAQI - ARQUITECTURA DE CONSOLA FOREGROUND
===================================================

ESTE PAQUETE YA NO USA SERVICIOS DE WINDOWS NI WINSW.

ARCHIVO PRINCIPAL
-----------------
MCAAS.cmd
  Es el unico proceso que debes abrir para mantener el bridge activo.
  La misma ventana muestra todos los logs de NestJS, SQL Server, HTTP,
  lotes, cursores, reintentos y errores.

COMPORTAMIENTO
--------------
- La ventana CMD debe permanecer abierta.
- Si node.exe falla o termina, el host espera 5 segundos y lo reinicia.
- Si la configuracion .env es invalida, NO entra en un ciclo infinito:
  muestra el error y deja la CMD abierta.
- Solo se permite una consola MCAAS a la vez mediante un lock exclusivo.
- Cerrar la ventana CMD detiene MCAAS.
- No hay servicio oculto en segundo plano.

LOGS
----
logs\mcaas-AAAA-MM-DD.log  -> actividad de la aplicacion
logs\errors-AAAA-MM-DD.log -> errores de la aplicacion
logs\console-host.log      -> arranques, caidas y reinicios del host CMD

HERRAMIENTAS
------------
test-config.cmd       -> valida .env sin iniciar la sincronizacion
test-connections.cmd  -> prueba SQL Server y receiver HTTP
view-errors.cmd       -> sigue el ultimo archivo de errores en vivo
open-log-folder.cmd   -> abre la carpeta logs
reset-checkpoint.cmd  -> reinicia el cursor (usar con cuidado)
diagnostico.cmd       -> genera un reporte completo de diagnostico en logs

PRIMER ARRANQUE
---------------
1. Copia .env.example como .env si aun no existe.
2. Configura .env.
3. Ejecuta test-config.cmd.
4. Ejecuta test-connections.cmd.
5. Cuando las conexiones funcionen, usa SYNC_ENABLED=true.
6. Abre MCAAS.cmd y deja esa ventana abierta.

IMPORTANTE SOBRE LA BASE DE DATOS
---------------------------------
MCAAS solo LEE SQL Server/CONTPAQi. No hace INSERT/UPDATE/DELETE en la
base origen. Los cambios en la base destino los realiza el receiver HTTP.
La respuesta del receiver queda visible y registrada en logs.

INICIO AUTOMATICO OPCIONAL
--------------------------
install-autostart.cmd crea un acceso directo en la carpeta Inicio del
usuario actual. MCAAS se abrira como CMD visible al iniciar sesion.
remove-autostart.cmd elimina ese acceso directo.

Al ser una aplicacion visible, necesita una sesion interactiva de Windows.
Desconectar una sesion RDP no equivale a cerrar sesion; cerrar sesion si
puede terminar los procesos de ese usuario.
