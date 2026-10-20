# StreamDeck Companion — Windows Portable

Companion PC untuk StreamDeck Android (OBS + soundboard). Tanpa `npm install` — download ZIP, klik jalan.

## Download (tanpa coding)
1. Buka https://github.com/caspianx/StreamDeck-Companion-Windows → download `StreamDeck-Companion-Windows.zip` (Releases)
2. Extract → double-klik `start-companion.bat` (biarkan jalan)
3. OBS Studio → Tools → WebSocket Server → Enable 4455 + password `admin123` (atau edit `Password Pada Websocket OBS`)
4. Cek `http://localhost:9137/preview` — grid 5×3 swipe 2 halaman, upload mp3, play bunyi di PC
5. HP Android 1 WiFi sama PC → isi Companion IP `192.168.x.x` di APK → Test → OBS terhubung (dot hijau)

Firewall pertama kali: `netsh advfirewall firewall add rule name="StreamDeck9137" dir=in action=allow protocol=TCP localport=9137`

## Isi ZIP
`node.exe` (portable) + `pc-companion/server.js,obs.js,sound.js,config.json,preview.html,buttons.json,sounds/` + `start-companion.bat` + `README.txt`

## Developer — build portable
```powershell
./pc-companion/build-portable.ps1  # -> dist/StreamDeck-Companion-Windows.zip + .sha256
```

## Protokol WS ws://PC:9137
`obs.setScene {scene}` | `obs.toggleMute {input}` | `obs.toggleSource {scene,source}` | `sound.play {file}` | `obs.list` | `sounds.list` | `deck.buttons` | `sound.state {playing,file}` | `obs.state` · HTTP `GET /status /buttons /sounds /preview` `POST /buttons /upload`
