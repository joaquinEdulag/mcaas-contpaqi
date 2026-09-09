$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Node = Join-Path $Root 'runtime\node.exe'
$EnvFile = Join-Path $Root '.env'
$Script = Join-Path $Root 'app\dist\commands\test-connections.js'

if (-not (Test-Path $EnvFile)) { throw 'No existe .env. Copia .env.example como .env y configúralo.' }
& $Node --env-file="$EnvFile" $Script
exit $LASTEXITCODE
