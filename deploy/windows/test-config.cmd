@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MCAAS - VALIDAR CONFIGURACION

echo ============================================================
echo  MCAAS - VALIDACION DE CONFIGURACION
echo ============================================================
if not exist "runtime\node.exe" (
  echo ERROR: no existe runtime\node.exe
  goto :fail
)
if not exist ".env" (
  echo ERROR: no existe .env
  goto :fail
)
if not exist "app\dist\commands\check-config.js" (
  echo ERROR: no existe app\dist\commands\check-config.js
  goto :fail
)

"runtime\node.exe" --env-file=".env" "app\dist\commands\check-config.js"
set "CODE=%ERRORLEVEL%"
echo.
if not "%CODE%"=="0" goto :failcode
echo CONFIGURACION CORRECTA.
goto :end

:fail
set "CODE=10"
goto :failcode

:failcode
echo VALIDACION FALLIDA. Codigo: %CODE%

:end
echo.
pause
exit /b %CODE%
