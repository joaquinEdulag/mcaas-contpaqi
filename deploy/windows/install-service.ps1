#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$ServiceName = 'MCAASContpaqiBridge'
$Wrapper = Join-Path $Root 'MCAASContpaqiBridge.exe'
$EnvFile = Join-Path $Root '.env'
$EnvExample = Join-Path $Root '.env.example'
$Node = Join-Path $Root 'runtime\node.exe'
$CheckConfig = Join-Path $Root 'app\dist\commands\check-config.js'

if (-not (Test-Path $Wrapper)) { throw "No existe $Wrapper" }
if (-not (Test-Path $Node)) { throw "No existe $Node" }

if (-not (Test-Path $EnvFile)) {
    Copy-Item $EnvExample $EnvFile
    Write-Host "Se creó $EnvFile a partir de .env.example." -ForegroundColor Yellow
    Write-Host 'Completa sus valores y vuelve a ejecutar este instalador.' -ForegroundColor Yellow
    exit 2
}

$Existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($Existing) {
    throw "El servicio $ServiceName ya existe. Usa update-service.ps1 para actualizar una instalación existente."
}

Write-Host 'Validando configuración...' -ForegroundColor Cyan
& $Node --env-file="$EnvFile" $CheckConfig
if ($LASTEXITCODE -ne 0) { throw 'La configuración .env no es válida.' }

New-Item -ItemType Directory -Force -Path (Join-Path $Root 'data') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Root 'logs') | Out-Null

# El servicio usa NT AUTHORITY\LocalService (SID S-1-5-19).
# Le damos lectura/ejecución a la aplicación y escritura sólo a data/logs.
& icacls $Root /grant:r '*S-1-5-19:(OI)(CI)(RX)' | Out-Null
& icacls (Join-Path $Root 'data') /grant:r '*S-1-5-19:(OI)(CI)(M)' | Out-Null
& icacls (Join-Path $Root 'logs') /grant:r '*S-1-5-19:(OI)(CI)(M)' | Out-Null

# Limita lectura del archivo de secretos a LocalService, SYSTEM y Administradores.
& icacls $EnvFile /inheritance:r | Out-Null
& icacls $EnvFile /grant:r '*S-1-5-19:(R)' '*S-1-5-18:(R)' '*S-1-5-32-544:(F)' | Out-Null

Write-Host 'Instalando servicio Windows...' -ForegroundColor Cyan
& $Wrapper install
if ($LASTEXITCODE -ne 0) { throw 'WinSW no pudo instalar el servicio.' }

& $Wrapper start
if ($LASTEXITCODE -ne 0) { throw 'El servicio se instaló, pero no pudo iniciar.' }

Start-Sleep -Seconds 2
Get-Service -Name $ServiceName | Format-Table Status, Name, DisplayName -AutoSize
Write-Host 'Instalación terminada.' -ForegroundColor Green
