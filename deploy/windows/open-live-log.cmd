@echo off
setlocal
cd /d "%~dp0"
title MCAAS - Log en vivo
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-live-log.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo El visor de logs termino con codigo %EXIT_CODE%.
  echo Presiona una tecla para cerrar esta ventana.
  pause >nul
)
exit /b %EXIT_CODE%
