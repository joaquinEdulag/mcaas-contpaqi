@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MCAAS - ERRORES EN VIVO
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$d='%~dp0logs'; New-Item -ItemType Directory -Force -Path $d ^| Out-Null; Write-Host 'Buscando ultimo log de errores...' -ForegroundColor Cyan; while($true){ $f=Get-ChildItem -Path $d -Filter 'errors-*.log' -File -ErrorAction SilentlyContinue ^| Sort-Object LastWriteTime -Descending ^| Select-Object -First 1; if($f){ Write-Host ('Siguiendo: '+$f.FullName) -ForegroundColor Green; Get-Content -Path $f.FullName -Wait -Tail 100; break }; Write-Host 'Aun no existe un archivo de errores. Reintentando...' -ForegroundColor Yellow; Start-Sleep 2 }"
echo.
pause
