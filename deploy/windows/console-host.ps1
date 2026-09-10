$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$Node = Join-Path $Root 'runtime\node.exe'
$EnvFile = Join-Path $Root '.env'
$Main = Join-Path $Root 'app\dist\main.js'
$CheckConfig = Join-Path $Root 'app\dist\commands\check-config.js'
$Logs = Join-Path $Root 'logs'
$Data = Join-Path $Root 'data'
$LockPath = Join-Path $Data 'mcaas-console.lock'
$PidPath = Join-Path $Data 'mcaas-console.pid'
$SupervisorLog = Join-Path $Logs 'console-host.log'
$RestartDelaySeconds = 5
$RestartCount = 0
$LockStream = $null

function Write-HostLog {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet('INFO','WARN','ERROR')][string]$Level = 'INFO'
    )

    $timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
    $line = "[$timestamp] [$Level] [CONSOLE-HOST] $Message"

    switch ($Level) {
        'ERROR' { Write-Host $line -ForegroundColor Red }
        'WARN'  { Write-Host $line -ForegroundColor Yellow }
        default { Write-Host $line }
    }

    try {
        Add-Content -LiteralPath $SupervisorLog -Value $line -Encoding UTF8
    } catch {
        Write-Host "No se pudo escribir en $SupervisorLog : $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Assert-FileExists {
    param([string]$Path, [string]$Description)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Description no encontrado: $Path"
    }
}

New-Item -ItemType Directory -Force -Path $Logs | Out-Null
New-Item -ItemType Directory -Force -Path $Data | Out-Null

Clear-Host
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' MCAAS CONTPAQI -> ERP EDULAG' -ForegroundColor Cyan
Write-Host ' ARQUITECTURA: PROCESO FOREGROUND + CMD PERSISTENTE' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " Carpeta      : $Root"
Write-Host " Logs         : $Logs"
Write-Host " Estado       : $Data"
Write-Host ' Detener      : CERRAR ESTA VENTANA CMD' -ForegroundColor Yellow
Write-Host ' Reinicio     : automatico si Node termina o falla' -ForegroundColor Yellow
Write-Host ' Servicio Win : NO se utiliza' -ForegroundColor Green
Write-Host '============================================================'
Write-Host ''

try {
    Assert-FileExists $Node 'Runtime Node.js incluido'
    Assert-FileExists $EnvFile 'Archivo .env'
    Assert-FileExists $Main 'Aplicacion compilada'
    Assert-FileExists $CheckConfig 'Validador de configuracion'

    # Bloqueo exclusivo durante toda la vida de esta consola. Evita dos bridges a la vez.
    try {
        $LockStream = [System.IO.File]::Open(
            $LockPath,
            [System.IO.FileMode]::OpenOrCreate,
            [System.IO.FileAccess]::ReadWrite,
            [System.IO.FileShare]::None
        )
    } catch {
        throw 'Ya existe otra consola MCAAS ejecutandose. Cierra la otra instancia antes de abrir una nueva.'
    }

    Set-Content -LiteralPath $PidPath -Value $PID -Encoding ASCII
    Write-HostLog "Host iniciado. PID=$PID. Carpeta=$Root"

    Write-HostLog 'Ejecutando validacion obligatoria de .env y configuracion antes de iniciar.'
    & $Node --env-file="$EnvFile" $CheckConfig
    $ConfigExitCode = $LASTEXITCODE
    if ($ConfigExitCode -ne 0) {
        throw "La configuracion no paso la validacion. Codigo=$ConfigExitCode. El bridge NO se iniciara hasta corregir .env."
    }
    Write-HostLog 'Configuracion valida.'

    while ($true) {
        $RestartCount += 1
        Write-Host ''
        Write-Host '------------------------------------------------------------' -ForegroundColor DarkCyan
        Write-HostLog "Iniciando proceso MCAAS. Ejecucion #$RestartCount"
        Write-Host '------------------------------------------------------------' -ForegroundColor DarkCyan
        Write-Host ''

        $StartedAt = Get-Date
        try {
            & $Node --env-file="$EnvFile" $Main
            $ExitCode = $LASTEXITCODE
        } catch {
            $ExitCode = 1
            Write-HostLog "PowerShell no pudo ejecutar Node: $($_.Exception.Message)" 'ERROR'
        }

        $Duration = [Math]::Round(((Get-Date) - $StartedAt).TotalSeconds, 2)

        if ($ExitCode -eq 0) {
            Write-HostLog "El proceso Node termino con codigo 0 despues de $Duration s. Como MCAAS debe permanecer activo, se reiniciara." 'WARN'
        } else {
            Write-HostLog "El proceso Node FALLO/TERMINO con codigo $ExitCode despues de $Duration s." 'ERROR'
        }

        Write-HostLog "Reinicio automatico en $RestartDelaySeconds segundos. Para detener MCAAS, cierra esta ventana CMD." 'WARN'
        Start-Sleep -Seconds $RestartDelaySeconds
    }
} catch {
    Write-HostLog $_.Exception.Message 'ERROR'
    Write-HostLog 'El host no puede continuar. Corrige el problema mostrado arriba y vuelve a abrir MCAAS.cmd.' 'ERROR'
    exit 10
} finally {
    try {
        Remove-Item -LiteralPath $PidPath -Force -ErrorAction SilentlyContinue
    } catch {}
    if ($null -ne $LockStream) {
        try { $LockStream.Dispose() } catch {}
    }
}
