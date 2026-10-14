import OBSWebSocket from "obs-websocket-js";
export function createObs(cfg, onState) {
  const obs = new OBSWebSocket();
  let connected = false;
  async function connect() {
    const url = `ws://${cfg.host}:${cfg.port}`;
    try {
      await obs.connect(url, cfg.password || undefined);
      connected = true;
      onState?.(true);
      console.log("[OBS] connected", url);
    } catch (e) {
      connected = false;
      onState?.(false, e.message);
      console.log("[OBS] connect fail:", e.message);
    }
  }
  obs.on("ConnectionClosed", () => { connected = false; onState?.(false, "closed"); });
  obs.on("ConnectionError", () => { connected = false; onState?.(false, "error"); });
  connect();
  setInterval(() => { if (!connected) connect(); }, 5000);
  return {
    isConnected: () => connected,
    async list() {
      const scenes = await obs.call("GetSceneList").catch(() => ({ scenes: [] }));
      const inputs = await obs.call("GetInputList").catch(() => ({ inputs: [] }));
      const cur = await obs.call("GetCurrentProgramScene").catch(() => ({}));
      let sceneItems = [];
      if (cur.currentProgramSceneName) {
        const r = await obs.call("GetSceneItemList", { sceneName: cur.currentProgramSceneName }).catch(() => ({ sceneItems: [] }));
        sceneItems = r.sceneItems || [];
      }
      return {
        scenes: (scenes.scenes || []).map(s => s.sceneName),
        inputs: (inputs.inputs || []).map(i => ({ name: i.inputName, kind: i.inputKind })),
        sceneItems: sceneItems.map(s => ({ id: s.sceneItemId, source: s.sourceName })),
        currentScene: cur.currentProgramSceneName || null
      };
    },
    async setScene(name) { return obs.call("SetCurrentProgramScene", { sceneName: name }); },
    async toggleMute(input) { return obs.call("ToggleInputMute", { inputName: input }); },
    async setMute(input, muted) { return obs.call("SetInputMute", { inputName: input, inputMuted: muted }); },
    async toggleSource(sceneName, sourceName) {
      const list = await obs.call("GetSceneItemList", { sceneName });
      const item = (list.sceneItems || []).find(s => s.sourceName === sourceName);
      if (!item) throw new Error(`Source ${sourceName} not in ${sceneName}`);
      const cur = await obs.call("GetSceneItemEnabled", { sceneName, sceneItemId: item.sceneItemId });
      return obs.call("SetSceneItemEnabled", { sceneName, sceneItemId: item.sceneItemId, sceneItemEnabled: !cur.sceneItemEnabled });
    }
  };
}
