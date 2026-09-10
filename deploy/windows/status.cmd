@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MCAAS - ESTADO
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root='%~dp0'; $pidFile=Join-Path $root 'data\mcaas-console.pid'; $checkpoint=Join-Path $root 'data\checkpoints.json'; Write-Host '============================================================' -ForegroundColor Cyan; Write-Host ' MCAAS - ESTADO DE CONSOLA' -ForegroundColor Cyan; Write-Host '============================================================' -ForegroundColor Cyan; if(Test-Path $pidFile){ $pText=(Get-Content $pidFile -Raw).Trim(); $parsedPid=0; if([int]::TryParse($pText,[ref]$parsedPid)){ $proc=Get-Process -Id $parsedPid -ErrorAction SilentlyContinue; if($proc){ Write-Host ('ACTIVO - host PID '+$parsedPid) -ForegroundColor Green } else { Write-Host ('PID '+$parsedPid+' no existe. El archivo es residual.') -ForegroundColor Yellow } } else { Write-Host 'PID invalido en data\mcaas-console.pid.' -ForegroundColor Yellow } } else { Write-Host 'NO ACTIVO - no existe PID del host.' -ForegroundColor Yellow }; Write-Host ''; if(Test-Path $checkpoint){ Write-Host 'Checkpoint actual:' -ForegroundColor Cyan; Get-Content $checkpoint } else { Write-Host 'No existe data\checkpoints.json.' -ForegroundColor Yellow }; Write-Host ''; Write-Host ('Logs: '+(Join-Path $root 'logs'))"
echo.
pause
