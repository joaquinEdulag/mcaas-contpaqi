@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MCAAS - DIAGNOSTICO COMPLETO
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0diagnostico.ps1"
echo.
echo Diagnostico terminado. Revisa la ruta mostrada arriba.
pause
