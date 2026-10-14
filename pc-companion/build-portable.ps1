$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Dist = Join-Path $Root "dist\StreamDeck-Companion-Windows"
$Zip  = Join-Path $Root "dist\StreamDeck-Companion-Windows.zip"
$NodeVer = "v20.18.0"
$NodeUrl = "https://nodejs.org/dist/$NodeVer/win-x64/node.exe"
Write-Host "[build] clean dist"
if (Test-Path $Dist) { Remove-Item $Dist -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Dist | Out-Null
New-Item -ItemType Directory -Force -Path "$Dist\pc-companion\sounds" | Out-Null
New-Item -ItemType Directory -Force -Path "$Dist\pc-companion\images" | Out-Null
Write-Host "[build] npm install (offline bundle)"
Push-Location $PSScriptRoot
if (-not (Test-Path "node_modules")) { npm install --omit=dev 2>&1 | Out-Host }
Pop-Location
Write-Host "[build] download node.exe $NodeVer"
$NodeExe = Join-Path $Dist "node.exe"
if (-not (Test-Path $NodeExe)) {
  try { Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeExe -UseBasicParsing } catch { Write-Host "download fail $_ -> skip, zip will use system node"; Remove-Item $NodeExe -Force -ErrorAction SilentlyContinue }
}
Write-Host "[build] copy pc-companion"
Copy-Item "$PSScriptRoot\server.js","$PSScriptRoot\obs.js","$PSScriptRoot\sound.js","$PSScriptRoot\config.json","$PSScriptRoot\preview.html","$PSScriptRoot\package.json" -Destination "$Dist\pc-companion\" -Force
if (Test-Path "$PSScriptRoot\buttons.json") { Copy-Item "$PSScriptRoot\buttons.json" "$Dist\pc-companion\" -Force }
Copy-Item "$PSScriptRoot\node_modules" "$Dist\pc-companion\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path "$PSScriptRoot\sounds\*") { Copy-Item "$PSScriptRoot\sounds\*" "$Dist\pc-companion\sounds\" -Force -ErrorAction SilentlyContinue } else { "" | Out-File "$Dist\pc-companion\sounds\.keep" }
if (Test-Path "$PSScriptRoot\images\*") { Copy-Item "$PSScriptRoot\images\*" "$Dist\pc-companion\images\" -Force -ErrorAction SilentlyContinue } else { "" | Out-File "$Dist\pc-companion\images\.keep" }
@"
@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0node.exe" ( set NODE=%~dp0node.exe ) else ( set NODE=node )
echo [StreamDeck] Companion ws://0.0.0.0:9137 - OBS ws://localhost:4455
echo Jika gagal: buka Notepad pc-companion\config.json ganti password OBS
echo Preview: http://localhost:9137/preview  Status: http://localhost:9137/status
"%NODE%" "%~dp0pc-companion\server.js"
pause
"@ | Out-File -Encoding ascii "$Dist\start-companion.bat"
@"
StreamDeck Companion - Windows Portable
=======================================
1) Extract ZIP ini ke folder bebas (contoh D:\StreamDeck)
2) Double-klik start-companion.bat
3) Buka OBS Studio > Tools > WebSocket Server > Enable 4455 + password admin123 (atau edit pc-companion\config.json)
4) Di HP Android buka app StreamDeck, isi Companion IP (lihat ipconfig di PC), Test -> OBS terhubung
5) Preview browser: http://PC_IP:9137/preview

Tanpa install Node/npm. Butuh firewall Allow port 9137 pertama kali.
GitHub: https://github.com/caspianx/StreamDeck-Companion-Windows
"@ | Out-File -Encoding utf8 "$Dist\README.txt"
Write-Host "[build] zip $Zip"
if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path "$Dist\*" -DestinationPath $Zip -Force
$hash = (Get-FileHash $Zip -Algorithm SHA256).Hash.ToLower()
$hash | Out-File "$Zip.sha256" -Encoding ascii
Write-Host "[build] done $Zip"
Write-Host "sha256 $hash"
