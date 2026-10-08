@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "APP=%LOCALAPPDATA%\Ori\app"
set "YARN=npx --yes yarn@1.22.22"

echo ============================================
echo   Actualizar Ori con el codigo de esta carpeta
echo ============================================
echo.

if not exist "%APP%\backend" (
  echo No encuentro Ori instalado en %APP%
  echo Instala primero OriSetup.exe y vuelve a ejecutar este archivo.
  pause & exit /b 1
)
if not exist "frontend\package.json" (
  echo No encuentro la carpeta "frontend" junto a este archivo.
  pause & exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
  echo Falta Node.js. Se abrira la web: instala la version LTS, reinicia el PC
  echo y vuelve a ejecutar este archivo.
  start https://nodejs.org/es/download
  pause & exit /b 1
)

echo [1/4] Descargando dependencias del frontend (la primera vez tarda unos minutos)...
pushd frontend
call %YARN% install --frozen-lockfile --network-timeout 600000
if errorlevel 1 ( popd & goto :error )

echo [2/4] Compilando el frontend...
if exist "%~dp0_build" rmdir /s /q "%~dp0_build"
set "BUILD_PATH=%~dp0_build\frontend"
set "GENERATE_SOURCEMAP=false"
set "CI=false"
call %YARN% build
if errorlevel 1 ( popd & goto :error )
popd
if not exist "_build\frontend\index.html" goto :error

echo [3/4] Cerrando Ori...
"%APP%\python\python.exe" "%APP%\launcher.py" --stop >nul 2>&1
timeout /t 5 /nobreak >nul

echo [4/4] Guardando la version actual en "app-anterior" e instalando la nueva...
set "BK=%LOCALAPPDATA%\Ori\app-anterior"
if exist "%BK%" rmdir /s /q "%BK%"
xcopy /e /i /q /y "%APP%\backend" "%BK%\backend" >nul
xcopy /e /i /q /y "%APP%\frontend" "%BK%\frontend" >nul
copy /y "backend\*.py" "%APP%\backend\" >nul
rmdir /s /q "%APP%\frontend"
xcopy /e /i /q /y "_build\frontend" "%APP%\frontend" >nul

echo.
echo Listo. Abre Ori con el acceso directo de siempre.
echo (Si algo va mal, ejecuta volver-version-anterior.bat)
echo Tus documentos y conversaciones no se tocan: estan en %LOCALAPPDATA%\Ori\data
pause
exit /b 0

:error
echo.
echo Ha fallado la compilacion. Ori NO se ha modificado.
echo Haz una captura de lo de arriba y pasamela.
pause
exit /b 1
