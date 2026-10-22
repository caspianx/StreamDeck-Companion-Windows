# StreamDeck Companion — Windows Portable

Companion PC untuk StreamDeck Android (OBS + soundboard + kontrol Windows). Tanpa `npm install` — download ZIP, klik jalan.

## Download (tanpa coding)

**Pilih yang benar — ini yang bikin "Node.js tidak ditemukan":**

| Yang diunduh | Isi | Perlu Node.js di PC? |
|---|---|---|
| **Releases** → `StreamDeck-Companion-Windows.zip` | `node.exe` + `node_modules` + server | **Tidak** |
| **Code → Download ZIP** | source saja (tanpa `node.exe`, tanpa `node_modules`) | **Ya** |

1. Buka https://github.com/caspianx/StreamDeck-Companion-Windows → tab **Releases** → download `StreamDeck-Companion-Windows.zip`
   - Releases kosong? Belum ada ZIP yang di-publish. Bikin sendiri di PC yang ada Node.js: `./pc-companion/build-portable.ps1` (lihat "Build ZIP portable sendiri").
2. Extract → double-klik `start-companion.bat` (biarkan jalan)
3. OBS Studio → Tools → WebSocket Server → Enable 4455 + password `admin123` (atau edit `pc-companion\config.json`)
4. Cek `http://localhost:9137/status` → JSON `{"obs":...,"sounds":N}` = server hidup
5. HP Android 1 WiFi sama PC → isi Companion IP `192.168.x.x` di APK → Test → OBS terhubung (dot hijau)

Firewall pertama kali: `netsh advfirewall firewall add rule name="StreamDeck9137" dir=in action=allow protocol=TCP localport=9137`

## Gagal: "Node.js tidak ditemukan"

`.bat` itu nyari Node di: `node.exe` bawaan ZIP → `PATH` → `C:\Program Files\nodejs` → `C:\Program Files (x86)\nodejs` → `%LOCALAPPDATA%\Programs\nodejs` → `%NVM_SYMLINK%` → `%APPDATA%\nvm\*`. Kalau semua gagal:

- Install Node.js LTS: https://nodejs.org/en/download → **tutup & buka lagi terminal** → jalankan ulang `.bat`
- Atau pakai ZIP dari **Releases** (sudah bawa `node.exe` + `node_modules`)
- Atau taruh `node.exe` manual di folder yang sama dengan `start-companion.bat`

Kalau errornya `Cannot find module 'ws'` → `node_modules` belum ada. Dari folder `pc-companion`: `npm install --omit=dev`.

## Isi ZIP
`node.exe` (portable) + `pc-companion/server.js,obs.js,sound.js,config.json,package.json,node_modules/,sounds/,images/` + `start-companion.bat` + `README.txt`

## Build ZIP portable sendiri (tanpa GitHub)
Butuh PC dengan Node.js + internet (butuh download `node.exe` dari nodejs.org):
```powershell
./pc-companion/build-portable.ps1  # -> dist/StreamDeck-Companion-Windows.zip + .sha256
```
Kalau offline, `node.exe` lokal otomatis dipakai sebagai cadangan. ZIP ini bisa langsung dipindah ke PC lain (extract + klik, tanpa Node.js, tanpa internet).

## Protokol WS ws://PC:9137
Action: `obs.setScene {scene}` | `obs.config {host,port,password}` | `obs.toggleMute {input}` | `obs.toggleSource {scene,source}` | `sound.play {file}` | `system.openApp {path}` | `system.volume {type:up\|down\|mute}` | `system.media {type:play_pause\|next\|prev}` | `apps.scan`
Push: `obs.state` | `obs.config` | `obs.list` | `sounds.list` | `sound.state` | `ok` | `error`
HTTP: `GET /status /health /apps /image/:name` · `POST /upload /image-upload /obs-config`
