$ErrorActionPreference = 'Continue'
$Root = $PSScriptRoot
$Logs = Join-Path $Root 'logs'
$Node = Join-Path $Root 'runtime\node.exe'
$EnvFile = Join-Path $Root '.env'
$CheckConfig = Join-Path $Root 'app\dist\commands\check-config.js'
$TestConnections = Join-Path $Root 'app\dist\commands\test-connections.js'
$Checkpoint = Join-Path $Root 'data\checkpoints.json'

New-Item -ItemType Directory -Force -Path $Logs | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Report = Join-Path $Logs "diagnostico-$Stamp.txt"

function Out-Diag {
    param([string]$Text = '')
    Write-Host $Text
    Add-Content -LiteralPath $Report -Value $Text -Encoding UTF8
}

function Run-And-Capture {
    param([string]$Title, [scriptblock]$Action)
    Out-Diag ''
    Out-Diag "==================== $Title ===================="
    try {
        $result = & $Action 2>&1 | Out-String
        Out-Diag $result.TrimEnd()
        Out-Diag "EXITCODE=$LASTEXITCODE"
    } catch {
        Out-Diag "ERROR: $($_.Exception.Message)"
    }
}

Out-Diag 'MCAAS CONTPAQI - DIAGNOSTICO'
Out-Diag "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Out-Diag "Equipo: $env:COMPUTERNAME"
Out-Diag "Usuario: $env:USERNAME"
Out-Diag "Root: $Root"
Out-Diag "PowerShell: $($PSVersionTable.PSVersion)"
Out-Diag "SO: $([Environment]::OSVersion.VersionString)"

Out-Diag ''
Out-Diag '==================== ARCHIVOS ===================='
foreach ($item in @($Node, $EnvFile, $CheckConfig, $TestConnections, $Checkpoint)) {
    Out-Diag "$(if(Test-Path -LiteralPath $item){'[OK]'}else{'[FALTA]'}) $item"
}

if (Test-Path -LiteralPath $Node) {
    Run-And-Capture 'NODE' { & $Node --version }
}

if ((Test-Path -LiteralPath $Node) -and (Test-Path -LiteralPath $EnvFile) -and (Test-Path -LiteralPath $CheckConfig)) {
    Run-And-Capture 'CONFIGURACION' { & $Node --env-file="$EnvFile" $CheckConfig }
}

if ((Test-Path -LiteralPath $Node) -and (Test-Path -LiteralPath $EnvFile) -and (Test-Path -LiteralPath $TestConnections)) {
    Run-And-Capture 'CONEXIONES SQL + HTTP' { & $Node --env-file="$EnvFile" $TestConnections }
}

Out-Diag ''
Out-Diag '==================== CHECKPOINT ===================='
if (Test-Path -LiteralPath $Checkpoint) {
    try { Out-Diag (Get-Content -LiteralPath $Checkpoint -Raw) } catch { Out-Diag "ERROR leyendo checkpoint: $($_.Exception.Message)" }
} else {
    Out-Diag 'No existe checkpoint.'
}

Out-Diag ''
Out-Diag '==================== ULTIMOS ERRORES ===================='
$ErrorLog = Get-ChildItem -Path $Logs -Filter 'errors-*.log' -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if ($ErrorLog) {
    Out-Diag "Archivo: $($ErrorLog.FullName)"
    try { Out-Diag ((Get-Content -LiteralPath $ErrorLog.FullName -Tail 100) -join [Environment]::NewLine) } catch { Out-Diag "ERROR leyendo log: $($_.Exception.Message)" }
} else {
    Out-Diag 'No hay logs errors-*.log.'
}

Out-Diag ''
Out-Diag '==================== HOST ===================='
$HostLog = Join-Path $Logs 'console-host.log'
if (Test-Path -LiteralPath $HostLog) {
    try { Out-Diag ((Get-Content -LiteralPath $HostLog -Tail 100) -join [Environment]::NewLine) } catch { Out-Diag "ERROR leyendo host log: $($_.Exception.Message)" }
} else {
    Out-Diag 'No existe console-host.log.'
}

Out-Diag ''
Out-Diag "Reporte guardado en: $Report"
Write-Host ''
Write-Host "REPORTE: $Report" -ForegroundColor Green
