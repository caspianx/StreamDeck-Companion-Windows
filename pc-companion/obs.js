import OBSWebSocket from "obs-websocket-js";
export function createObs(cfg, onState, onListChange) {
  const obs = new OBSWebSocket();
  let currentCfg = { ...cfg };
  let connected = false;
  async function connect() {
    const url = `ws://${currentCfg.host}:${currentCfg.port}`;
    try {
      await obs.connect(url, currentCfg.password || undefined);
      connected = true;
      onState?.(true);
      console.log("[OBS] connected", url);
      try {
        const r = await obs.call("GetSceneList").catch(() => null);
        const cur = await obs.call("GetCurrentProgramScene").catch(() => null);
        if (r || cur) {
          const inputs = await obs.call("GetInputList").catch(() => ({ inputs: [] }));
          let sceneItems = [];
          if (cur?.currentProgramSceneName) {
            const s = await obs.call("GetSceneItemList", { sceneName: cur.currentProgramSceneName }).catch(() => ({ sceneItems: [] }));
            sceneItems = (s.sceneItems || []).map(x => ({ id: x.sceneItemId, source: x.sourceName }));
          }
          onListChange?.({
            scenes: (r?.scenes || []).map(s => s.sceneName),
            inputs: (inputs.inputs || []).map(i => ({ name: i.inputName, kind: i.inputKind })),
            sceneItems,
            currentScene: cur?.currentProgramSceneName || null
          });
        }
      } catch {}
    } catch (e) {
      connected = false;
      onState?.(false, e.message);
      console.log("[OBS] connect fail:", e.message);
    }
  }
  obs.on("ConnectionClosed", () => { connected = false; onState?.(false, "closed"); });
  obs.on("ConnectionError", () => { connected = false; onState?.(false, "error"); });
  obs.on("SocketClose", () => { connected = false; onState?.(false, "socket close"); });
  connect();
  setInterval(() => { if (!connected) connect(); }, 5000);
  setInterval(async () => {
    if (!connected) return;
    try { await obs.call("GetVersion"); } catch (e) {
      connected = false; onState?.(false, e?.message || "heartbeat fail");
      try { await obs.disconnect(); } catch {}
      console.log("[OBS] heartbeat fail:", e?.message);
    }
  }, 5000);
  async function pushListChange(){
    try { const r = await obs.call("GetSceneList").then(async r => {
      const cur = await obs.call("GetCurrentProgramScene").catch(()=>({}));
      const inputs = await obs.call("GetInputList").catch(()=>({inputs:[]}));
      let sceneItems=[];
      if(cur?.currentProgramSceneName){
        const s=await obs.call("GetSceneItemList",{sceneName:cur.currentProgramSceneName}).catch(()=>({sceneItems:[]}));
        sceneItems=(s.sceneItems||[]).map(x=>({id:x.sceneItemId,source:x.sourceName}));
      }
      return { scenes:(r.scenes||[]).map(s=>s.sceneName), inputs:(inputs.inputs||[]).map(i=>({name:i.inputName,kind:i.inputKind})), sceneItems, currentScene:cur?.currentProgramSceneName||null };
    }); onListChange?.(r); } catch {}
  }
  obs.on("SceneCreated", pushListChange);
  obs.on("SceneRemoved", pushListChange);
  obs.on("SceneNameChanged", pushListChange);
  obs.on("SceneListChanged", pushListChange);
  obs.on("CurrentProgramSceneChanged", pushListChange);
  obs.on("InputCreated", pushListChange);
  obs.on("InputRemoved", pushListChange);
  obs.on("InputNameChanged", pushListChange);
  return {
    isConnected: () => connected,
    getConfig: () => ({ ...currentCfg }),
    async setConfig(newCfg) {
      const candidate = { ...currentCfg, ...newCfg };
      const tmp = new OBSWebSocket();
      const url = `ws://${candidate.host}:${candidate.port}`;
      try {
        await tmp.connect(url, candidate.password || undefined);
        try { await tmp.disconnect(); } catch {}
      } catch (e) {
        throw new Error(e.message || "obs connect fail");
      }
      try { await obs.disconnect(); } catch {}
      currentCfg = candidate;
      connected = false;
      onState?.(false, "reconfig");
      await connect();
      if (!connected) throw new Error("reconnect failed");
      return { ...currentCfg };
    },
    async list() {
      const scenes = await obs.call("GetSceneList").catch(() => ({ scenes: [] }));
      const inputs = await obs.call("GetInputList").catch(() => ({ inputs: [] }));
      const cur = await obs.call("GetCurrentProgramScene").catch(() => ({}));
      const sceneItemsMap = {};
      const sceneList = scenes.scenes || [];
      for (const s of sceneList) {
        const sName = s.sceneName;
        try {
          const r = await obs.call("GetSceneItemList", { sceneName: sName });
          sceneItemsMap[sName] = (r.sceneItems || []).map(x => x.sourceName);
        } catch {
          sceneItemsMap[sName] = [];
        }
      }
      let curSceneItems = [];
      if (cur.currentProgramSceneName) {
        curSceneItems = sceneItemsMap[cur.currentProgramSceneName] || [];
      }
      return {
        scenes: sceneList.map(s => s.sceneName),
        inputs: (inputs.inputs || []).map(i => ({ name: i.inputName, kind: i.inputKind })),
        sceneItems: curSceneItems.map((name, idx) => ({ id: idx, source: name })),
        sceneItemsMap: sceneItemsMap,
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
