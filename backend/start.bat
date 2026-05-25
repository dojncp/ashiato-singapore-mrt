@echo off
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs

set "PYTHON_EXE=%CD%\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
  call conda.bat activate smrt
  if errorlevel 1 (
    echo Failed to activate backend Python environment.
    exit /b 1
  )
  set "PYTHON_EXE=python"
)

echo Starting FastAPI backend on http://127.0.0.1:39250
start "ashiato-backend" /min cmd /c "%PYTHON_EXE% -m uvicorn app.main:app --host 127.0.0.1 --port 39250 > logs\uvicorn.log 2> logs\uvicorn.err.log"
endlocal
