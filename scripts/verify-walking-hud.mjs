// Verify the actual development-built HUD with an explicitly offline map fixture.
import { readFile, readdir, writeFile, mkdtemp } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'client/dist/client/browser');
const chunks = await Promise.all((await readdir(dist)).filter(n => n.endsWith('.js'))
  .map(async name => ({ name, text: await readFile(join(dist, name), 'utf8') })));
const extras = new Map();
const moduleFor = name => {
  const exported = chunks.find(c => new RegExp(`\\b${name}\\b`).test(c.text.slice(c.text.lastIndexOf('export {'))));
  if (exported) return exported.name;
  const chunk = chunks.find(c => c.text.includes(`var ${name} =`) || c.text.includes(`function ${name}(`));
  if (!chunk) throw new Error(`Missing ${name}; run the client development build first.`);
  const names = extras.get(chunk.name) ?? new Set();
  names.add(name);
  extras.set(chunk.name, names);
  return chunk.name;
};
const imports = ['bootstrapApplication', 'provideIonicAngular', 'HomeIdleComponent',
  'JoyStickComponent', 'ProgressStore', 'WalkSessionStore', 'MapCameraController',
  'addIcons', 'sunnyOutline', 'waterOutline', 'sparklesOutline', 'stopCircleOutline']
  .map(name => `import {${name}} from '/${moduleFor(name)}';`).join('\n');
const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><style>
html,body{margin:0;height:100%;background:#e7eade}body{box-sizing:border-box;padding:16px}.map-fixture{position:fixed;inset:0;display:grid;place-items:center;color:#929a84;font-size:12px;z-index:-1}.fixture-tabs{position:fixed;bottom:0;left:0;right:0;height:66px;background:white;display:flex;align-items:center;justify-content:space-around;font-size:12px;color:#999}home-idle{height:100%}
</style></head><body><div class="map-fixture">地圖替身・離線版面檢查</div><home-idle></home-idle><app-joy-stick></app-joy-stick><div class="fixture-tabs"><span>健走</span><span>任務</span><span>兌換</span><span>回憶林</span><span>我的</span></div><script type="module">
${imports}
try {
 addIcons({sunnyOutline,waterOutline,sparklesOutline,stopCircleOutline});
 const ws={hasActiveRoute:()=>true,routeId:()=> 'qa-route',isWalking:()=>true,isArrived:()=>false};
 const ps={inventory:()=>({lightEnergy:13446,waterDrops:777,fertilizer:5}),todaySteps:()=>15970,addSteps:()=>{}};
 const providers=[provideIonicAngular({mode:'md',animated:false}),{provide:WalkSessionStore,useValue:ws},{provide:ProgressStore,useValue:ps},MapCameraController];
 const hud=await bootstrapApplication(HomeIdleComponent,{providers});
 const joystick=await bootstrapApplication(JoyStickComponent,{providers});
 window.qa={ready:true,hud,joystick};
}catch(e){window.qa={error:String(e)}}
</script></body></html>`;
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
    const pathname = decodeURIComponent(req.url.split('?')[0]);
    const path = resolve(dist, '.' + pathname);
    if (!path.startsWith(dist + sep)) { res.statusCode = 403; res.end(); return; }
    res.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(path)] ?? 'application/octet-stream');
    let data = pathname.startsWith('/svg/') ? await readFile(join(root, 'client/node_modules/ionicons/dist', pathname)) : await readFile(path);
    if (extras.has(pathname.slice(1))) data = Buffer.from(data.toString() + '\nexport {' + [...extras.get(pathname.slice(1))].join(',') + '};');
    res.end(data);
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--remote-debugging-port=9347',
  `--user-data-dir=${await mkdtemp(join(tmpdir(), 'cat-walking-'))}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let ws;
try {
  let tabs;
  for (let i=0; i<50; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:9347/json')).json(); break; }
    catch { await new Promise(r => setTimeout(r, 200)); }
  }
  if (!tabs) throw new Error('Chrome did not start');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0;
  const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if(m.id) { pending.get(m.id)?.(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const callId=++id; pending.set(callId,r); ws.send(JSON.stringify({id:callId,method,params})); });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result.result.value;
  };
  const pause = () => new Promise(r => setTimeout(r, 200));
  await send('Network.enable');
  await send('Network.setBlockedURLs', {urls:['https://*']});
  await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate', {url:`http://127.0.0.1:${server.address().port}/`});
  for (let i=0; i<60; i++) {
    if (await evaluate('!!window.qa?.ready')) break;
    const error = await evaluate('window.qa?.error');
    if (error) throw new Error(error);
    await pause();
  }
  if (!await evaluate('!!window.qa?.ready')) throw new Error('HUD did not mount');
  const report=[];
  for (const width of [320,390,430,1024]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height:844,deviceScaleFactor:1,mobile:true});
    await pause();
    const result=await evaluate(`(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {resources:rect('.resources'),top:rect('.top'),stop:rect('.terminate-btn'),speed:rect('.speed-control'),stick:rect('.joystick'),tabs:rect('.fixture-tabs'),overflow:document.documentElement.scrollWidth>innerWidth,label:document.querySelector('.terminate-btn').textContent.trim()}})()`);
    if (result.overflow || result.resources.height>44 || result.top.height>120 ||
      result.speed.bottom>result.stop.top || result.stick.bottom>result.speed.top ||
      result.stop.bottom>result.tabs.top || result.label!=='中止本次路線') throw new Error(JSON.stringify({width,...result}));
    report.push({width,resourcesHeight:result.resources.height,topHeight:result.top.height,speedStopGap:result.stop.top-result.speed.bottom,tabGap:result.tabs.top-result.stop.bottom});
    if (width===390) {
      const shot=await send('Page.captureScreenshot',{format:'png'});
      await writeFile(join(root,'docs/walking-hud-preview.png'),Buffer.from(shot.result.data,'base64'));
    }
  }
  console.log(JSON.stringify({report}));
} finally { ws?.close(); chrome.kill(); server.close(); }
