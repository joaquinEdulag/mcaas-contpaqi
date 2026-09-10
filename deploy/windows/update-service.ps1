#Requires -RunAsAdministrator
param(
    [Parameter(Mandatory = $true)]
    [string]$NewPackageDirectory
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$ServiceName = 'MCAASContpaqiBridge'
$Wrapper = Join-Path $Root 'MCAASContpaqiBridge.exe'
$NewRoot = (Resolve-Path $NewPackageDirectory).Path

$Required = @(
    'MCAASContpaqiBridge.exe',
    'MCAASContpaqiBridge.xml',
    'app',
    'runtime',
    'config',
    'queries'
)

foreach ($Item in $Required) {
    if (-not (Test-Path (Join-Path $NewRoot $Item))) {
        throw "El paquete nuevo no contiene $Item."
    }
}

$Service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $Service) { throw "El servicio $ServiceName no está instalado." }

Write-Host 'Deteniendo servicio...' -ForegroundColor Cyan
& $Wrapper stop
if ($LASTEXITCODE -ne 0) { throw 'No fue posible detener el servicio.' }

# Conserva expresamente .env, data y logs de la instalación actual.
foreach ($Item in @('app', 'runtime', 'config', 'queries')) {
    $Target = Join-Path $Root $Item
    if (Test-Path $Target) { Remove-Item $Target -Recurse -Force }
    Copy-Item (Join-Path $NewRoot $Item) $Target -Recurse -Force
}

Copy-Item (Join-Path $NewRoot 'MCAASContpaqiBridge.exe') $Wrapper -Force
Copy-Item (Join-Path $NewRoot 'MCAASContpaqiBridge.xml') (Join-Path $Root 'MCAASContpaqiBridge.xml') -Force
foreach ($MetadataFile in @('.env.example', 'README.md', 'VERSION')) {
    $MetadataSource = Join-Path $NewRoot $MetadataFile
    if (Test-Path $MetadataSource) { Copy-Item $MetadataSource (Join-Path $Root $MetadataFile) -Force }
}

foreach ($ScriptName in @(
    'install-service.ps1', 'uninstall-service.ps1', 'start-service.ps1',
    'stop-service.ps1', 'status-service.ps1', 'test-config.ps1',
    'test-connections.ps1', 'update-service.ps1', 'run-console.ps1',
    'run-console.cmd', 'open-live-log.ps1', 'open-live-log.cmd'
)) {
    $Source = Join-Path $NewRoot $ScriptName
    if (Test-Path $Source) { Copy-Item $Source (Join-Path $Root $ScriptName) -Force }
}

Write-Host 'Validando configuración con la versión nueva...' -ForegroundColor Cyan
& (Join-Path $Root 'test-config.ps1')
if ($LASTEXITCODE -ne 0) { throw 'La versión nueva no acepta la configuración actual.' }

Write-Host 'Iniciando servicio...' -ForegroundColor Cyan
& $Wrapper start
if ($LASTEXITCODE -ne 0) { throw 'No fue posible iniciar la versión actualizada.' }

Get-Service -Name $ServiceName | Format-Table Status, Name, DisplayName -AutoSize
Write-Host 'Actualización terminada. .env, data y logs fueron preservados.' -ForegroundColor Green
