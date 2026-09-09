$Service = Get-Service -Name 'MCAASContpaqiBridge' -ErrorAction SilentlyContinue
if (-not $Service) {
    Write-Host 'MCAASContpaqiBridge no está instalado.' -ForegroundColor Yellow
    exit 1
}
$Service | Format-Table Status, Name, DisplayName -AutoSize
