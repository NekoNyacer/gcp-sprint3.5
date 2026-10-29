// Actual compiled App, local Demo, external HTTPS blocked. No live Mapbox/AI acceptance.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'client/dist/client/browser');
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(req.url.split('?')[0]);
    const path = extname(pathname) ? resolve(dist, '.' + pathname) : join(dist, 'index.html');
    if (!path.startsWith(dist + sep)) { res.writeHead(403); res.end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' })[extname(path)] ?? 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--disable-gpu', '--remote-debugging-port=9372',
  `--user-data-dir=${await mkdtemp(join(tmpdir(), 'companion-qa-'))}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(r => setTimeout(r, ms));
let ws;
try {
  let tabs;
  for (let i = 0; i < 60; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:9372/json')).json(); break; }
    catch { await pause(200); }
  }
  if (!tabs) throw Error('Chrome did not start');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  const pending = new Map(), errors = [], missingAssets = [];
  let id = 0;
  ws.onmessage = event => {
    const m = JSON.parse(event.data);
    if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    else if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && m.params.response.url.includes('/images/pet/')) missingAssets.push(m.params.response.url);
  };
  const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.error) throw Error(result.error.message);
    if (result.result?.exceptionDetails) throw Error(JSON.stringify(result.result.exceptionDetails));
    return result.result.result.value;
  };
  const wait = async expression => {
    for (let i = 0; i < 100; i++) {
      try { if (await evaluate(expression)) return; }
      catch (error) { if (!/context|navigat/i.test(error.message)) throw error; }
      await pause(100);
    }
    throw Error('Timed out: ' + expression);
  };
  const assert = (value, message) => { if (!value) throw Error(message); };
  const snap = async name => {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(root, 'docs', name + '.png'), Buffer.from(shot.result.data, 'base64'));
  };
  const reviewDir = join(root, '.impeccable/review/unified-art');
  await mkdir(reviewDir, { recursive: true });
  const reviewSnap = async name => {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(reviewDir, name + '.png'), Buffer.from(shot.result.data, 'base64'));
  };
  const go = async tab => {
    await evaluate(`document.querySelector('ion-tab-button[tab="${tab}"]').click()`);
    await wait(`location.pathname === '/${tab}'`);
    await pause(150);
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/login` });
  await wait(`!![...document.querySelectorAll('ion-button,button')].find(e=>e.textContent.includes('免登入進入 Demo'))`);
  await evaluate(`[...document.querySelectorAll('ion-button,button')].find(e=>e.textContent.includes('免登入進入 Demo')).click()`);
  await wait(`!!document.querySelector('app-companion') && !!window.ng`);
  await evaluate(`window.petQA = ng.getComponent(document.querySelector('app-companion'));true`);
  // These checks isolate tab-edge motion; ledge support is tested independently.
  await evaluate(`petQA.platforms.source=()=>[];petQA.platforms.reset()`);
  const reports=[];
  for (const [name,width,height] of [['user-320',320,568],['mobile',390,844],['desktop',1024,768]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    await send('Emulation.setTouchEmulationEnabled',{enabled:width<600,maxTouchPoints:1});
    await evaluate(`petQA.close();petQA.petTab.set('home');petQA.platforms=new petQA.platforms.constructor(document,()=>0);petQA.roaming.x=80;petQA.roaming.direction=1;petQA.roaming.observeFor(60);petQA.behavior.set('idle');petQA.focused=true`);
    await pause(100);
    const pet=await evaluate(`document.querySelector('.pet-body').getBoundingClientRect().toJSON()`);
    const start={x:pet.x+64,y:pet.y+54},end={x:Math.min(width-50,start.x+60),y:Math.max(150,height*.32)};
    const input=async(type,point)=>{
      if(width<600)await send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[point]});
      else await send('Input.dispatchMouseEvent',{type:type==='touchStart'?'mousePressed':type==='touchEnd'?'mouseReleased':'mouseMoved',...point,button:'left',buttons:type==='touchEnd'?0:1,clickCount:1});
    };
    await input('touchStart',start);
    await input('touchMove',end);
    await wait(`petQA.dragAction()==='pickup' || petQA.dragAction()==='held'`);
    await wait(`petQA.dragAction()==='held'`);
    await pause(100);await reviewSnap(name+'-held');
    assert(await evaluate(`!petQA.engaged() && petQA.petTab()==='home'`),'Dragging must not greet/navigate');
    await input('touchEnd',end);
    await wait(`petQA.dragAction()==='falling'`);
    await pause(80);await reviewSnap(name+'-falling');
    await wait(`!petQA.drag.active`);
    assert(await evaluate(`!petQA.engaged() && petQA.dragAction()===null && petQA.petTab()==='home'`),'Drop must settle without synthetic-click greeting');
    const drop=await evaluate(`({support:!!petQA.drag.support,x:petQA.roaming.x,y:petQA.platformY})`);
    await evaluate(`petQA.greet();petQA.petChipmunk()`);
    await wait(`!!document.querySelector('dialog:modal')`);
    await wait(`ng.getComponent(document.querySelector('app-companion-petting')).spriteReady()`);
    await pause(400);await reviewSnap(name+'-idle');
    const clip=await evaluate(`ng.getComponent(document.querySelector('app-companion-petting')).spritePath`);
    assert(clip.includes('petting-unified/idle-atlas'),'Must use new unified idle');
    const box=await evaluate(`document.querySelector('dialog').getBoundingClientRect().toJSON()`);
    assert(box.top>=0 && box.bottom<=height+1,'Modal must fit');
    for(const [index,action] of [[0,'head'],[1,'belly']]){
      await evaluate(`document.querySelectorAll('.petting-actions button')[${index}].click()`);
      await wait(`!ng.getComponent(document.querySelector('app-companion-petting')).idle()`);
      await pause(450);await reviewSnap(name+'-'+action);
      assert(await evaluate(`ng.getComponent(document.querySelector('app-companion-petting')).spritePath.includes('petting-unified/${action}-atlas')`),'New reaction clip must be used');
      await wait(`ng.getComponent(document.querySelector('app-companion-petting')).idle()`);
      assert(await evaluate(`!ng.getComponent(document.querySelector('app-companion-petting')).previousSprite()`),'Shared neutral should not ghost on return');
    }
    await wait(`ng.getComponent(document.querySelector('app-companion-petting')).idleClip()==='expression'`);
    await pause(300);await reviewSnap(name+'-expression');
    await evaluate(`document.querySelector('.petting-close').click()`);await wait(`!document.querySelector('dialog')`);
    await evaluate(`petQA.close();petQA.roaming.behavior='sleeping';petQA.roaming.remaining=60;petQA.behavior.set('sleeping');petQA.focused=true`);
    await wait(`document.querySelector('.pet-body img').src.includes('drag-drop/sleeping-static') && document.querySelector('.pet-body img').naturalWidth>0`);
    await pause(500);await reviewSnap(name+'-sleeping');
    reports.push({width,height,drop,modal:box});
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate(`petQA.close();petQA.platforms=new petQA.platforms.constructor(document,()=>0);petQA.platforms.cooldown=0;petQA.roaming.enterFromEdge(1,390);petQA.roaming.x=80;petQA.roaming.remaining=20;petQA.focused=false`);
  await wait(`petQA.renderedAction()==='jumping-up'`);await pause(180);await reviewSnap('mobile-jumping-up');
  await wait(`!petQA.jumping() && petQA.platformY<innerHeight-petQA.floorBottom()-10`);
  await evaluate(`petQA.platforms.cooldown=0`);
  await wait(`petQA.renderedAction()==='jumping-down'`);await pause(180);await reviewSnap('mobile-jumping-down');
  await wait(`!petQA.jumping()`);
  assert(!errors.length && !missingAssets.length,JSON.stringify({errors,missingAssets}));
  console.log(JSON.stringify({reports,dragPickupHeldFall:true,directionalJumps:true,newSleep:true,allFourUnifiedClips:true,sharedEndpointNoGhost:true,errors,missingAssets},null,2));
} finally {ws?.close();chrome.kill();server.close();}
