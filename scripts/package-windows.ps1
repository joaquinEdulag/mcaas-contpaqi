param(
    [string]$Version = 'console',
    [switch]$SkipBuild,
    [switch]$IncludeEnv
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Artifacts = Join-Path $Root 'artifacts'
$PackageName = "mcaas-contpaqi-$Version-win-x64-console"
$Stage = Join-Path $Artifacts $PackageName
$Zip = Join-Path $Artifacts "$PackageName.zip"
$ShaFile = "$Zip.sha256"

$NodeVersion = '24.20.0'
$NodeFile = "node-v$NodeVersion-win-x64.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeFile"
$NodeChecksumUrl = "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt"

function Assert-LastExitCode([string]$Message) {
    if ($LASTEXITCODE -ne 0) { throw $Message }
}

New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null
if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
if (Test-Path $Zip) { Remove-Item $Zip -Force }
if (Test-Path $ShaFile) { Remove-Item $ShaFile -Force }

if (-not $SkipBuild) {
    Push-Location $Root
    try {
        pnpm build
        Assert-LastExitCode 'El build de NestJS fallo.'
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path (Join-Path $Root 'dist\main.js'))) {
    throw 'No existe dist\main.js. Ejecuta pnpm build o quita -SkipBuild.'
}

New-Item -ItemType Directory -Force -Path $Stage | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Stage 'app') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Stage 'runtime') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Stage 'data') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Stage 'logs') | Out-Null

Copy-Item (Join-Path $Root 'dist') (Join-Path $Stage 'app\dist') -Recurse
Copy-Item (Join-Path $Root 'package.json') (Join-Path $Stage 'app\package.json')
if (Test-Path (Join-Path $Root 'pnpm-lock.yaml')) {
    Copy-Item (Join-Path $Root 'pnpm-lock.yaml') (Join-Path $Stage 'app\pnpm-lock.yaml')
}

Push-Location (Join-Path $Stage 'app')
try {
    pnpm install --prod --no-frozen-lockfile --config.node-linker=hoisted
    Assert-LastExitCode 'No fue posible instalar dependencias de produccion.'
} finally {
    Pop-Location
}

Copy-Item (Join-Path $Root 'config') (Join-Path $Stage 'config') -Recurse
Copy-Item (Join-Path $Root 'queries') (Join-Path $Stage 'queries') -Recurse
Copy-Item (Join-Path $Root '.env.example') (Join-Path $Stage '.env.example')

if ($IncludeEnv) {
    $ConfiguredEnv = Join-Path $Root '.env'
    if (-not (Test-Path $ConfiguredEnv)) {
        throw '-IncludeEnv fue solicitado, pero no existe .env en el proyecto.'
    }
    Copy-Item $ConfiguredEnv (Join-Path $Stage '.env')
    Write-Warning 'Se incluyo .env en el ZIP. Este artefacto puede contener secretos: no lo publiques.'
}

Copy-Item (Join-Path $Root 'deploy\windows\*') $Stage -Recurse
Set-Content -Path (Join-Path $Stage 'VERSION') -Value $Version -Encoding UTF8

$NodeZip = Join-Path $Artifacts $NodeFile
$ChecksumFile = Join-Path $Artifacts 'node-SHASUMS256.txt'
Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
Invoke-WebRequest -Uri $NodeChecksumUrl -OutFile $ChecksumFile

$Line = Get-Content $ChecksumFile | Where-Object {
    $Parts = $_ -split '\s+'
    $Parts.Count -ge 2 -and $Parts[1] -eq $NodeFile
} | Select-Object -First 1
if (-not $Line) { throw "No se encontro checksum oficial para $NodeFile." }
$ExpectedNodeHash = ($Line -split '\s+')[0].ToLowerInvariant()
$ActualNodeHash = (Get-FileHash $NodeZip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($ExpectedNodeHash -ne $ActualNodeHash) { throw 'El checksum SHA-256 de Node.js no coincide.' }

$NodeExtract = Join-Path $Artifacts 'node-runtime'
if (Test-Path $NodeExtract) { Remove-Item $NodeExtract -Recurse -Force }
Expand-Archive -Path $NodeZip -DestinationPath $NodeExtract -Force
$NodeDirectory = Join-Path $NodeExtract "node-v$NodeVersion-win-x64"
Copy-Item (Join-Path $NodeDirectory '*') (Join-Path $Stage 'runtime') -Recurse

# No WinSW, no XML de servicio, no Service Control Manager.
# El proceso se administra exclusivamente desde MCAAS.cmd.
Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $Zip -CompressionLevel Optimal
$ZipHash = (Get-FileHash $Zip -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -Path $ShaFile -Value "$ZipHash  $([IO.Path]::GetFileName($Zip))" -Encoding ASCII

Write-Host ''
Write-Host 'Paquete Windows de CONSOLA generado correctamente:' -ForegroundColor Green
Write-Host $Zip
Write-Host $ShaFile
Write-Host ''
Write-Host 'En el servidor: extrae el ZIP, configura .env y abre MCAAS.cmd.' -ForegroundColor Cyan
Write-Host 'No se instala ningun servicio de Windows.' -ForegroundColor Cyan
