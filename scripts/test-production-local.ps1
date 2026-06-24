param(
  [int]$Port = 3000,
  [int]$ApiPort = 8000,
  [switch]$NoBackend
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".env"

function Get-DotEnvValue($Name) {
  if (-not (Test-Path -LiteralPath $envPath)) { return $null }
  $line = Get-Content -LiteralPath $envPath | Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -replace "^\s*$([regex]::Escape($Name))\s*=\s*", "").Trim().Trim('"').Trim("'")
}

function Has-ConfigValue($Name) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    $value = Get-DotEnvValue $Name
  }
  return -not [string]::IsNullOrWhiteSpace($value)
}

function Test-PortListening($PortToCheck) {
  return [bool](Get-NetTCPConnection -LocalPort $PortToCheck -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

$missing = @()
foreach ($name in @("SUPABASE_URL", "SUPABASE_KEY")) {
  if (-not (Has-ConfigValue $name)) { $missing += $name }
}

if ($missing.Count -gt 0) {
  Write-Host "Missing required local production-test env values in .env or process env:" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  Write-Host "Copy .env.example to .env and fill these before running this script."
  exit 1
}

Set-Location $root

Write-Host "Building frontend production bundle..." -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
if (-not (Test-Path -LiteralPath "node_modules")) {
  npm install
}
npm run build
Pop-Location

$backendProcess = $null
if (-not $NoBackend) {
  if (Test-PortListening $ApiPort) {
    Write-Host "Using existing backend on http://127.0.0.1:$ApiPort" -ForegroundColor Yellow
  } else {
    Write-Host "Starting FastAPI backend on http://127.0.0.1:$ApiPort" -ForegroundColor Cyan
    $backendOut = Join-Path $root "local-backend.out.log"
    $backendErr = Join-Path $root "local-backend.err.log"
    Remove-Item -LiteralPath $backendOut,$backendErr -ErrorAction SilentlyContinue
    $backendProcess = Start-Process -FilePath python -ArgumentList @('-m','uvicorn','backend.main:app','--host','127.0.0.1','--port',"$ApiPort") -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr -PassThru
    Start-Sleep -Seconds 3
    if (-not (Test-PortListening $ApiPort)) {
      Write-Host "Backend failed to start. Last stderr lines:" -ForegroundColor Red
      Get-Content -LiteralPath $backendErr -ErrorAction SilentlyContinue | Select-Object -Last 40
      exit 1
    }
  }
}

try {
  Write-Host "Starting local production site on http://localhost:$Port" -ForegroundColor Cyan
  Write-Host "Serving frontend/dist and proxying /api/* to http://127.0.0.1:$ApiPort"
  Write-Host "This does not deploy. Stop it with Ctrl+C."
  node scripts/serve-production-local.mjs --port=$Port --api=http://127.0.0.1:$ApiPort
} finally {
  if ($backendProcess -and -not $backendProcess.HasExited) {
    Stop-Process -Id $backendProcess.Id -Force
  }
}
