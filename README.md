# StreamDeck — HP jadi Remote OBS + Soundboard (Windows)

Grid 5×3 swipe 2 halaman (max 30 tombol), edit warna/icon/nama/fungsi tanpa koding, sync web ↔ HP via Companion.

## Cara cepat (tanpa coding) — Portable ZIP
Tanpa `npm install`. Download dari GitHub Releases:

1. Buka https://github.com/caspianx/StreamDeck-Companion-Windows/releases → download `StreamDeck-Companion-Windows.zip`
2. Extract → double-klik `start-companion.bat` (biarkan jalan)
3. OBS Studio → Tools → WebSocket Server → Enable 4455 + password `admin123` (atau edit `pc-companion/config.json`)
4. Cek `http://localhost:9137/preview` — swipe, pilih file upload, klik play bunyi di PC
5. HP 1 WiFi sama PC → install APK → first-launch gate → isi Companion IP → Test → OBS terhubung (door hijau)

Firewall pertama kali: `netsh advfirewall firewall add rule name="StreamDeck9137" dir=in action=allow protocol=TCP localport=9137`

## Struktur
- `pc-companion/` Node WS `9137` → OBS WS `4455` + `sound-play` PC + `buttons.json` sync + upload `mp3/wav/ogg/m4a` 20MB
- `android/` Kotlin Compose — swipe `HorizontalPager` 15/hal, long-press edit warna/icon/label/action, picker upload ke PC, lock `sound.state` global
- `pc-companion/preview.html` — `http://PC:9137/preview` mirror grid di browser
- `dist/` — hasil `build-portable.ps1` (ZIP + node.exe bundle)

## Developer — build portable
```powershell
./pc-companion/build-portable.ps1  # -> dist/StreamDeck-Companion-Windows.zip + .sha256
```

## Developer — companion manual
```
cd pc-companion && npm install && npm start
curl http://localhost:9137/status
curl http://localhost:9137/buttons
POST /upload  header x-filename: file.mp3  body: raw bytes
```

## Android
Butuh JDK 17 + Android SDK. Buka `D:\streamdeck\android` di Android Studio → Sync → Run. First-launch menampilkan gate GitHub (soft gate — bisa Lanjut Demo tanpa PC untuk review Play Store). `GITHUB_URL` di `ButtonConfig.kt`.

## Protokol WS ws://PC:9137
`obs.setScene {scene}` | `obs.toggleMute {input}` | `obs.toggleSource {scene,source}` | `sound.play {file}` | `obs.list` | `sounds.list` | `deck.buttons` | `sound.state {playing,file}` | `obs.state` dot hijau

## Play Store
Upload `bundleRelease`, link companion ke GitHub Releases, privacy policy (INTERNET only).
