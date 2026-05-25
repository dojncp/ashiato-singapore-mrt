@echo off
setlocal
cd /d "%~dp0"
call frontend\stop.bat
call backend\stop.bat
endlocal
