@echo off
setlocal
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5293" ^| findstr "LISTENING"') do (
  echo Stopping frontend process %%a on port 5293
  taskkill /PID %%a /F
)
endlocal
