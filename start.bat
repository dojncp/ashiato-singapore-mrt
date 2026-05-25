@echo off
setlocal
cd /d "%~dp0"
call backend\start.bat
call frontend\start.bat
endlocal
