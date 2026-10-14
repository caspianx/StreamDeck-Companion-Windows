import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { createObs } from "./obs.js";
import { createSound } from "./sound.js";

const CONFIG_PATH = new URL("./config.json", import.meta.url);
const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH));
const sound = createSound(cfg);
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
const obs = createObs(cfg.obs, (ok, err) => {
  obsState = { connected: ok, error: err || null };
  broadcast({ type: "obs.state", payload: obsState });
});

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-filename");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
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
    res.end('<a href="/preview">preview 5x3</a> · <a href="/status">/status</a> · <a href="/sounds">/sounds</a> · <a href="/buttons">/buttons</a>');
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("streamdeck companion ok. WS ws://IP:9137  GET /preview  GET /buttons  POST /buttons  GET /sounds  POST /upload (x-filename header)");
});

const wss = new WebSocketServer({ server });
function broadcast(obj) {
  const s = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
}
wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "obs.state", payload: obsState }));
  ws.send(JSON.stringify({ type: "obs.config", payload: obsSafe() }));
  ws.send(JSON.stringify({ type: "sounds.list", payload: sound.list() }));
  ws.send(JSON.stringify({ type: "deck.buttons", payload: loadButtons() }));
  ws.send(JSON.stringify({ type: "sound.state", payload: { playing: sound.isPlaying(), file: sound.curFile() } }));
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
      else if (action === "obs.list") { const r = await obs.list(); ws.send(JSON.stringify({ type: "obs.list", payload: r })); }
      else if (action === "sounds.list") { ws.send(JSON.stringify({ type: "sounds.list", payload: sound.list() })); }
      else ws.send(JSON.stringify({ type: "error", message: "unknown action " + action }));
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", action, message: e.message }));
    }
  });
});

server.listen(cfg.companionPort, "0.0.0.0", () => {
  console.log(`[companion] http+ws on 0.0.0.0:${cfg.companionPort}  sounds ${sound.dir}  obs ${cfg.obs.host}:${cfg.obs.port} -> ${obsState.connected ? "connected" : "waiting"}`);
});
