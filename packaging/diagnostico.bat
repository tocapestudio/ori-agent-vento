@echo off
setlocal
set "ORI=%LOCALAPPDATA%\Ori"
set "OUT=%TEMP%\ori-diagnostico"
echo Recopilando el diagnostico de Ori, espera unos segundos...
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\logs"
xcopy /y /q "%ORI%\data\logs\*" "%OUT%\logs\" >nul 2>&1
copy /y "%ORI%\data\run.json" "%OUT%\" >nul 2>&1
(
  echo === Fecha ===
  date /t
  time /t
  echo === Windows ===
  ver
  echo === Carpeta ===
  echo %ORI%
  echo === Puertos 8765 y 27718 ===
  netstat -ano | findstr ":8765 :27718"
  echo === Procesos ===
  tasklist | findstr /i "mongod python"
  echo === python311._pth ===
  type "%ORI%\app\python\python311._pth"
  echo === DLL ===
  dir /b "%ORI%\app\python\*.dll"
  dir /b "%ORI%\app\mongodb"
) > "%OUT%\sistema.txt" 2>&1
"%ORI%\app\python\python.exe" -c "import sys; print(sys.version); print(sys.path); import onnxruntime, fastembed, pymongo, fitz, fastapi, uvicorn; print('imports OK', onnxruntime.__version__)" > "%OUT%\python.txt" 2>&1
"%ORI%\app\mongodb\mongod.exe" --version > "%OUT%\mongod.txt" 2>&1
echo codigo %errorlevel% >> "%OUT%\mongod.txt"
powershell -NoProfile -Command "$d=[Environment]::GetFolderPath('Desktop'); $f=Join-Path $d ('Ori-diagnostico-'+(Get-Date -Format 'yyyyMMdd-HHmm')+'.zip'); Compress-Archive -Path '%OUT%\*' -DestinationPath $f -Force; Write-Host ''; Write-Host ('Listo. Envia este archivo: '+$f)"
echo.
pause
