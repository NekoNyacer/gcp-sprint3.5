// Run against a deployed production build; unit mocks cannot catch worker minification.
const { spawn } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const target = process.argv[2];
if (!target || !/^https?:\/\//.test(target)) throw new Error('Pass the preview URL');
const port = 9224;
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--enable-unsafe-swiftshader', '--no-first-run',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cat-walk-map-'))}`,
  ...(process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`] : []),
  'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws;
(async () => {
  let tabs;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; }
    catch { await delay(300); }
  }
  if (!tabs) throw new Error('Chrome debugging endpoint unavailable');
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => { ws.onopen = resolve; });
  let id = 0;
  const pending = new Map();
  const exceptions = new Set();
  let workerLoaded = false;
  const send = (method, params = {}) => new Promise(resolve => {
    pending.set(++id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { pending.get(message.id)?.(message.result); pending.delete(message.id); }
    if (message.method === 'Runtime.exceptionThrown') {
      const description = message.params.exceptionDetails.exception?.description || '';
      if (/ReferenceError/.test(description)) exceptions.add(description.split('\n')[0]);
    }
    if (message.method === 'Network.responseReceived') {
      const { url, status } = message.params.response;
      if (url.includes('mapbox-gl-csp-worker.js') && status === 200) workerLoaded = true;
    }
    if (message.method === 'Target.targetCreated' &&
        message.params.targetInfo.type === 'worker' &&
        message.params.targetInfo.url.includes('mapbox-gl-csp-worker.js')) workerLoaded = true;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Target.setDiscoverTargets', { discover: true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__mapTestWorkerUrls = [];
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        window.__mapTestWorkerUrls.push(String(url));
      }
    };
  ` });
  await send('Page.navigate', { url: target });
  let entered = false;
  let readyAt = null;
  let result;
  for (let attempt = 0; attempt < 60; attempt++) {
    await delay(1000);
    if (!entered) {
      const click = await send('Runtime.evaluate', { expression: `(() => { const button = Array.from(document.querySelectorAll('ion-button')).find(x => x.textContent.includes('Demo')); if (!button) return false; button.click(); return true; })()` });
      entered = click.result?.value === true;
    }
    const state = await send('Runtime.evaluate', { expression: `JSON.stringify({ failed: document.body.innerText.includes('地圖暫時無法顯示'), ready: !!document.querySelector('.mapboxgl-ctrl-compass'), canvas: !!document.querySelector('canvas.mapboxgl-canvas'), workerLoaded: (window.__mapTestWorkerUrls || []).some(url => url.includes('mapbox-gl-csp-worker.js')) })` });
    if (state.result?.value) result = JSON.parse(state.result.value);
    workerLoaded ||= result?.workerLoaded === true;
    if (result?.ready && readyAt === null) readyAt = Date.now();
    // Map load precedes worker tile parsing; keep observing for late failures.
    if (result?.failed || (readyAt !== null && Date.now() - readyAt >= 20000)) break;
  }
  console.log(JSON.stringify({ ...result, workerLoaded, referenceErrors: [...exceptions] }));
  if (!result?.ready || result.failed || !workerLoaded || exceptions.size) process.exitCode = 1;
  ws.send(JSON.stringify({ id: ++id, method: 'Browser.close' }));
  ws.close();
})().catch(error => { console.error(error.message); process.exitCode = 1; ws?.close(); browser.kill(); });
