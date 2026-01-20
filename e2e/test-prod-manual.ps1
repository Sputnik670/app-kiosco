# Script PowerShell para ejecutar test en producción
# Ejecuta: .\e2e\test-prod-manual.ps1

$env:PLAYWRIGHT_TEST_BASE_URL = "https://app-cadena-kiosco-24-7.vercel.app"
$env:TEST_EMPLOYEE_EMAIL = "entornomincyt@gmail.com"
$env:TEST_EMPLOYEE_PASSWORD = "RamYLu.2021"

Write-Host "🧪 Ejecutando test de QR Scanner en producción..." -ForegroundColor Green
Write-Host "URL: $env:PLAYWRIGHT_TEST_BASE_URL" -ForegroundColor Cyan
Write-Host ""

npx playwright test e2e/qr-scanner-prod.spec.ts --project=chromium --timeout=120000 --reporter=list

Write-Host ""
Write-Host "✅ Test completado. Revisa la salida arriba para ver los logs capturados." -ForegroundColor Green

