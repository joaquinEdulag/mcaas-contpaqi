#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$Wrapper = Join-Path $PSScriptRoot 'MCAASContpaqiBridge.exe'
& $Wrapper stop
if ($LASTEXITCODE -ne 0) { throw 'No fue posible detener el servicio.' }
Get-Service -Name 'MCAASContpaqiBridge' | Format-Table Status, Name, DisplayName -AutoSize
