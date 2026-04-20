@echo off
setlocal
cd /d "%~dp0"

REM PowerShell may block npm.ps1; npm.cmd works reliably.
call npm.cmd run build

