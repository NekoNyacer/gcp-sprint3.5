// Rebuild CMS atlas and client 2D parts from the real procedural Three.js models.
// Uses installed client esbuild and local headless Chrome; no downloaded artwork.
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(resolve(root, "client/package.json"));
const { build } = require("esbuild");
const bundle = await build({
  stdin: {
    resolveDir: resolve(root, "client"),
    loader: "ts",
    contents: `
import * as T from 'three';
import {createTreeModel} from './src/shared/components/tree-scene/tree-model';
import {createTreeOrnaments} from './src/shared/components/tree-scene/tree-ornaments';
import {createSaplingModel} from './src/shared/components/tree-scene/tree-sapling';
import {createSeedModel} from './src/shared/components/tree-scene/tree-seed';
import {createTreeGround} from './src/shared/components/tree-scene/tree-ground';
import {TREE_APPEARANCES} from '../functions/src/tree-species';
import {TREE_ORNAMENTS} from './src/shared/models/tree-appearance';
window.generate = async () => {
  const renderer = new T.WebGLRenderer({alpha:true, antialias:true, preserveDrawingBuffer:true});
  renderer.setSize(320,240); renderer.setPixelRatio(1); renderer.setClearColor(0,0);
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xdbe9e9,0x52684a,1.8));
  const light = new T.DirectionalLight(0xffefd3,2.5); light.position.set(-3,5,4); scene.add(light);
  const camera = new T.OrthographicCamera(-160/58,160/58,210/58,-30/58,.1,20);
  camera.position.set(0,0,6); camera.lookAt(0,0,0);
  const result = [];
  const capture = (name, object, scale=1, ground=false) => {
    camera.position.set(0,ground?1.2:0,6);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    object.scale.setScalar(scale); scene.add(object);
    const soil = ground ? createTreeGround() : null; if(soil) scene.add(soil);
    renderer.render(scene,camera);
    result.push({name, data:renderer.domElement.toDataURL('image/png').split(',')[1]});
    scene.remove(object); if(soil) scene.remove(soil);
    const dispose = o => o.traverse(n => { n.geometry?.dispose(); if(n.material) for(const m of [n.material].flat()) {m.map?.dispose();m.dispose();} });
    dispose(object); if(soil) dispose(soil);
  };
  const image = new Image(); image.src='/images/assets/tree-point-particle.svg'; await image.decode();
  const pointTexture = new T.Texture(image);pointTexture.needsUpdate=true;pointTexture.colorSpace=T.SRGBColorSpace;
  for(const p of TREE_APPEARANCES) {
    for(const [stage,scale] of [['young',.55],['mature',.78],['flowering',.83],['large',.85]]) {
      const model = createTreeModel(stage==='young',p.name);
      if(stage==='flowering')model.add(createTreeOrnaments(p.name));
      if(stage==='large') {
        for(const p of TREE_ORNAMENTS) {
          const texture=pointTexture.clone();texture.needsUpdate=true;
          const point=new T.Mesh(new T.PlaneGeometry(.14,.14),new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.1,depthWrite:false,depthTest:false}));
          point.position.set(p.x,p.y,p.z+.04);point.renderOrder=1;model.add(point);
        }
      }
      capture(p.id+'-'+stage,model,scale,true);
    }
    for(const [part,young] of [['trunk',false],['young-crown',true],['crown',false]]) {
      const model=createTreeModel(young,p.name);
      model.getObjectByName('tree-branches').visible=part==='trunk';
      model.getObjectByName('tree-foliage').visible=part!=='trunk';
      capture(p.id+'-'+part,model);
    }
  }
  capture('seed',createSeedModel(-.03),1,true);
  for(const [stage,scale] of [['seedling',.12],['smallSapling',.24],['largeSapling',.38]]) capture(stage,createSaplingModel(stage),scale,true);
  renderer.dispose();pointTexture.dispose();return result;
};
`,
  },
  bundle: true,
  format: "iife",
  write: false,
});
const server = createServer(async (req, res) => {
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end('<script src="/bundle.js"></script>');
  } else if (req.url === "/bundle.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles[0].text);
  } else if (req.url === "/images/assets/tree-point-particle.svg") {
    res.setHeader("Content-Type", "image/svg+xml");
    res.end(
      await readFile(
        resolve(root, "client/public/images/assets/tree-point-particle.svg"),
      ),
    );
  } else {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const profile = await mkdtemp(join(tmpdir(), "cat-walk-atlas-"));
const chrome = spawn(
  process.env.CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  [
    "--headless=new",
    "--enable-unsafe-swiftshader",
    "--no-first-run",
    "--remote-debugging-port=9337",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
let ws;
try {
  let tabs;
  for (let i = 0; i < 50; i++) {
    try {
      tabs = await (await fetch("http://127.0.0.1:9337/json")).json();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  if (!tabs) throw new Error("Chrome did not start");
  ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      pending.get(m.id)?.(m);
      pending.delete(m.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      const callId = ++id;
      pending.set(callId, r);
      ws.send(JSON.stringify({ id: callId, method, params }));
    });
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/` });
  for (let i = 0; i < 100; i++) {
    const r = await send("Runtime.evaluate", {
      expression: "typeof window.generate",
    });
    if (r.result.result.value === "function") break;
    await new Promise((r) => setTimeout(r, 200));
  }
  const r = await send("Runtime.evaluate", {
    expression: "window.generate()",
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.result.exceptionDetails)
    throw new Error(JSON.stringify(r.result.exceptionDetails));
  const assets = r.result.result.value;
  for (const folder of [
    "client/public/images/tree-species",
    "cms/public/images/tree-species",
  ]) {
    await mkdir(resolve(root, folder), { recursive: true });
    for (const asset of assets)
      await writeFile(
        resolve(root, folder, asset.name + ".png"),
        Buffer.from(asset.data, "base64"),
      );
  }
  console.log(`Rendered ${assets.length} model images to client and CMS.`);
} finally {
  ws?.close();
  chrome.kill();
  server.close();
}
