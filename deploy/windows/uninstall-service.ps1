#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$ServiceName = 'MCAASContpaqiBridge'
$Wrapper = Join-Path $Root 'MCAASContpaqiBridge.exe'
$Service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if (-not $Service) {
    Write-Host "El servicio $ServiceName no está instalado." -ForegroundColor Yellow
    exit 0
}

if ($Service.Status -ne 'Stopped') {
    & $Wrapper stop
    if ($LASTEXITCODE -ne 0) { throw 'No fue posible detener el servicio.' }
}

& $Wrapper uninstall
if ($LASTEXITCODE -ne 0) { throw 'No fue posible desinstalar el servicio.' }

Write-Host 'Servicio desinstalado. .env, data y logs NO fueron eliminados.' -ForegroundColor Green
