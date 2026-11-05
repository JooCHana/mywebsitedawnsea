@echo off
cd /d "%~dp0"
python start_site.py
if errorlevel 1 pause
