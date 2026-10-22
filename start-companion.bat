@echo off
setlocal
cd /d "%~dp0pc-companion"

echo [StreamDeck] Companion ws://0.0.0.0:9137 - OBS ws://localhost:4455
echo Taruh mp3 di pc-companion\sounds\  atau POST http://PC:9137/upload

rem --- cari node: 1) bawaan ZIP, 2) PATH, 3) lokasi umum install ---
set "NODE="
if exist "%~dp0node.exe" set "NODE=%~dp0node.exe"
if not defined NODE for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE set "NODE=%%i"
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE=%LocalAppData%\Programs\nodejs\node.exe"
if not defined NODE if exist "%NVM_SYMLINK%\node.exe" set "NODE=%NVM_SYMLINK%\node.exe"
if not defined NODE for /d %%d in ("%AppData%\nvm\*") do if not defined NODE if exist "%%d\node.exe" set "NODE=%%d\node.exe"

if not defined NODE goto :nonode
echo [node] %NODE%

rem --- npm ada di folder yang sama dengan node ---
for %%n in ("%NODE%") do set "NODEDIR=%%~dpn"
set "NPM="
if exist "%NODEDIR%npm.cmd" set "NPM=%NODEDIR%npm.cmd"
if not defined NPM for /f "delims=" %%i in ('where npm 2^>nul') do if not defined NPM set "NPM=%%i"

if exist "node_modules\ws\package.json" goto :run
if not defined NPM goto :nonpm
echo node_modules belum ada - jalankan npm install...
call "%NPM%" install --omit=dev
if errorlevel 1 goto :npmfail

:run
"%NODE%" server.js
pause
exit /b 0

:nonode
echo ERROR: Node.js tidak ditemukan.
echo   - Install Node.js LTS: https://nodejs.org/en/download
echo   - Atau pakai ZIP portable dari Releases ^(sudah bawa node.exe^)
echo   - Atau taruh file node.exe manual di folder ini
pause
exit /b 1

:nonpm
echo ERROR: npm tidak ditemukan, jadi dependency tidak bisa di-install.
echo   - Install Node.js LTS: https://nodejs.org/en/download
echo   - Atau pakai ZIP portable dari Releases ^(node.exe + node_modules bawaan^)
pause
exit /b 1

:npmfail
echo npm install gagal - cek koneksi internet.
pause
exit /b 1
