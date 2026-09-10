$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$Node = Join-Path $Root 'runtime\node.exe'
$EnvFile = Join-Path $Root '.env'
$Main = Join-Path $Root 'app\dist\main.js'
$Logs = Join-Path $Root 'logs'

if (-not (Test-Path $Node)) {
    throw "No existe el runtime incluido: $Node"
}
if (-not (Test-Path $EnvFile)) {
    throw "No existe $EnvFile. Copia .env.example como .env y configuralo."
}
if (-not (Test-Path $Main)) {
    throw "No existe la aplicacion compilada: $Main"
}

New-Item -ItemType Directory -Force -Path $Logs | Out-Null

$Service = Get-Service -Name 'MCAASContpaqiBridge' -ErrorAction SilentlyContinue
if ($Service -and $Service.Status -eq 'Running') {
    Write-Host 'El servicio MCAASContpaqiBridge ya esta ejecutandose.' -ForegroundColor Red
    Write-Host 'No se iniciara una segunda instancia porque podria procesar los mismos lotes dos veces.' -ForegroundColor Red
    Write-Host 'Usa open-live-log.cmd para observar el servicio sin detenerlo, o stop-service.ps1 antes de usar modo consola.' -ForegroundColor Yellow
    exit 3
}

Set-Location $Root

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' MCAAS - CONTPAQi Bridge | MODO CONSOLA' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host "Directorio : $Root"
Write-Host "Logs       : $Logs"
Write-Host 'Detener     : Ctrl+C' -ForegroundColor Yellow
Write-Host 'La consola permanecera abierta mientras el proceso este vivo.'
Write-Host '============================================================'
Write-Host ''

& $Node --env-file="$EnvFile" $Main
$ExitCode = $LASTEXITCODE

Write-Host ''
if ($ExitCode -eq 0) {
    Write-Host 'El proceso termino normalmente.' -ForegroundColor Yellow
} else {
    Write-Host "El proceso termino con error. Codigo de salida: $ExitCode" -ForegroundColor Red
    Write-Host "Revisa los archivos errors-AAAA-MM-DD.log y mcaas-AAAA-MM-DD.log en: $Logs" -ForegroundColor Red
}

exit $ExitCode
