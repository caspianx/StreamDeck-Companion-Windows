import fs from "fs";
import path from "path";
import http from "http";
import { exec, execSync } from "child_process";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { createObs } from "./obs.js";
import { createSound } from "./sound.js";

const CONFIG_PATH = new URL("./config.json", import.meta.url);
let cfg = JSON.parse(fs.readFileSync(CONFIG_PATH));
const sound = createSound(cfg);

const IMAGES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "images");
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

function listImages(){
  return fs.readdirSync(IMAGES_DIR)
    .filter(f => /\.(png|jpe?g|webp)$/i.test(f))
    .map(f => ({ file: f, path: path.join(IMAGES_DIR, f) }));
}
function imageContentType(f){
  const e = path.extname(f).toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  return "image/jpeg";
}

// --- App Scanning ---
let appsCache = { data: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

const EXCLUDE_REGEX = /(uninstall|unins\d*|batalkan|setup|installer|update|updater|helper|crash|reporter|service|daemon|driver|elevate|agent|host|cmd|powershell|wscript|cscript|vcredist|dxsetup|dotnet|worker|tool|handler|overlay|stub|hook|node|npm|python|ffmpeg|plugin|register|broker|proxy|diagnostics|test|patch|cli|console|bg_|dump|report|restart|rprt|tray|wscsvc|openssl|scheduler|launch|settings|setcad|setpasswd|msrdc|wsl|easyanticheat|fossilize|secure_desktop|steamxboxutil|x64launcher|x86launcher|steamsysinfo|writeminidump|ccxprocess|installuep|ieinstal|ielowutil|extexport|pingsender|minidump|telemetry|language preferences|upload center|configure java|about java|odbc|iscsi|active directory|dns|dfrgui|disk cleanup|group policy|recoverydrive|system configuration|system information|windows fax|steps recorder|quick assist|speech recognition|math input)/i;
const EXCLUDE_DIRS = ["common files", "windowsapps", "node_modules", "locales", "resources", "temp", "cache", "plugins", "driverstore", "microsoft", "windows", "system32", "syswow64"];

function scanStartMenuShortcuts() {
  const found = {};
  try {
    const psCode = `
$dirs = @(
  "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
  "$env:AppData\\Microsoft\\Windows\\Start Menu\\Programs",
  "$env:USERPROFILE\\Desktop",
  "C:\\Users\\Public\\Desktop"
)
$sh = New-Object -ComObject WScript.Shell
Get-ChildItem -Path $dirs -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    $target = $sh.CreateShortcut($_.FullName).TargetPath
    if ($target -and $target.EndsWith(".exe") -and (Test-Path $target)) {
      $name = $_.BaseName
      [Console]::WriteLine("$name|$target")
    }
  } catch {}
}
    `;
    const tmpPs = path.join(process.env.TEMP || "C:\\Windows\\Temp", "scan_lnk.ps1");
    fs.writeFileSync(tmpPs, psCode);
    const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPs}"`, { encoding: "utf8", timeout: 10000 });
    try { fs.unlinkSync(tmpPs); } catch {}

    for (const line of out.split(/\r?\n/)) {
      const parts = line.split("|");
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const target = parts.slice(1).join("|").trim();
        const exeName = path.basename(target);
        if (name && target && !EXCLUDE_REGEX.test(name) && !EXCLUDE_REGEX.test(exeName)) {
          found[name] = target;
        }
      }
    }
  } catch (e) {
    console.log("[scanApps] shortcut scan error:", e.message);
  }
  return found;
}

function scanApps() {
  const found = scanStartMenuShortcuts();

  const folders = [
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    path.join(process.env.LOCALAPPDATA || "", "Programs")
  ];
  const seen = new Set(Object.values(found));

  for (const folder of folders) {
    if (!fs.existsSync(folder)) continue;
    walkApps(folder, found, seen, 0, 2);
  }
  return found;
}

function walkApps(dir, found, seen, depth, maxDepth) {
  if (depth > maxDepth) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const lowerDir = entry.name.toLowerCase();
      if (EXCLUDE_DIRS.some(d => lowerDir.includes(d))) continue;
      walkApps(full, found, seen, depth + 1, maxDepth);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".exe")) {
      const name = path.basename(entry.name, ".exe");
      if (!EXCLUDE_REGEX.test(name) && !EXCLUDE_REGEX.test(entry.name)) {
        const key = name.charAt(0).toUpperCase() + name.slice(1);
        if (!seen.has(full)) {
          seen.add(full);
          if (!found[key]) {
            found[key] = full;
          }
        }
      }
    }
  }
}

function getApps() {
  const now = Date.now();
  if (appsCache.data && (now - appsCache.timestamp) < CACHE_TTL) {
    return appsCache.data;
  }
  appsCache.data = scanApps();
  appsCache.timestamp = now;
  return appsCache.data;
}

let obsState = { connected: false, error: null };
const obs = createObs(cfg.obs, (ok, err) => {
  obsState = { connected: ok, error: err || null };
  broadcast({ type: "obs.state", payload: obsState });
}, (list) => {
  broadcast({ type: "obs.list", payload: list });
});

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-filename");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.url === "/status" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      obs: obsState,
      sounds: sound.list().length,
      sound: { playing: sound.isPlaying(), file: sound.curFile() }
    }));
    return;
  }
  if (req.url === "/apps" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getApps()));
    return;
  }
  if (req.url.startsWith("/image/") && req.method === "GET") {
    const name = decodeURIComponent(req.url.slice(7).split("?")[0].split("/")[0]) || "";
    const safe = path.basename(name);
    const p = path.join(IMAGES_DIR, safe);
    if (!fs.existsSync(p) || !/\.(png|jpe?g|webp)$/i.test(safe)) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": imageContentType(safe), "Cache-Control": "public, max-age=86400" });
    fs.createReadStream(p).pipe(res);
    return;
  }
  if (req.url === "/image-upload" && req.method === "POST") {
    let data = Buffer.alloc(0);
    let tooLarge = false;
    req.on("data", c => { if (tooLarge) return; if (data.length + c.length > 2 * 1024 * 1024) { tooLarge = true; return; } data = Buffer.concat([data, c]); });
    req.on("end", () => {
      if (tooLarge) { res.writeHead(413, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "image >2MB" })); return; }
      const raw = req.headers["x-filename"] || `img-${Date.now()}.png`;
      let base = path.basename(String(raw));
      base = base.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (!/\.(png|jpe?g|webp)$/i.test(base)) base += ".png";
      const p = path.join(IMAGES_DIR, base);
      fs.writeFileSync(p, data);
      broadcast({ type: "images.list", payload: listImages() });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, file: base }));
    });
    return;
  }
  if ((req.url === "/upload" || req.url === "/sound-upload") && req.method === "POST") {
    let data = Buffer.alloc(0);
    let tooLarge = false;
    const maxSoundSize = 25 * 1024 * 1024;
    req.on("data", c => {
      if (tooLarge) return;
      if (data.length + c.length > maxSoundSize) { tooLarge = true; return; }
      data = Buffer.concat([data, c]);
    });
    req.on("end", () => {
      if (tooLarge) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "sound file >25MB" }));
        return;
      }
      const raw = req.headers["x-filename"] || `sound-${Date.now()}.mp3`;
      let base = path.basename(String(raw));
      base = base.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (!/\.(mp3|wav|ogg|m4a)$/i.test(base)) base += ".mp3";
      const p = path.join(sound.dir, base);
      fs.writeFileSync(p, data);
      broadcast({ type: "sounds.list", payload: sound.list() });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, file: base }));
    });
    return;
  }
  if (req.url === "/obs-config" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    const c = obs.getConfig();
    res.end(JSON.stringify({ host: c.host, port: c.port, hasPassword: !!c.password }));
    return;
  }
  if (req.url === "/obs-config" && req.method === "POST") {
    let bodyStr = "";
    req.on("data", chunk => { bodyStr += chunk; });
    req.on("end", async () => {
      try {
        const body = JSON.parse(bodyStr);
        const updated = await obs.setConfig({
          host: body.host || cfg.obs.host,
          port: Number(body.port) || cfg.obs.port,
          password: (body.password !== undefined && body.password !== "") ? body.password : cfg.obs.password
        });
        cfg.obs = updated;
        try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); } catch {}
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, connected: obs.isConnected(), hasPassword: !!updated.password }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || "Gagal simpan OBS" }));
      }
    });
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

const wss = new WebSocketServer({ server });
function broadcast(obj) {
  const s = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
}
wss.on("connection", async ws => {
  ws.send(JSON.stringify({ type: "obs.state", payload: obsState }));
  ws.send(JSON.stringify({ type: "obs.config", payload: { host: cfg.obs.host, port: cfg.obs.port, hasPassword: !!cfg.obs.password } }));
  ws.send(JSON.stringify({ type: "sounds.list", payload: sound.list() }));
  ws.send(JSON.stringify({ type: "sound.state", payload: { playing: sound.isPlaying(), file: sound.curFile() } }));
  try {
    if (obs.isConnected()) { const r = await obs.list(); ws.send(JSON.stringify({ type: "obs.list", payload: r })); }
  } catch {}
  ws.on("message", async raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const { action, payload } = msg;
    try {
      if (action === "obs.setScene") { await obs.setScene(payload.scene); ws.send(JSON.stringify({ type: "ok", action })); }
      else if (action === "obs.config") {
        const updated = await obs.setConfig({
          host: payload.host || cfg.obs.host,
          port: Number(payload.port) || cfg.obs.port,
          password: (payload.password !== undefined && payload.password !== "") ? payload.password : cfg.obs.password
        });
        cfg.obs = updated;
        try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); } catch {}
        broadcast({ type: "obs.config", payload: { host: cfg.obs.host, port: cfg.obs.port, hasPassword: !!cfg.obs.password } });
        if (obs.isConnected()) { const r = await obs.list(); broadcast({ type: "obs.list", payload: r }); }
        ws.send(JSON.stringify({ type: "ok", action, connected: obs.isConnected() }));
      }
      else if (action === "obs.toggleMute") { await obs.toggleMute(payload.input); ws.send(JSON.stringify({ type: "ok", action })); }
      else if (action === "obs.toggleSource") { await obs.toggleSource(payload.scene, payload.source); ws.send(JSON.stringify({ type: "ok", action })); }
      else if (action === "sound.play") {
        if (sound.isPlaying()) { ws.send(JSON.stringify({ type: "error", action, message: "sedang memutar " + (sound.curFile()||"") + " — tunggu selesai" })); return; }
        broadcast({ type: "sound.state", payload: { playing: true, file: payload.file } });
        try { await sound.play(payload.file); ws.send(JSON.stringify({ type: "ok", action })); }
        finally { broadcast({ type: "sound.state", payload: { playing: false, file: null } }); }
      }
      else if (action === "system.openApp") {
        const appPath = payload.path;
        if (appPath) {
          exec(`start "" "${appPath}"`, (err) => {
            if (err) ws.send(JSON.stringify({ type: "error", action, message: err.message }));
            else ws.send(JSON.stringify({ type: "ok", action }));
          });
        }
      }
      else if (action === "system.volume") {
        const type = payload.type;
        const psCmd = (type === "up") ? "175" : (type === "down") ? "174" : "173";
        exec(`powershell -command "$wscript = New-Object -ComObject WScript.Shell; $wscript.SendKeys([char]${psCmd})"`);
        ws.send(JSON.stringify({ type: "ok", action }));
      }
      else if (action === "system.media") {
        const type = payload.type;
        const psCmd = (type === "play_pause") ? "179" : (type === "next") ? "176" : "177";
        exec(`powershell -command "$wscript = New-Object -ComObject WScript.Shell; $wscript.SendKeys([char]${psCmd})"`);
        ws.send(JSON.stringify({ type: "ok", action }));
      }
      else if (action === "apps.scan") {
        appsCache.data = null; // force refresh
        const apps = getApps();
        ws.send(JSON.stringify({ type: "apps.list", payload: apps }));
      }
      else if (action === "apps.list") {
        ws.send(JSON.stringify({ type: "apps.list", payload: appsCache.data || {} }));
      }
      else ws.send(JSON.stringify({ type: "error", message: "unknown action " + action }));
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", action, message: e.message }));
    }
  });
});

server.listen(cfg.companionPort, "0.0.0.0", () => {
  console.log(`[companion] receiver running on 0.0.0.0:${cfg.companionPort}  obs ${cfg.obs.host}:${cfg.obs.port} -> ${obsState.connected ? "connected" : "waiting"}`);
});
