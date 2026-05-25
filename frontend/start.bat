@echo off
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs

echo Starting React frontend on http://127.0.0.1:5293
start "ashiato-frontend" /min cmd /c "npm run dev > logs\vite.log 2> logs\vite.err.log"
endlocal
