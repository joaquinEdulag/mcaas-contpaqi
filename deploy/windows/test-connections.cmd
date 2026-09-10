@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MCAAS - PROBAR CONEXIONES

echo ============================================================
echo  MCAAS - PRUEBA SQL SERVER + RECEIVER
echo ============================================================
if not exist "runtime\node.exe" (
  echo ERROR: no existe runtime\node.exe
  set "CODE=10"
  goto :end
)
if not exist ".env" (
  echo ERROR: no existe .env
  set "CODE=10"
  goto :end
)
if not exist "app\dist\commands\test-connections.js" (
  echo ERROR: no existe app\dist\commands\test-connections.js
  set "CODE=10"
  goto :end
)

"runtime\node.exe" --env-file=".env" "app\dist\commands\test-connections.js"
set "CODE=%ERRORLEVEL%"

:end
echo.
echo Codigo de salida: %CODE%
echo Revisa tambien la carpeta logs si hubo errores.
pause
exit /b %CODE%
