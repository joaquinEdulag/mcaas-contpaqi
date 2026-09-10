@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MCAAS - REINICIAR CHECKPOINT

echo ============================================================
echo  ADVERTENCIA: REINICIAR CURSOR DE SINCRONIZACION
echo ============================================================
echo Esto elimina data\checkpoints.json.
echo En el siguiente arranque MCAAS volvera al initialCursor configurado.
echo Puede reenviar registros que ya fueron procesados.
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$lock=Join-Path '%~dp0' 'data\mcaas-console.lock'; if(Test-Path $lock){ try { $f=[IO.File]::Open($lock,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None); $f.Dispose(); exit 0 } catch { exit 2 } } else { exit 0 }"
if "%ERRORLEVEL%"=="2" (
  echo ERROR: MCAAS esta ejecutandose.
  echo Cierra primero la ventana principal MCAAS.
  pause
  exit /b 2
)

set /p CONFIRM=Escribe REINICIAR para continuar: 
if /I not "%CONFIRM%"=="REINICIAR" (
  echo Cancelado.
  pause
  exit /b 1
)

if exist "data\checkpoints.json" (
  copy /Y "data\checkpoints.json" "data\checkpoints.backup.json" >nul
  del /Q "data\checkpoints.json"
  echo Checkpoint eliminado. Backup: data\checkpoints.backup.json
) else (
  echo No existia data\checkpoints.json. No hay nada que eliminar.
)
pause
