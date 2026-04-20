Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$logsDir = Join-Path $root ".logs"
$stateFile = Join-Path $logsDir "portal-processes.json"

New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

function Test-PortAvailable {
  param([int]$Port)
  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($listener -ne $null) {
      $listener.Stop()
    }
  }
}

function Get-FreePort {
  param(
    [int[]]$PreferredPorts,
    [int]$RangeStart,
    [int]$RangeEnd
  )
  foreach ($p in $PreferredPorts) {
    if (Test-PortAvailable -Port $p) {
      return $p
    }
  }
  for ($p = $RangeStart; $p -le $RangeEnd; $p++) {
    if (Test-PortAvailable -Port $p) {
      return $p
    }
  }
  throw "No free ports available in range $RangeStart-$RangeEnd."
}

function Get-RunningProcess {
  param([int]$ProcessId)
  try {
    return Get-Process -Id $ProcessId -ErrorAction Stop
  } catch {
    return $null
  }
}

if (Test-Path $stateFile) {
  try {
    $state = Get-Content $stateFile -Raw | ConvertFrom-Json
    $runningBackendProc = Get-RunningProcess -ProcessId ([int]$state.backendPid)
    $runningFrontendProc = Get-RunningProcess -ProcessId ([int]$state.frontendPid)
    if ($runningBackendProc -or $runningFrontendProc) {
      throw "Portal appears to be already running. Use stop-portal.cmd first."
    }
    Remove-Item -Force $stateFile -ErrorAction SilentlyContinue
  } catch {
    Remove-Item -Force $stateFile -ErrorAction SilentlyContinue
  }
}

$backendPort = Get-FreePort -PreferredPorts @(8010, 8000) -RangeStart 8011 -RangeEnd 8099
$frontendPort = Get-FreePort -PreferredPorts @(3000, 3010) -RangeStart 3011 -RangeEnd 3099

$pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe"
if (!(Test-Path $pythonExe)) {
  $pythonExe = "python"
}

$nextCmd = Join-Path $frontendDir "node_modules\.bin\next.cmd"
if (!(Test-Path $nextCmd)) {
  throw "Frontend dependencies missing. Run 'cd frontend && npm.cmd install' first."
}

$backendOut = Join-Path $logsDir "backend.out.log"
$backendErr = Join-Path $logsDir "backend.err.log"
$frontendOut = Join-Path $logsDir "frontend.out.log"
$frontendErr = Join-Path $logsDir "frontend.err.log"
foreach ($f in @($backendOut, $backendErr, $frontendOut, $frontendErr)) {
  New-Item -ItemType File -Path $f -Force | Out-Null
}

$corsOrigins = @(
  "http://localhost:$frontendPort",
  "http://127.0.0.1:$frontendPort",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3010",
  "http://127.0.0.1:3010"
) | Select-Object -Unique

$env:CORS_ORIGINS = ($corsOrigins | ConvertTo-Json -Compress)
$backendProc = Start-Process -FilePath $pythonExe `
  -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$backendPort") `
  -WorkingDirectory $backendDir `
  -RedirectStandardOutput $backendOut `
  -RedirectStandardError $backendErr `
  -PassThru

Start-Sleep -Seconds 2
$backendAlive = Get-RunningProcess -ProcessId $backendProc.Id
if (-not $backendAlive) {
  throw "Backend failed to start. Check $backendErr"
}

$env:BACKEND_INTERNAL_URL = "http://127.0.0.1:$backendPort"
$env:NEXT_SERVER_ORIGIN = "http://127.0.0.1:$frontendPort"
$env:PORT = "$frontendPort"
# Force frontend to use same-origin proxy routes (prevents stale direct-port API calls).
$env:NEXT_PUBLIC_API_URL = ""

$frontendProc = Start-Process -FilePath $nextCmd `
  -ArgumentList @("dev", "-p", "$frontendPort") `
  -WorkingDirectory $frontendDir `
  -RedirectStandardOutput $frontendOut `
  -RedirectStandardError $frontendErr `
  -PassThru

Start-Sleep -Seconds 2
$frontendAlive = Get-RunningProcess -ProcessId $frontendProc.Id
if (-not $frontendAlive) {
  $npmCmd = "npm.cmd"
  if (-not (Get-Command $npmCmd -ErrorAction SilentlyContinue)) {
    if (Get-RunningProcess -ProcessId $backendProc.Id) {
      Stop-Process -Id $backendProc.Id -Force
    }
    throw "Frontend dependencies missing. Run 'cd frontend && npm.cmd install' first."
  }
  $frontendProc = Start-Process -FilePath $npmCmd `
    -ArgumentList @("run", "dev:standalone") `
    -WorkingDirectory $frontendDir `
    -RedirectStandardOutput $frontendOut `
    -RedirectStandardError $frontendErr `
    -PassThru
  Start-Sleep -Seconds 2
  $frontendAlive = Get-RunningProcess -ProcessId $frontendProc.Id
  if (-not $frontendAlive) {
    if (Get-RunningProcess -ProcessId $backendProc.Id) {
      Stop-Process -Id $backendProc.Id -Force
    }
    throw "Frontend failed to start in both dev and standalone modes. Check $frontendErr"
  }
}

$state = [ordered]@{
  startedAt = (Get-Date).ToString("s")
  backendPid = $backendProc.Id
  frontendPid = $frontendProc.Id
  backendPort = $backendPort
  frontendPort = $frontendPort
  backendUrl = "http://127.0.0.1:$backendPort"
  frontendUrl = "http://127.0.0.1:$frontendPort"
  backendLogOut = $backendOut
  backendLogErr = $backendErr
  frontendLogOut = $frontendOut
  frontendLogErr = $frontendErr
}
$state | ConvertTo-Json | Set-Content -Encoding UTF8 $stateFile

$backendHealthy = $false
for ($i = 0; $i -lt 25; $i++) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$backendPort/health" -TimeoutSec 2
    if ($resp.StatusCode -eq 200) { $backendHealthy = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 400
}

$frontendHealthy = $false
for ($i = 0; $i -lt 25; $i++) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$frontendPort/" -TimeoutSec 2
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { $frontendHealthy = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 400
}

Write-Host ""
Write-Host "Portal started"
Write-Host "Frontend: http://127.0.0.1:$frontendPort"
Write-Host "Backend : http://127.0.0.1:$backendPort"
Write-Host "State   : $stateFile"
Write-Host ""
if (-not $backendHealthy) {
  Write-Warning "Backend health endpoint did not respond yet. Check $backendErr"
}
if (-not $frontendHealthy) {
  Write-Warning "Frontend endpoint did not respond yet. Check $frontendErr"
}
Write-Host "Logs:"
Write-Host "  $backendOut"
Write-Host "  $backendErr"
Write-Host "  $frontendOut"
Write-Host "  $frontendErr"
