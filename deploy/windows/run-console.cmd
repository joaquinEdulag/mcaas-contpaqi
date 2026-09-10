@echo off
setlocal
cd /d "%~dp0"
title MCAAS - CONTPAQi Bridge

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-console.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================
if "%EXIT_CODE%"=="0" (
  echo MCAAS termino normalmente.
) else (
  echo MCAAS termino con error ^(codigo %EXIT_CODE%^).
  echo Los logs quedaron guardados en "%~dp0logs".
)
echo ============================================================
echo.
echo Presiona una tecla para cerrar esta ventana.
pause >nul
exit /b %EXIT_CODE%
