#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$Wrapper = Join-Path $PSScriptRoot 'MCAASContpaqiBridge.exe'
& $Wrapper start
if ($LASTEXITCODE -ne 0) { throw 'No fue posible iniciar el servicio.' }
Get-Service -Name 'MCAASContpaqiBridge' | Format-Table Status, Name, DisplayName -AutoSize
