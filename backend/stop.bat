@echo off
setlocal
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":39250" ^| findstr "LISTENING"') do (
  echo Stopping backend process %%a on port 39250
  taskkill /PID %%a /F
)
endlocal
