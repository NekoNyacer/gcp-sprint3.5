// Inspect the built CMS page with a local fixture, without authentication or cloud writes.
import { readFile, writeFile, readdir, mkdtemp, mkdir } from "node:fs/promises";
import { resolve, join, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
const root = fileURLToPath(new URL("..", import.meta.url));
const dist = resolve(root, "cms/dist/cms/browser");
const chunks = await Promise.all(
  (await readdir(dist))
    .filter((f) => /^chunk-.*\.js$/.test(f))
    .map(async (name) => ({
      name,
      text: await readFile(join(dist, name), "utf8"),
    })),
);
const exported = (name) =>
  chunks.find((c) =>
    c.text.slice(c.text.lastIndexOf("export {")).includes(`  ${name}`),
  )?.name;
const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><style>body{margin:0;padding:32px;background:#f5f6f3;font-family:Arial,"Microsoft JhengHei",sans-serif}main{max-width:1280px;margin:auto}h1{font-size:23px;margin:0 0 24px}@media(max-width:600px){body{padding:12px}}</style></head><body><main><h1>樹種與種子機率</h1><cms-seed-types-page></cms-seed-types-page></main><script src="/polyfills.js" type="module"></script><script type="module">
import {bootstrapApplication,provideAnimations,CmsWorkspaceService} from '/${exported("bootstrapApplication")}';
import {signal,computed} from '/${exported("signal")}';
import {SeedTypesPageComponent} from '/${exported("SeedTypesPageComponent")}';
const config=signal(await(await fetch('/cms-demo.json')).json());
const vm={config,search:signal(''),dirty:signal(false),newSpecies:'',rows:computed(()=>config().seedTypes),
  probability:(item,w)=>w/item.outcomes.reduce((s,o)=>s+o.weight,0)*100,
  edit:()=>{},remove:()=>{},removeSpecies:()=>{},addSpecies:()=>{}};
window.qa={vm};
try {window.qa.app=await bootstrapApplication(SeedTypesPageComponent,{providers:[provideAnimations(),{provide:CmsWorkspaceService,useValue:vm}]});window.qa.ready=true;} catch(e) {window.qa.error=String(e);}
</script></body></html>`;
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(html);
      return;
    }
    const path = resolve(dist, "." + decodeURIComponent(req.url.split("?")[0]));
    if (!path.startsWith(dist + sep)) {
      res.statusCode = 403;
      res.end();
      return;
    }
    res.setHeader(
      "Content-Type",
      {
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
      }[extname(path)] ?? "application/octet-stream",
    );
    res.end(await readFile(path));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const chrome = spawn(
  process.env.CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  [
    "--headless=new",
    "--no-first-run",
    "--remote-debugging-port=9338",
    `--user-data-dir=${await mkdtemp(join(tmpdir(), "cat-walk-seed-qa-"))}`,
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
let ws;
try {
  let tabs;
  for (let i = 0; i < 50; i++) {
    try {
      tabs = await (await fetch("http://127.0.0.1:9338/json")).json();
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
  const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      pending.get(m.id)?.(m);
      pending.delete(m.id);
    } else if (m.method === "Runtime.exceptionThrown")
      errors.push(m.params.exceptionDetails.text);
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      const callId = ++id;
      pending.set(callId, r);
      ws.send(JSON.stringify({ id: callId, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.result?.exceptionDetails)
      throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result.result.value;
  };
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: ["https://*"] });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:${server.address().port}/`,
  });
  for (let i = 0; i < 100; i++) {
    if (await evaluate("!!window.qa?.ready")) break;
    const error = await evaluate("window.qa?.error");
    if (error) throw new Error(error);
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!(await evaluate("!!window.qa?.ready")))
    throw new Error("CMS fixture did not mount: " + errors.join(","));
  await evaluate("Promise.all([...document.images].map(i=>i.decode()))");
  const report = [];
  for (const width of [1440, 1024, 390, 320]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 200));
    const state = await evaluate(
      `({width:${width},overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length,figures:document.querySelectorAll('.stage-grid figure').length})`,
    );
    report.push(state);
    if (state.overflow || state.brokenImages || state.figures !== 4)
      throw new Error(JSON.stringify(state));
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(
    `[...document.querySelectorAll('.species-list button')].find(b=>b.textContent.includes('櫻花')).click()`,
  );
  await new Promise((r) => setTimeout(r, 200));
  await evaluate("Promise.all([...document.images].map(i=>i.decode()))");
  const screen = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  await mkdir(resolve(root, "docs"), { recursive: true });
  await writeFile(
    resolve(root, "docs/seed-species-cms-preview.png"),
    Buffer.from(screen.result.data, "base64"),
  );
  const early = ["seed", "seedling", "smallSapling", "largeSapling"];
  const species = [
    ["banyan", "榕樹"],
    ["camphor", "樟樹"],
    ["osmanthus", "桂花"],
    ["persimmon", "柿子"],
    ["sweetgum", "楓香"],
    ["cherry", "櫻花"],
    ["ginkgo", "銀杏"],
    ["cathay", "國泰小樹"],
  ];
  await evaluate(
    `document.body.innerHTML=${JSON.stringify(`<main class="overview"><h1>神秘種子・樹木品種成長圖鑑</h1><p>種子、幼苗、小樹苗、大樹苗共用外觀；小樹（30%）才揭曉品種。</p><div class="early">${early.map((id) => `<img src="/images/tree-species/${id}.png">`).join("")}</div><div class="grid"><b>品種</b><b>小樹 · 30%</b><b>大樹 · 60%</b><b>開花 · 85%</b><b>結果 · 100%</b>${species.map(([id, name]) => `<strong>${name}</strong>${["young", "mature", "flowering", "large"].map((stage) => `<img src="/images/tree-species/${id}-${stage}.png" alt="${name}">`).join("")}`).join("")}</div></main><style>body{padding:28px;background:#eef2e8;color:#344437}.overview{max-width:1200px}.early{display:flex;height:90px;margin:12px 0 24px}.early img{width:120px;object-fit:contain}.grid{display:grid;grid-template-columns:100px repeat(4,1fr);gap:8px;align-items:center;background:#fff;padding:20px;border-radius:18px}.grid img{width:100%;height:148px;object-fit:contain;background:#f5f7f0;border-radius:10px}.grid b{text-align:center;padding:8px}.grid strong{text-align:center}</style>`)};true`,
  );
  await evaluate("Promise.all([...document.images].map(i=>i.decode()))");
  const overview = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  await writeFile(
    resolve(root, "docs/tree-species-growth-preview.png"),
    Buffer.from(overview.result.data, "base64"),
  );
  console.log(JSON.stringify({ report, errors }));
} finally {
  ws?.close();
  chrome.kill();
  server.close();
}
