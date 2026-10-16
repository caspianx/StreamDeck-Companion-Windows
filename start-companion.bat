@echo off
setlocal
cd /d "%~dp0pc-companion"
echo [StreamDeck] Companion ws://0.0.0.0:9137 - OBS ws://localhost:4455
echo Taruh mp3 di pc-companion\sounds\  atau POST http://PC:9137/upload
if exist "%~dp0node.exe" (
  echo [portable] pakai node.exe bawaan ZIP...
  "%~dp0node.exe" server.js
  goto :end
)
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: Node.js tidak ketemu.
  echo Solusi: download ZIP dari Releases ^(bawa node.exe portable^), bukan Code - Download ZIP.
  echo Link: https://github.com/caspianx/StreamDeck-Companion-Windows/releases
  pause
  exit /b 1
)
if not exist "node_modules\ws\package.json" (
  echo node_modules belum ada - jalankan npm install...
  call npm install --omit=dev
  if %errorlevel% neq 0 (
    echo npm install gagal - cek koneksi internet.
    pause
    exit /b 1
  )
)
node server.js
:end
pause
