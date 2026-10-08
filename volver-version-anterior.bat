@echo off
setlocal
set "APP=%LOCALAPPDATA%\Ori\app"
set "BK=%LOCALAPPDATA%\Ori\app-anterior"
if not exist "%BK%\backend" ( echo No hay version anterior guardada. & pause & exit /b 1 )
echo Cerrando Ori...
"%APP%\python\python.exe" "%APP%\launcher.py" --stop >nul 2>&1
timeout /t 5 /nobreak >nul
copy /y "%BK%\backend\*.py" "%APP%\backend\" >nul
rmdir /s /q "%APP%\frontend"
xcopy /e /i /q /y "%BK%\frontend" "%APP%\frontend" >nul
echo Restaurada la version anterior. Abre Ori normalmente.
pause
