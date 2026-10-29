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
  '--headless=new', '--no-first-run', '--disable-gpu', '--remote-debugging-port=9373',
  `--user-data-dir=${await mkdtemp(join(tmpdir(), 'companion-qa-'))}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(r => setTimeout(r, ms));
let ws;
try {
  let tabs;
  for (let i = 0; i < 60; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:9373/json')).json(); break; }
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
  const reviewDir = join(root, '.impeccable/review/drag-tabs');
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
  // Pause one real outlet animation at its midpoint to inspect an actual frame,
  // rather than racing a 120ms transition from the CDP process.
  await evaluate(`window.sceneQA={records:[],pauseNext:false,paused:null,pausedHeader:null};
    const originalAnimate=Element.prototype.animate;
    Element.prototype.animate=function(frames,options){
      const animation=originalAnimate.call(this,frames,options);
      if(this.matches('ion-tabs ion-router-outlet')){
        sceneQA.records.push({frames,options});
        if(sceneQA.pauseNext){sceneQA.pauseNext=false;sceneQA.paused=animation;animation.pause();animation.currentTime=Number(options.duration)/2;}
      }
      if(this.matches('app-shell > ion-header') && sceneQA.paused){
        sceneQA.pausedHeader=animation;animation.pause();animation.currentTime=Number(options.duration)/2;
      }
      return animation;
    };true`);
  // These checks isolate tab-edge motion; ledge support is tested independently.
  await evaluate(`petQA.platforms.source=()=>[];petQA.platforms.reset()`);
  const results=[];
  for (const [width,height] of [[390,844],[1024,768]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    await send('Emulation.setTouchEmulationEnabled',{enabled:width<600,maxTouchPoints:1});
    await go('home');
    await evaluate(`petQA.close();petQA.petTab.set('home');petQA.roaming.x=90;petQA.roaming.observeFor(60);petQA.behavior.set('idle');petQA.focused=true`);
    await pause(100);
    const box=await evaluate(`document.querySelector('.pet-body').getBoundingClientRect().toJSON()`);
    const start={x:box.x+64,y:box.y+54},y=200;
    const input=async(type,x,atY=y)=>{
      if(width<600) await send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y:atY}]});
      else await send('Input.dispatchMouseEvent',{type:type==='touchStart'?'mousePressed':type==='touchEnd'?'mouseReleased':'mouseMoved',x,y:atY,button:'left',buttons:type==='touchEnd'?0:1,clickCount:1});
    };
    await input('touchStart',start.x,start.y);await input('touchMove',width/2);
    await wait(`petQA.drag.dragging`);
    const pointer=await evaluate(`petQA.dragPointer`);
    const inspectMidpoint=async(direction,label)=>{
      await wait(`!!sceneQA.paused && document.querySelector('app-shell').classList.contains('companion-tab-transition')`);
      const frame=await evaluate(`(()=>{
        const outlet=document.querySelector('ion-tabs ion-router-outlet');
        const pet=document.querySelector('.pet-body');
        return {x:new DOMMatrixReadOnly(getComputedStyle(outlet).transform).m41,
          opacity:Number(getComputedStyle(outlet).opacity),
          captured:pet.hasPointerCapture(${pointer}),petY:pet.getBoundingClientRect().y,
          shellTransform:getComputedStyle(document.querySelector('app-shell')).transform,
          tabsTransform:getComputedStyle(document.querySelector('ion-tabs')).transform,
          barTransform:getComputedStyle(document.querySelector('ion-tab-bar')).transform};
      })()`);
      assert(frame.x*direction<0 && frame.opacity>0 && frame.opacity<1,'Outgoing page must visibly slide/fade in the drag direction: '+JSON.stringify(frame));
      assert(frame.captured && frame.shellTransform==='none' && frame.tabsTransform==='none' && frame.barTransform==='none','Only the page layer should move: '+JSON.stringify(frame));
      await input('touchMove',direction>0?width-2:2,y+24);
      await pause(50);
      const moved=await evaluate(`document.querySelector('.pet-body').getBoundingClientRect().y`);
      assert(Math.abs(moved-frame.petY-24)<2,'Pet must continue following the pointer during scene animation');
      await reviewSnap((width<600?'mobile':'desktop')+'-scene-'+label+'-midpoint');
      await input('touchMove',direction>0?width-2:2,y);
      await evaluate(`sceneQA.paused.play();sceneQA.pausedHeader?.play();sceneQA.paused=null;sceneQA.pausedHeader=null;true`);
    };
    const sequence=['task','shop','collection','profile'];
    for(const tab of sequence){
      if(tab==='task') await evaluate(`sceneQA.pauseNext=true`);
      await input('touchMove',width/2); await input('touchMove',width-2);
      if(tab==='task') await inspectMidpoint(1,'right');
      await wait(`location.pathname==='/${tab}' && petQA.viewedTab()==='${tab}' && petQA.petTab()==='${tab}' && !petQA.edgeNavigation`);
      assert(await evaluate(`ng.getComponent(document.querySelector('app-companion'))===petQA && petQA.drag.tracking && petQA.dragPointer===${pointer} && document.querySelector('.pet-body').hasPointerCapture(${pointer}) && petQA.isHere()`),'Must preserve instance/capture across '+tab);
      await input('touchMove',width-3);await pause(150);
      assert(await evaluate(`location.pathname==='/${tab}'`),'Staying at an edge must not cascade');
    }
    await reviewSnap(width<600?'mobile-rightmost':'desktop-rightmost');
    await input('touchMove',width/2);await input('touchMove',width-2);await pause(250);
    assert(await evaluate(`location.pathname==='/profile' && petQA.drag.tracking`),'Rightmost tab must not wrap');
    for(const tab of ['collection','shop','task','home']){
      if(tab==='collection') await evaluate(`sceneQA.pauseNext=true`);
      await input('touchMove',width/2);await input('touchMove',2);
      if(tab==='collection') await inspectMidpoint(-1,'left');
      await wait(`location.pathname==='/${tab}' && petQA.petTab()==='${tab}' && !petQA.edgeNavigation`);
      assert(await evaluate(`petQA.drag.tracking && document.querySelector('.pet-body').hasPointerCapture(${pointer})`),'Reverse drag must retain capture');
    }
    await input('touchMove',width/2);await input('touchMove',2);await pause(250);
    assert(await evaluate(`location.pathname==='/home'`),'Leftmost tab must not wrap');
    await reviewSnap(width<600?'mobile-leftmost':'desktop-leftmost');
    await input('touchEnd',2);await wait(`!petQA.drag.active`);
    assert(await evaluate(`location.pathname==='/home' && !petQA.engaged() && petQA.dragAction()===null`),'Release after cross-tab drag must settle normally');
    const animations=await evaluate(`sceneQA.records.splice(0)`);
    assert(animations.length===16,'Each of eight tab crossings must animate both outgoing and incoming pages: '+animations.length);
    for(let i=0;i<animations.length;i+=2){
      const direction=i<8?1:-1;
      const outgoing=JSON.stringify(animations[i].frames),incoming=JSON.stringify(animations[i+1].frames);
      assert(outgoing.includes('translateX('+(-direction*32)+'px)') && incoming.includes('translateX('+(direction*32)+'px)'),
        'Incoming/outgoing keyframes must match tab order: '+JSON.stringify(animations.slice(i,i+2)));
    }
    assert(await evaluate(`!document.querySelector('app-shell').classList.contains('companion-tab-transition') && getComputedStyle(document.querySelector('ion-tabs ion-router-outlet')).opacity==='1'`),'Transition must clean up its hidden state');
    // Ordinary navigation does not acquire the pet drag transition.
    await go('task');
    assert(await evaluate(`sceneQA.records.length===0 && !document.querySelector('app-shell').classList.contains('companion-tab-transition')`),'Normal tab clicks must bypass drag-only scene animation');
    results.push({width,height,forward:sequence,reverse:['collection','shop','task','home'],capturePreserved:true,noWrap:true,noCascading:true,landed:true,directionalSceneAnimations:animations.length,petFollowsDuringTransition:true,manualTabsUnchanged:true});
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await go('home');
  await evaluate(`petQA.close();petQA.petTab.set('home');petQA.roaming.x=90;petQA.roaming.observeFor(60);petQA.focused=true;sceneQA.records=[]`);
  await pause(100);
  const reducedBox=await evaluate(`document.querySelector('.pet-body').getBoundingClientRect().toJSON()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:reducedBox.x+64,y:reducedBox.y+54,button:'left',buttons:1,clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1022,y:220,button:'left',buttons:1});
  await wait(`location.pathname==='/task' && petQA.petTab()==='task' && !petQA.edgeNavigation`);
  assert(await evaluate(`sceneQA.records.length===0 && petQA.drag.tracking && !document.querySelector('app-shell').classList.contains('companion-tab-transition')`),'Reduced motion must navigate while preserving drag without spatial animation');
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:1022,y:220,button:'left',buttons:0,clickCount:1});
  await wait(`!petQA.drag.active`);
  results.push({reducedMotion:true,spatialAnimations:0,capturePreserved:true});
  assert(!errors.length && !missingAssets.length,JSON.stringify({errors,missingAssets}));
  console.log(JSON.stringify({results,errors,missingAssets},null,2));
} finally {ws?.close();chrome.kill();server.close();}
