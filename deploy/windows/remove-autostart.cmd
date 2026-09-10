@echo off
setlocal EnableExtensions
title MCAAS - QUITAR INICIO AUTOMATICO
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$startup=[Environment]::GetFolderPath('Startup'); $link=Join-Path $startup 'MCAAS CONTPAQI.lnk'; if(Test-Path $link){ Remove-Item $link -Force; Write-Host 'Inicio automatico eliminado.' -ForegroundColor Green } else { Write-Host 'No habia acceso directo de inicio automatico.' -ForegroundColor Yellow }"
echo.
pause
