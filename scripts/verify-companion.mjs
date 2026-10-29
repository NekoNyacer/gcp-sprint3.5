// Actual compiled App, local Demo, external HTTPS blocked. No live Mapbox/AI acceptance.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
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
  '--headless=new', '--no-first-run', '--disable-gpu', '--remote-debugging-port=9366',
  `--user-data-dir=${await mkdtemp(join(tmpdir(), 'companion-qa-'))}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(r => setTimeout(r, ms));
let ws;
try {
  let tabs;
  for (let i = 0; i < 60; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:9366/json')).json(); break; }
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
  // This offline fixture verifies the actual UI/service path; a separate live
  // authenticated probe is required to claim Vertex/Gemini acceptance.
  await evaluate(`petQA.chat.transport={identity:()=> 'qa',send:async()=>({text:'慢慢走，我陪你找找沿途的小風景。',source:'gemini'})};true`);
  await wait(`petQA.pet.nativeElement.querySelector('img').complete`);

  // Right exits go to the next tab, and the autonomous simulation continues there.
  await evaluate(`petQA.roaming.remaining=999;petQA.roaming.x=innerWidth+7;petQA.roaming.direction=1`);
  await wait(`petQA.petTab()==='task'`);
  const hiddenX = await evaluate(`petQA.roaming.x`);
  await pause(600);
  assert(await evaluate(`petQA.roaming.x > ${hiddenX} && location.pathname==='/home' && !petQA.isHere()`), 'Pet must continue off-tab without navigating the player');
  await go('task');
  assert(await evaluate(`ng.getComponent(document.querySelector('app-companion'))===petQA && petQA.isHere()`), 'Pet instance must persist across tabs');

  // Left Home edge wraps to Profile.
  await go('home');
  await evaluate(`petQA.petTab.set('home');petQA.roaming.x=-135;petQA.roaming.direction=-1;petQA.roaming.remaining=999`);
  await wait(`petQA.petTab()==='profile'`);
  assert(await evaluate(`location.pathname==='/home'`), 'Pet must not change the user route');
  await go('profile');
  assert(await evaluate(`petQA.isHere()`), 'Pet should be present on Profile after left exit');

  // Interactions pause movement, retain a menu above the pet, and support repeated petting.
  await evaluate(`petQA.roaming.x=100;document.querySelector('.pet-body').click()`);
  await wait(`petQA.engaged()`);
  const stoppedX = await evaluate(`petQA.roaming.x`);
  await pause(400);
  assert(await evaluate(`petQA.roaming.x===${stoppedX}`), 'Interaction should pause autonomous movement');
  await evaluate(`document.querySelectorAll('.pet-fab')[1].click()`);
  const serial = await evaluate(`petQA.actionSerial()`);
  await evaluate(`document.querySelectorAll('.pet-fab')[1].click()`);
  assert(await evaluate(`petQA.action()==='petted' && petQA.actionSerial()===${serial + 1}`), 'Repeated petting must replay');
  await evaluate(`document.querySelector('.pet-fab').click()`);
  assert(await evaluate(`document.activeElement===document.querySelector('.pet-keyboard-input') && !document.querySelector('.pet-chat,.chat-input,.pet-menu')`), 'Talk must focus the native editor without showing a popup or input box');
  await evaluate(`(()=>{const input=document.querySelector('.pet-keyboard-input');input.value='想去公園';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));})()`);
  await wait(`!petQA.chatPending()`);
  assert(await evaluate(`petQA.reply()==='想去公園' && petQA.message().includes('沿途') && !petQA.talking()`), 'Keyboard Enter should send and show the returned response');
  await evaluate(`document.querySelectorAll('.pet-fab')[2].click()`);

  // The same global pet is available on every main tab when it is logically there.
  for (const tab of ['home', 'task', 'shop', 'collection', 'profile']) {
    await go(tab);
    await evaluate(`petQA.petTab.set('${tab}');petQA.roaming.x=100;petQA.roaming.remaining=999`);
    await wait(`petQA.isHere() && getComputedStyle(document.querySelector('app-companion')).display!=='none'`);
    assert(await evaluate(`ng.getComponent(document.querySelector('app-companion'))===petQA`), 'Global instance changed on ' + tab);
  }

  const layouts = [];
  for (const [width, height] of [[320, 568], [320, 844], [375, 812], [390, 844], [430, 844], [1024, 768]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await evaluate(`petQA.roaming.x=innerWidth-132;document.querySelector('.pet-body').click()`);
    await pause(200);
    const layout = await evaluate(`(()=>{const r=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {menu:r('.pet-fabs'),speech:r('.pet-feedback'),pet:r('.pet-body'),floor:r('ion-tab-bar'),overflow:document.documentElement.scrollWidth>innerWidth}})()`);
    assert(!layout.overflow && layout.menu.left >= 0 && layout.menu.right <= width && layout.speech.top >= 0 && layout.menu.bottom <= layout.pet.top + 6, 'FABs outside viewport: ' + JSON.stringify({ width, height, ...layout }));
    assert(Math.abs(layout.pet.bottom - layout.floor.top - 5) < 2, 'Pet is not grounded on tabs');
    layouts.push({ width, height, ...layout });
    if (width === 390) await snap('companion-interaction-preview');
    await evaluate(`document.querySelectorAll('.pet-fab')[2].click()`);
  }

  // Simulate an overlay software keyboard through VisualViewport geometry.
  // This verifies focus/layout/IME handling, not a physical iOS/Android keyboard.
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
  await evaluate(`(()=>{petQA.greet();petQA.talk();window.petOriginalViewport=window.visualViewport;Object.defineProperty(window,'visualViewport',{configurable:true,value:{height:268,offsetTop:0}});const input=document.querySelector('.pet-keyboard-input');input.value='一起散步';input.dispatchEvent(new Event('input',{bubbles:true}));window.dispatchEvent(new Event('resize'));})()`);
  await pause(200);
  const keyboardLayout = await evaluate(`(()=>{const r=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {speech:r('.pet-feedback'),fabs:r('.pet-fabs'),pet:r('.pet-body'),editorFocused:document.activeElement===document.querySelector('textarea.pet-keyboard-input')}})()`);
  assert(keyboardLayout.editorFocused && keyboardLayout.speech.top >= 0 && keyboardLayout.fabs.bottom <= keyboardLayout.pet.top && keyboardLayout.pet.bottom <= 274, 'Keyboard should leave the pet and FABs visible: ' + JSON.stringify(keyboardLayout));
  await evaluate(`Object.defineProperty(window,'visualViewport',{configurable:true,value:window.petOriginalViewport});petQA.close();window.dispatchEvent(new Event('resize'))`);

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await go('home');
  await evaluate(`petQA.petTab.set('home');petQA.roaming.x=90;petQA.roaming.direction=1;petQA.roaming.remaining=999`);
  for (const [behavior, asset] of [['feeding', 'eating'], ['sleeping', 'sleeping'], ['walking', 'running'], ['playing', 'neutral']]) {
    await evaluate(`petQA.roaming.behavior='${behavior}';petQA.behavior.set('${behavior}')`);
    await wait(`document.querySelector('.pet-body img').src.includes('chipmunk-${asset}') && document.querySelector('.pet-body img').complete && document.querySelector('.pet-body img').naturalWidth>0`);
    await pause(250);
    const first = await evaluate(`document.querySelector('.pet-body canvas').toDataURL()`);
    await pause(180);
    const second = await evaluate(`document.querySelector('.pet-body canvas').toDataURL()`);
    assert(first !== second, 'Expected continuous motion in ' + behavior);
    if (behavior === 'sleeping' || behavior === 'feeding' || behavior === 'walking') await snap(`companion-${behavior}-preview`);
  }
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await pause(200);
  const staticX = await evaluate(`petQA.roaming.x`);
  await pause(200);
  assert(await evaluate(`petQA.roaming.x===${staticX} && getComputedStyle(document.querySelector('.pet-body img')).visibility==='visible'`), 'Reduced motion must keep a static character');
  assert(!errors.length && !missingAssets.length, JSON.stringify({ errors, missingAssets }));
  console.log(JSON.stringify({ layouts, keyboardLayout, autonomousOffTab: true, circularEdges: true, persistentInstance: true, interactions: true, offlineChatFixture: true, assetsAndMotion: true, reducedMotion: true, errors, missingAssets }, null, 2));
} finally { ws?.close(); chrome.kill(); server.close(); }
