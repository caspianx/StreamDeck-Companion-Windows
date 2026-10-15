import fs from "fs";
import path from "path";
import http from "http";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { createObs } from "./obs.js";
import { createSound } from "./sound.js";

const CONFIG_PATH = new URL("./config.json", import.meta.url);
const APPS_PATH = new URL("./apps.json", import.meta.url);
const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH));
const apps = JSON.parse(fs.readFileSync(APPS_PATH));
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
let obsState = { connected: false, error: null };
const DEFAULT_BUTTONS = [
  { id:0,label:"SCENE\nMAIN",colorHex:0xFF1A1C2E,icon:"person",action:"obs.setScene",payload:{scene:"SCENE MAIN"} },
  { id:1,label:"SCENE\nEND",colorHex:0xFFE53935,icon:"window",action:"obs.setScene",payload:{scene:"SCENE END"} },
  { id:2,label:"SCENE\nSEDIH",colorHex:0xFFE53935,icon:"window",action:"obs.setScene",payload:{scene:"SCENE SEDIH"} },
  { id:3,label:"MUTE\nMIC",colorHex:0xFFE53935,icon:"mic_off",action:"obs.toggleMute",payload:{input:"Mic/Aux"} },
  { id:4,label:"Webcam",colorHex:0xFFE53935,icon:"cam_off",action:"obs.toggleSource",payload:{scene:"SCENE MAIN",source:"Webcam"} },
  { id:5,label:"SCENE\nKESEL",colorHex:0xFFE53935,icon:"window",action:"obs.setScene",payload:{scene:"SCENE KESEL"} },
  { id:6,label:"JJ\nSHIKAD",colorHex:0xFF1DE9B6,icon:"window",action:"sound.play",payload:{file:"jj_shikad.mp3"} },
  { id:7,label:"DUIT",colorHex:0xFF1DE9B6,icon:"window",action:"sound.play",payload:{file:"duit.mp3"} },
  { id:8,label:"CEPEK",colorHex:0xFF1DE9B6,icon:"window",action:"sound.play",payload:{file:"cepek.mp3"} },
  { id:9,label:"LOVE\nORANGE",colorHex:0xFF1DE9B6,icon:"window",action:"sound.play",payload:{file:"love_orange.mp3"} },
  { id:10,label:"DUAR",colorHex:0xFF1DE9B6,icon:"window",action:"sound.play",payload:{file:"duar.mp3"} },
  { id:11,label:"KETAWA",colorHex:0xFF2962FF,icon:"play",action:"sound.play",payload:{file:"ketawa.mp3"} },
  { id:12,label:"tegang",colorHex:0xFF2962FF,icon:"play",action:"sound.play",payload:{file:"tegang.mp3"} },
  { id:13,label:"chuaks",colorHex:0xFF2962FF,icon:"play",action:"sound.play",payload:{file:"chuaks.mp3"} },
  { id:14,label:"akh",colorHex:0xFF2962FF,icon:"play",action:"sound.play",payload:{file:"akh.mp3"} },
];
const BTN_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "buttons.json");
function loadButtons(){ try{ if(fs.existsSync(BTN_FILE)) return JSON.parse(fs.readFileSync(BTN_FILE,"utf8")); }catch{} return DEFAULT_BUTTONS; }
function saveButtons(b){ fs.writeFileSync(BTN_FILE, JSON.stringify(b,null,2)); }
function obsSafe(){ return { host: cfg.obs.host, port: cfg.obs.port, hasPassword: !!cfg.obs.password }; }
function saveObsConfig(next){ cfg.obs = { ...cfg.obs, ...next }; fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); }
let lastObsList = null;
const obs = createObs(cfg.obs, (ok, err) => {
  obsState = { connected: ok, error: err || null };
  broadcast({ type: "obs.state", payload: obsState });
}, (list) => {
  lastObsList = list;
  broadcast({ type: "obs.list", payload: list });
});


const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-filename");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.url === "/apps" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    try {
      const appsData = JSON.parse(fs.readFileSync(APPS_PATH, "utf8"));
      res.end(JSON.stringify(appsData));
    } catch {
      res.end(JSON.stringify({}));
    }
    return;
  }
  if (req.url.startsWith("/image/") && req.method === "GET") {
    const name = decodeURIComponent(req.url.slice(7).split("?")[0].split("/")[0] || "");
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
  if (req.url === "/obs-config" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obsSafe()));
    return;
  }
  if (req.url === "/obs-config" && req.method === "POST") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const j = JSON.parse(body || "{}");
        const next = {};
        if (j.host !== undefined) {
          const h = String(j.host).trim();
          if (!h || h.length > 253) throw new Error("bad host");
          next.host = h;
        }
        if (j.port !== undefined) {
          const p = Number(j.port);
          if (!Number.isInteger(p) || p < 1 || p > 65535) throw new Error("bad port");
          next.port = p;
        }
        if (j.password !== undefined) {
          const pw = String(j.password);
          if (pw.length > 64) throw new Error("password 0..64");
          next.password = pw;
        }
        if (Object.keys(next).length === 0) throw new Error("empty");
        const before = { ...cfg.obs };
        try {
          await obs.setConfig(next);
          saveObsConfig(next);
          broadcast({ type: "obs.config", payload: obsSafe() });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, ...obsSafe(), obs: obsState }));
        } catch (e) {
          try { await obs.setConfig(before); } catch {}
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message || "obs connect fail" }));
        }
      } catch (e) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }
  if (req.url === "/buttons" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(loadButtons()));
    return;
  }
  if (req.url === "/buttons" && req.method === "POST") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try {
        const b = JSON.parse(body);
        if (!Array.isArray(b) || b.length < 1 || b.length > 30) throw new Error("need 1..30 buttons");
        const icons = new Set(["grid","window","person","mic_off","cam_off","play","mic","volume","light","star"]);
        const actions = new Set(["obs.setScene","obs.toggleMute","obs.toggleSource","sound.play"]);
        const ids = new Set();
        for (const x of b) {
          if (typeof x.id !== "number" || ids.has(x.id)) throw new Error("bad id");
          ids.add(x.id);
          const l = String(x.label || "").trim();
          if (!l || l.length > 30) throw new Error("label 1..30");
          x.label = l;
          if (typeof x.colorHex !== "number" || x.colorHex < 0xFF000000 || x.colorHex > 0xFFFFFFFF) throw new Error("bad colorHex");
          if (!icons.has(x.icon)) throw new Error("bad icon " + x.icon);
          if (!actions.has(x.action)) throw new Error("bad action");
          if (typeof x.payload !== "object" || x.payload === null) throw new Error("bad payload");
          if (x.image != null) {
            if (typeof x.image !== "string" || !/\.(png|jpe?g|webp)$/i.test(x.image)) throw new Error("bad image");
            x.image = path.basename(x.image);
          } else x.image = null;
        }
        saveButtons(b);
        broadcast({ type: "deck.buttons", payload: b });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }
  if (req.url === "/preview" && req.method === "GET") {
    try { const h = fs.readFileSync(new URL("./preview.html", import.meta.url)); res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(h); } catch { res.writeHead(404); res.end("preview.html not found"); }
    return;
  }
  if (req.url === "/sounds" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(sound.list()));
    return;
  }
  if (req.url === "/status" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ obs: obsState, sounds: sound.list().length, sound: { playing: sound.isPlaying(), file: sound.curFile() } }));
    return;
  }
  if (req.url === "/upload" && req.method === "POST") {
    let data = Buffer.alloc(0);
    let tooLarge = false;
    req.on("data", c => {
      if (tooLarge) return;
      if (data.length + c.length > 20 * 1024 * 1024) { tooLarge = true; return; }
      data = Buffer.concat([data, c]);
    });
    req.on("end", () => {
      if (tooLarge) { res.writeHead(413, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "file >20MB" })); return; }
      const raw = req.headers["x-filename"] || `upload-${Date.now()}.mp3`;
      const base = path.basename(String(raw));
      if (!/\.(mp3|wav|ogg|m4a)$/i.test(base)) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "bad ext need mp3/wav/ogg/m4a" })); return; }
      const p = path.join(sound.dir, base);
      fs.writeFileSync(p, data);
      broadcast({ type: "sounds.list", payload: sound.list() });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, file: path.basename(p) }));
    });
    return;
  }
  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end('<a href="/preview">preview 5x3</a> · <a href="/status">/status</a> · <a href="/sounds">/sounds</a> · <a href="/images">/images</a> · <a href="/buttons">/buttons</a>');
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("streamdeck companion ok. WS ws://IP:9137  GET /preview  GET /buttons  POST /buttons  GET /sounds  POST /upload  GET /images  POST /image-upload");
});

const wss = new WebSocketServer({ server });
function broadcast(obj) {
  const s = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
}
wss.on("connection", async ws => {
  ws.send(JSON.stringify({ type: "obs.state", payload: obsState }));
  ws.send(JSON.stringify({ type: "obs.config", payload: obsSafe() }));
  ws.send(JSON.stringify({ type: "sounds.list", payload: sound.list() }));
  ws.send(JSON.stringify({ type: "images.list", payload: listImages() }));
  ws.send(JSON.stringify({ type: "deck.buttons", payload: loadButtons() }));
  ws.send(JSON.stringify({ type: "sound.state", payload: { playing: sound.isPlaying(), file: sound.curFile() } }));
  try {
    const appsData = JSON.parse(fs.readFileSync(APPS_PATH, "utf8"));
    ws.send(JSON.stringify({ type: "apps.list", payload: appsData }));
  } catch {}
  try {
    if (lastObsList) ws.send(JSON.stringify({ type: "obs.list", payload: lastObsList }));
    else if (obs.isConnected()) { const r = await obs.list(); lastObsList = r; ws.send(JSON.stringify({ type: "obs.list", payload: r })); }
  } catch {}
  ws.on("message", async raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const { action, payload } = msg;
    try {
      if (action === "obs.setScene") { await obs.setScene(payload.scene); ws.send(JSON.stringify({ type: "ok", action })); }
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
          exec(`start "" "${appPath.replace(/"/g, '\\"')}"`, (err) => {
            if (err) ws.send(JSON.stringify({ type: "error", action, message: err.message }));
            else ws.send(JSON.stringify({ type: "ok", action }));
          });
        }
      }
      else if (action === "system.volume") {
        const type = payload.type;
        const psCmd = if (type === "up") "175" else if (type === "down") "174" else "173";
        exec(`powershell -command "$wscript = New-Object -ComObject WScript.Shell; $wscript.SendKeys([char]${psCmd})"`);
        ws.send(JSON.stringify({ type: "ok", action }));
      }
      else if (action === "system.media") {
        const type = payload.type;
        const psCmd = if (type === "play_pause") "179" else if (type === "next") "176" else "177";
        exec(`powershell -command "$wscript = New-Object -ComObject WScript.Shell; $wscript.SendKeys([char]${psCmd})"`);
        ws.send(JSON.stringify({ type: "ok", action }));
      }
      else if (action === "apps.list") {
        try {
          const appsData = JSON.parse(fs.readFileSync(APPS_PATH, "utf8"));
          ws.send(JSON.stringify({ type: "apps.list", payload: appsData }));
        } catch {}
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
        if (type === "up") exec(`powershell -command "$wscript = New-Object -ComObject WScript.Shell; $wscript.SendKeys([char]175)"`);
        else if (type === "down") exec(`powershell -command "$wscript = New-Object -ComObject WScript.Shell; $wscript.SendKeys([char]174)"`);
        else if (type === "mute") exec(`powershell -command "$wscript = New-Object -ComObject WScript.Shell; $wscript.SendKeys([char]173)"`);
        ws.send(JSON.stringify({ type: "ok", action }));
      }
      else if (action === "system.media") {
        const type = payload.type;
        if (type === "play_pause") exec(`powershell -command "$wscript = New-Object -ComObject WScript.Shell; $wscript.SendKeys([char]179)"`);
        else if (type === "next") exec(`powershell -command "$wscript = New-Object -ComObject WScript.Shell; $wscript.SendKeys([char]176)"`);
        else if (type === "prev") exec(`powershell -command "$wscript = New-Object -ComObject WScript.Shell; $wscript.SendKeys([char]177)"`);
        ws.send(JSON.stringify({ type: "ok", action }));
      }
      else ws.send(JSON.stringify({ type: "error", message: "unknown action " + action }));
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", action, message: e.message }));
    }
  });
});

server.listen(cfg.companionPort, "0.0.0.0", () => {
  console.log(`[companion] http+ws on 0.0.0.0:${cfg.companionPort}  sounds ${sound.dir}  obs ${cfg.obs.host}:${cfg.obs.port} -> ${obsState.connected ? "connected" : "waiting"}`);
});
