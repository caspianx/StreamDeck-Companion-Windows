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
  try {
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeExe -UseBasicParsing
  } catch {
    Write-Host "download fail $_ -> fallback ke node lokal"
    Remove-Item $NodeExe -Force -ErrorAction SilentlyContinue
    $Local = (Get-Command node -ErrorAction SilentlyContinue).Source
    if ($Local) { Copy-Item $Local $NodeExe -Force; Write-Host "[build] pakai node lokal $Local" }
    else { Write-Host "PERINGATAN: node.exe tidak ada, ZIP butuh Node terinstall di PC target" }
  }
}
Write-Host "[build] copy pc-companion"
Copy-Item "$PSScriptRoot\server.js","$PSScriptRoot\obs.js","$PSScriptRoot\sound.js","$PSScriptRoot\config.json","$PSScriptRoot\package.json" -Destination "$Dist\pc-companion\" -Force
Copy-Item "$PSScriptRoot\node_modules" "$Dist\pc-companion\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path "$PSScriptRoot\sounds\*") { Copy-Item "$PSScriptRoot\sounds\*" "$Dist\pc-companion\sounds\" -Force -ErrorAction SilentlyContinue } else { "" | Out-File "$Dist\pc-companion\sounds\.keep" }
if (Test-Path "$PSScriptRoot\images\*") { Copy-Item "$PSScriptRoot\images\*" "$Dist\pc-companion\images\" -Force -ErrorAction SilentlyContinue } else { "" | Out-File "$Dist\pc-companion\images\.keep" }
Write-Host "[build] copy start-companion.bat (sumber tunggal: repo root)"
Copy-Item "$Root\start-companion.bat" "$Dist\start-companion.bat" -Force
@"
StreamDeck Companion - Windows Portable
=======================================
1) Extract ZIP ini ke folder bebas (contoh D:\StreamDeck)
2) Double-klik start-companion.bat
3) Buka OBS Studio > Tools > WebSocket Server > Enable 4455 + password admin123 (atau edit pc-companion\config.json)
4) Di HP Android buka app StreamDeck, isi Companion IP (lihat ipconfig di PC), Test -> OBS terhubung
5) Cek server: http://PC_IP:9137/status

Tanpa install Node/npm (node.exe sudah satu paket di ZIP ini).
Butuh firewall Allow port 9137 pertama kali:
  netsh advfirewall firewall add rule name="StreamDeck9137" dir=in action=allow protocol=TCP localport=9137
"@ | Out-File -Encoding utf8 "$Dist\README.txt"
Write-Host "[build] zip $Zip"
if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path "$Dist\*" -DestinationPath $Zip -Force
$hash = (Get-FileHash $Zip -Algorithm SHA256).Hash.ToLower()
$hash | Out-File "$Zip.sha256" -Encoding ascii
Write-Host "[build] done $Zip"
Write-Host "sha256 $hash"
