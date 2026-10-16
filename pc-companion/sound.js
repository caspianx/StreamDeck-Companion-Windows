import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import player from "sound-play";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export function createSound(cfg) {
  const dir = path.resolve(__dirname, cfg.soundsDir || "./sounds");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let playing = false;
  let curFile = null;
  return {
    dir,
    isPlaying: () => playing,
    curFile: () => curFile,
    list() {
      return fs.readdirSync(dir)
        .filter(f => /\.(mp3|wav|ogg|m4a)$/i.test(f))
        .map(f => ({ file: f, path: path.join(dir, f) }));
    },
    play(file) {
      if (!file) throw new Error("Nama file audio kosong");
      if (playing) throw new Error("sedang memutar");
      let p = path.resolve(dir, file);
      if (!fs.existsSync(p)) {
        try {
          const list = fs.readdirSync(dir);
          const match = list.find(f => f.toLowerCase() === file.toLowerCase() || path.parse(f).name.toLowerCase() === file.toLowerCase());
          if (match) p = path.resolve(dir, match);
          else throw new Error(`File audio '${file}' tidak ditemukan di folder sounds PC`);
        } catch (e) {
          throw new Error(`File audio '${file}' tidak ditemukan di folder sounds PC (${e.message})`);
        }
      }
      playing = true; curFile = file;
      return player.play(p).finally(() => { playing = false; curFile = null; });
    }
  };
}
