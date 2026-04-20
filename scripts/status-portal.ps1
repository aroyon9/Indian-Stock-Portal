Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stateFile = Join-Path $root ".logs\portal-processes.json"

function Is-Running {
  param([int]$ProcessId)
  try {
    Get-Process -Id $ProcessId -ErrorAction Stop | Out-Null
    return $true
  } catch {
    return $false
  }
}

if (!(Test-Path $stateFile)) {
  Write-Host "Portal status: stopped"
  exit 0
}

$state = Get-Content $stateFile -Raw | ConvertFrom-Json
$backendRunning = Is-Running -ProcessId ([int]$state.backendPid)
$frontendRunning = Is-Running -ProcessId ([int]$state.frontendPid)

if (-not $backendRunning -and -not $frontendRunning) {
  Remove-Item -Force $stateFile -ErrorAction SilentlyContinue
  Write-Host "Portal status: stopped (stale state cleaned)"
  exit 0
}

Write-Host "Portal status"
Write-Host ("  Started : " + $state.startedAt)
Write-Host ("  Backend : pid=" + $state.backendPid + " running=" + $backendRunning + " url=" + $state.backendUrl)
Write-Host ("  Frontend: pid=" + $state.frontendPid + " running=" + $frontendRunning + " url=" + $state.frontendUrl)
Write-Host ("  State   : " + $stateFile)
