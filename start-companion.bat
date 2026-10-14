@echo off
cd /d "%~dp0pc-companion"
echo [StreamDeck] Companion ws://0.0.0.0:9137 - OBS ws://localhost:4455
echo Taruh mp3 di pc-companion\sounds\  atau POST http://PC:9137/upload
node server.js
pause
