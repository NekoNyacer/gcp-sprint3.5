// Actual compiled Task UI + actual stores, with local-only catalog/auth/map fixtures.
// All external HTTPS is blocked; no Firebase writes or paid map requests occur.
import { readFile, readdir, writeFile, mkdtemp } from "node:fs/promises";
import { resolve, join, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
const root = fileURLToPath(new URL("..", import.meta.url)),
  dist = join(root, "client/dist/client/browser");
const chunks = await Promise.all(
  (await readdir(dist))
    .filter((n) => n.endsWith(".js"))
    .map(async (name) => ({
      name,
      text: await readFile(join(dist, name), "utf8"),
    })),
);
const extras = new Map();
const moduleFor = (name) => {
  const exported = chunks.find(
    (c) =>
      c.text.slice(c.text.lastIndexOf("export {")).includes(`  ${name},`) ||
      c.text.slice(c.text.lastIndexOf("export {")).includes(`  ${name}\n`),
  );
  if (exported) return exported.name;
  const chunk = chunks.find(
    (c) =>
      c.text.includes(`var ${name} =`) || c.text.includes(`function ${name}(`),
  );
  if (!chunk)
    throw new Error(`Cannot locate ${name}; build development client first.`);
  const names = extras.get(chunk.name) || new Set();
  names.add(name);
  extras.set(chunk.name, names);
  return chunk.name;
};
const imports = [
  "bootstrapApplication",
  "provideIonicAngular",
  "TaskComponent",
  "TaskDetailComponent",
  "TaskRewardDialogComponent",
  "TaskStore",
  "TaskMapService",
  "SessionStore",
  "ProgressStore",
  "ProgressSyncService",
  "FirebaseTaskRepository",
  "SeededDemoTaskRepository",
  "LocationStore",
  "Router",
  "ActivatedRoute",
  "of",
];
const importText = imports
  .map((n) => `import {${n}} from '/${moduleFor(n)}';`)
  .join("\n");
const html = (
  detail,
) => `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><style>
html,body{margin:0;height:100%;background:#f5f4ed}ion-app{display:flex;flex-direction:column}.fixture-header{height:52px;display:grid;place-items:center;background:#fff;font-weight:700;color:#252525;flex-shrink:0}.fixture-tabs{display:flex;justify-content:space-around;background:white;border-top:1px solid #eee;height:58px;align-items:center;font-size:11px;color:#999;flex-shrink:0}.fixture-tabs b{color:#f56a10}app-task,app-task-detail{flex:1;min-height:0}app-task-reward-dialog{display:contents}.fixture-map{position:absolute;inset:0;background:linear-gradient(35deg,#e8ebdf,#f3f1e6);display:grid;place-items:center;color:#8c967a;font-size:12px}.fixture-map::after{content:'地圖替身・離線版面檢查';border:2px solid #f56a1070;border-radius:50%;padding:44px}
</style></head><body><ion-app><div class="fixture-header">${detail ? "活動內容" : "任務"}</div><${detail ? "app-task-detail" : "app-task"}></${detail ? "app-task-detail" : "app-task"}><div class="fixture-tabs"><span>首頁</span><b>任務</b><span>兌換</span><span>回憶林</span><span>我的</span></div><app-task-reward-dialog></app-task-reward-dialog></ion-app><script type="module">
${importText}
try{
 const providers=[provideIonicAngular({mode:'md',animated:false}),
 {provide:SessionStore,useValue:{isDemoMode:()=>true,dataScope:()=>({mode:'demo'})}},
 {provide:ProgressSyncService,useValue:{}},{provide:FirebaseTaskRepository,useValue:{}},
 {provide:Router,useValue:{navigate:async()=>true,navigateByUrl:async()=>true}},
 {provide:ActivatedRoute,useValue:{paramMap:of({get:()=> 'boardwalk'})}},
 {provide:TaskMapService,useValue:{error:()=>'',attach:el=>{const node=document.createElement('div');node.className='fixture-map';el.append(node)},update:()=>{},detach:()=>{},retry:()=>{}}}];
 const app=await bootstrapApplication(${detail ? "TaskDetailComponent" : "TaskComponent"},{providers});
 const store=app.injector.get(TaskStore),repo=app.injector.get(SeededDemoTaskRepository),progress=app.injector.get(ProgressStore),location=app.injector.get(LocationStore);
 const now=Date.now(),point=location.current();
 const base={areaId:'banqiao',cadence:'event',enabled:true,description:'完成路線步數，抵達指定地點即可達成任務。',startsAt:new Date(now-86400000).toISOString(),endsAt:new Date(now+2*86400000).toISOString(),destinationName:'新北市市民廣場（模擬）',address:'新北市板橋區',latitude:point.latitude,longitude:point.longitude,requiredSteps:2000,radiusMeters:100,rewardAmount:1};
 repo.setPublishedTasks([{...base,id:'boardwalk',name:'板橋綠行活動',rewardType:'waterDrops',rewardAmount:50,requiredSteps:1000},
 {...base,id:'forest',name:'晨間森林健走',rewardType:'fertilizer'},
 {...base,id:'seedwalk',name:'城市種子探索',rewardType:'seeds',requiredSteps:3000}],1);
 await repo.joinEvent('forest');await repo.joinEvent('seedwalk');progress.addSteps(2000,true);location.moveDemoBy(0,0,.1,0);store.selectCadence('event');
 const dialog=await bootstrapApplication(TaskRewardDialogComponent,{providers:[provideIonicAngular({mode:'md',animated:false}),{provide:TaskStore,useValue:store}]});
 app.components[0].instance.ionViewDidEnter?.();
 window.qa={app,dialog,store,repo,progress,location,ready:true};
}catch(error){window.qa={error:String(error),stack:error.stack}}
</script></body></html>`;
const pages = { "/": html(false), "/detail": html(true) };
const server = createServer(async (req, res) => {
  try {
    if (pages[req.url]) {
      res.setHeader("Content-Type", "text/html");
      res.end(pages[req.url]);
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
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
      }[extname(path)] || "application/octet-stream",
    );
    let data = await readFile(path);
    const names = extras.get(path.slice(dist.length + 1));
    if (names)
      data = Buffer.from(
        data.toString() + `\nexport {${[...names].join(",")}};`,
      );
    res.end(data);
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
    "--remote-debugging-port=9344",
    `--user-data-dir=${await mkdtemp(join(tmpdir(), "cat-tasks-"))}`,
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
let ws;
try {
  let tabs;
  for (let i = 0; i < 50; i++) {
    try {
      tabs = await (await fetch("http://127.0.0.1:9344/json")).json();
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
      const n = ++id;
      pending.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params }));
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
  const pause = () => new Promise((r) => setTimeout(r, 150));
  const load = async (path) => {
    await send("Page.navigate", {
      url: `http://127.0.0.1:${server.address().port}${path}`,
    });
    for (let i = 0; i < 80; i++) {
      if (await evaluate("!!window.qa?.ready")) return;
      const err = await evaluate("window.qa?.error");
      if (err) throw new Error(err);
      await pause();
    }
    throw new Error("Fixture timed out");
  };
  const shot = async (name) => {
    const r = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(
      join(root, "docs", name),
      Buffer.from(r.result.data, "base64"),
    );
  };
  await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: ["https://*"] });
  const report = [];
  for (const width of [320, 390, 430, 1024]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 800,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await load("/");
    for (let i = 0; i < 30; i++) {
      if (await evaluate("qa.store.tasks().some(t=>t.readyAt)")) break;
      await pause();
    }
    await pause();
    const layout = await evaluate(
      `(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,cards:document.querySelectorAll('.task-card').length,ready:qa.store.incompleteTaskCount(),filters:[...document.querySelectorAll('.filters select')].map(el=>el.getBoundingClientRect().width)}))()`,
    );
    if (layout.overflow || layout.cards !== 3 || layout.ready !== 1)
      throw new Error(JSON.stringify(layout));
    if (width === 390) await shot("tasks-list-preview.png");
    const balance = await evaluate("qa.progress.inventory().fertilizer");
    await evaluate(`document.querySelectorAll('.task-card')[1].click()`);
    await pause();
    await pause();
    const dialog = await evaluate(
      `(()=>{const el=document.querySelector('ion-modal.task-reward-modal.show-modal .reward-dialog');return el?{rect:el.getBoundingClientRect().toJSON(),text:el.innerText}:null})()`,
    );
    if (!dialog || dialog.rect.width > width - 20 || dialog.rect.height > 700)
      throw new Error("Reward dialog layout failed: " + JSON.stringify(dialog));
    if (width === 390) await shot("tasks-reward-preview.png");
    await evaluate(
      `document.querySelector('ion-modal.show-modal .secondary').click()`,
    );
    await pause();
    await pause();
    if ((await evaluate("qa.progress.inventory().fertilizer")) !== balance)
      throw new Error("Cancel awarded a reward");
    await evaluate(
      `qa.store.openClaim(qa.store.tasks().find(t=>t.taskId==='forest'));qa.app.tick();qa.dialog.tick()`,
    );
    await pause();
    await pause();
    await evaluate(
      `document.querySelector('ion-modal.show-modal .primary').click()`,
    );
    await pause();
    await pause();
    if ((await evaluate("qa.progress.inventory().fertilizer")) !== balance + 1)
      throw new Error("Claim did not credit shared inventory");
    await evaluate("qa.store.completeSelectedTask()");
    if ((await evaluate("qa.progress.inventory().fertilizer")) !== balance + 1)
      throw new Error("Duplicate claim credited twice");
    await load("/detail");
    await pause();
    await pause();
    const detail = await evaluate(
      `(()=>{const a=document.querySelector('.activity-actions').getBoundingClientRect(),m=document.querySelector('.map-panel').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,mapHeight:m.height,actionsBottom:a.bottom,height:innerHeight}})()`,
    );
    if (detail.overflow || detail.mapHeight < 100 || detail.actionsBottom > 800)
      throw new Error(JSON.stringify(detail));
    if (width === 390) await shot("tasks-detail-preview.png");
    report.push({ layout, detail, claim: "passed" });
  }
  console.log(
    JSON.stringify({ report, externalRequests: "blocked", fixtureMap: true }),
  );
} finally {
  ws?.close();
  chrome.kill();
  server.close();
}
