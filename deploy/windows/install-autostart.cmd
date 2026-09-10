@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MCAAS - ACTIVAR INICIO AUTOMATICO

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$target=Join-Path '%~dp0' 'MCAAS.cmd'; $startup=[Environment]::GetFolderPath('Startup'); $link=Join-Path $startup 'MCAAS CONTPAQI.lnk'; $shell=New-Object -ComObject WScript.Shell; $shortcut=$shell.CreateShortcut($link); $shortcut.TargetPath=$target; $shortcut.WorkingDirectory='%~dp0'; $shortcut.WindowStyle=1; $shortcut.Description='MCAAS CONTPAQI - consola foreground'; $shortcut.Save(); Write-Host ('Inicio automatico activado para este usuario: '+$link) -ForegroundColor Green; Write-Host 'MCAAS se abrira en una CMD visible cuando este usuario inicie sesion.' -ForegroundColor Cyan"

echo.
pause
