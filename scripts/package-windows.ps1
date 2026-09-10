param(
    [string]$Version = 'local',
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Artifacts = Join-Path $Root 'artifacts'
$PackageName = "mcaas-contpaqi-$Version-win-x64"
$Stage = Join-Path $Artifacts $PackageName
$Zip = Join-Path $Artifacts "$PackageName.zip"
$ShaFile = "$Zip.sha256"

$NodeVersion = '24.20.0'
$NodeFile = "node-v$NodeVersion-win-x64.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeFile"
$NodeChecksumUrl = "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt"

$WinSwVersion = '2.12.0'
$WinSwUrl = "https://github.com/winsw/winsw/releases/download/v$WinSwVersion/WinSW-x64.exe"
$WinSwSha256 = '05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da'

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
        Assert-LastExitCode 'El build de NestJS falló.'
    } finally {
        Pop-Location
    }
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
    if (Test-Path 'pnpm-lock.yaml') {
        pnpm install --prod --no-frozen-lockfile --config.node-linker=hoisted
    } else {
        pnpm install --prod --no-frozen-lockfile --config.node-linker=hoisted
    }
    Assert-LastExitCode 'No fue posible instalar dependencias de producción.'
} finally {
    Pop-Location
}

Copy-Item (Join-Path $Root 'config') (Join-Path $Stage 'config') -Recurse
Copy-Item (Join-Path $Root 'queries') (Join-Path $Stage 'queries') -Recurse
Copy-Item (Join-Path $Root '.env.example') (Join-Path $Stage '.env.example')
Copy-Item (Join-Path $Root 'README.md') (Join-Path $Stage 'README.md')
Set-Content -Path (Join-Path $Stage 'VERSION') -Value $Version -Encoding UTF8

$NodeZip = Join-Path $Artifacts $NodeFile
$ChecksumFile = Join-Path $Artifacts 'node-SHASUMS256.txt'
Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
Invoke-WebRequest -Uri $NodeChecksumUrl -OutFile $ChecksumFile

$Line = Get-Content $ChecksumFile | Where-Object {
    $Parts = $_ -split '\s+'
    $Parts.Count -ge 2 -and $Parts[1] -eq $NodeFile
} | Select-Object -First 1
if (-not $Line) { throw "No se encontró checksum oficial para $NodeFile." }
$ExpectedNodeHash = ($Line -split '\s+')[0].ToLowerInvariant()
$ActualNodeHash = (Get-FileHash $NodeZip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($ExpectedNodeHash -ne $ActualNodeHash) { throw 'El checksum SHA-256 de Node.js no coincide.' }

$NodeExtract = Join-Path $Artifacts 'node-runtime'
if (Test-Path $NodeExtract) { Remove-Item $NodeExtract -Recurse -Force }
Expand-Archive -Path $NodeZip -DestinationPath $NodeExtract -Force
$NodeDirectory = Join-Path $NodeExtract "node-v$NodeVersion-win-x64"
Copy-Item (Join-Path $NodeDirectory '*') (Join-Path $Stage 'runtime') -Recurse

$Wrapper = Join-Path $Stage 'MCAASContpaqiBridge.exe'
Invoke-WebRequest -Uri $WinSwUrl -OutFile $Wrapper
$ActualWinSwHash = (Get-FileHash $Wrapper -Algorithm SHA256).Hash.ToLowerInvariant()
if ($ActualWinSwHash -ne $WinSwSha256) { throw 'El checksum SHA-256 de WinSW no coincide.' }

$WindowsFiles = @(
    'MCAASContpaqiBridge.xml',
    'install-service.ps1',
    'uninstall-service.ps1',
    'start-service.ps1',
    'stop-service.ps1',
    'status-service.ps1',
    'test-config.ps1',
    'test-connections.ps1',
    'update-service.ps1'
)
foreach ($File in $WindowsFiles) {
    Copy-Item (Join-Path $Root "deploy\windows\$File") (Join-Path $Stage $File)
}

Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $Zip -CompressionLevel Optimal
$ZipHash = (Get-FileHash $Zip -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -Path $ShaFile -Value "$ZipHash  $([IO.Path]::GetFileName($Zip))" -Encoding ASCII

Write-Host ''
Write-Host 'Paquete Windows generado correctamente:' -ForegroundColor Green
Write-Host $Zip
Write-Host $ShaFile
