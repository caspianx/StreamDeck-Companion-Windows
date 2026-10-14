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
      if (playing) throw new Error("sedang memutar");
      const p = path.resolve(dir, file);
      if (!fs.existsSync(p)) throw new Error(`Not found: ${file}`);
      playing = true; curFile = file;
      return player.play(p).finally(() => { playing = false; curFile = null; });
    }
  };
}
