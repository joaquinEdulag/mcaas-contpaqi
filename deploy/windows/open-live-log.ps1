$ErrorActionPreference = 'Stop'
$Logs = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $Logs | Out-Null

$Latest = Get-ChildItem -Path $Logs -Filter 'mcaas-*.log' -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $Latest) {
    Write-Host "Todavia no existe un log de aplicacion en $Logs" -ForegroundColor Yellow
    exit 1
}

Write-Host "Siguiendo log en vivo: $($Latest.FullName)" -ForegroundColor Cyan
Write-Host 'Ctrl+C para dejar de seguirlo.' -ForegroundColor Yellow
Get-Content -Path $Latest.FullName -Wait -Tail 100
