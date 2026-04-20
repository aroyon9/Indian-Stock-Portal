Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stateFile = Join-Path $root ".logs\portal-processes.json"

function Get-RunningProcess {
  param([int]$ProcessId)
  try {
    return Get-Process -Id $ProcessId -ErrorAction Stop
  } catch {
    return $null
  }
}

if (!(Test-Path $stateFile)) {
  Write-Host "Portal is not running (no state file found)."
  exit 0
}

$state = Get-Content $stateFile -Raw | ConvertFrom-Json
$stopped = @()

foreach ($entry in @(
  @{ Name = "frontend"; Pid = [int]$state.frontendPid },
  @{ Name = "backend"; Pid = [int]$state.backendPid }
)) {
  $proc = Get-RunningProcess -ProcessId $entry.Pid
  if ($proc) {
    Stop-Process -Id $entry.Pid -Force
    $stopped += "$($entry.Name) pid=$($entry.Pid)"
  }
}

Remove-Item -Force $stateFile -ErrorAction SilentlyContinue

if ($stopped.Count -eq 0) {
  Write-Host "No running portal processes found. State cleaned."
} else {
  Write-Host ("Stopped: " + ($stopped -join ", "))
}
