@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MCAAS CONTPAQI - CONSOLA PRINCIPAL

rem Esta es la unica entrada de ejecucion del bridge en Windows.
rem No instala ni inicia servicios de Windows.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0console-host.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================
echo  MCAAS: EL HOST DE CONSOLA TERMINO
echo  Codigo de salida: %EXIT_CODE%
echo  Revisa la carpeta: %~dp0logs
echo ============================================================
echo.
echo Esta ventana se mantendra abierta para poder revisar el fallo.
pause
exit /b %EXIT_CODE%
