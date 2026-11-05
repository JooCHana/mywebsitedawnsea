@echo off
cd /d "%~dp0server"
if not exist .venv\Scripts\python.exe python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto end
.venv\Scripts\python.exe manage.py migrate
if errorlevel 1 goto end
.venv\Scripts\python.exe manage.py createsuperuser
:end
pause
