@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0upload-git.ps1"
if errorlevel 1 (
  echo Upload failed. Read the error above; no force-push was attempted.
)
pause
