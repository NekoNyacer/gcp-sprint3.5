// Create a reusable, slide-sized 16:9 species growth atlas from the procedural model renders.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const species = [
  ['banyan', '榕樹', '#659345'], ['camphor', '樟樹', '#44856a'],
  ['osmanthus', '桂花', '#507b37'], ['persimmon', '柿子', '#7c963e'],
  ['sweetgum', '楓香', '#b9693f'], ['cherry', '櫻花', '#7ba762'],
  ['ginkgo', '銀杏', '#c7b64b'], ['cathay', '國泰小樹', '#419c66'],
];
const stages = [
  ['young', '小樹', '30%', '品種揭曉'], ['mature', '大樹', '60%', ''],
  ['flowering', '開花', '85%', ''], ['large', '結果', '100%', ''],
];
const img = (name, alt) => `<img src="../client/public/images/tree-species/${name}.png" alt="${alt}" />`;
const html = `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=1920, initial-scale=1">
<title>神秘種子・樹木品種圖鑑</title>
<style>
*{box-sizing:border-box}html,body{width:1920px;height:1080px;margin:0;overflow:hidden}body{font-family:"Microsoft JhengHei","Noto Sans TC",Arial,sans-serif;color:#23382f;background:#f5f6ed;background-image:radial-gradient(ellipse at 88% 0%,#e4edd8 0,transparent 34%),linear-gradient(135deg,#f7f7ef,#eff3e9)}
.slide{height:1080px;padding:28px 84px 20px;display:flex;flex-direction:column}.top{height:120px;display:flex;justify-content:space-between;align-items:flex-start}.eyebrow{color:#70855d;letter-spacing:2.8px;text-transform:uppercase;font-size:13px;font-weight:700}.title{font-size:39px;line-height:1.2;letter-spacing:.5px;font-weight:750;margin:8px 0 7px}.subtitle{color:#69766b;font-size:15px;margin:0}.rule{margin-top:10px;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e5e9dc;border-radius:14px;padding:13px 19px;color:#58675d;font-size:13px}.rule b{font-size:21px;color:#536f42}.rule em{font-style:normal;color:#a6afa4}.rule strong{color:#486d3e}.atlas{flex:1;display:grid;grid-template-rows:42px repeat(8,1fr);gap:4px 12px;min-height:0}.head,.row{display:grid;grid-template-columns:220px repeat(4,minmax(0,1fr));gap:12px;min-height:0}.head{align-items:center;border-bottom:1px solid #dbe2d3}.head .col{height:39px;display:flex;justify-content:center;align-items:center;gap:9px;color:#4c5d4f;font-size:14px;font-weight:700}.head .col.reveal-col{color:#345a40}.stage-number{font-size:11px;letter-spacing:.5px;color:#849180}.row{align-items:center;background:rgba(255,255,255,.70);border:1px solid rgba(224,230,218,.9);border-radius:12px;padding:0 7px}.name{height:100%;display:flex;align-items:center;gap:11px;padding-left:13px;font-size:15px;font-weight:700}.dot{width:10px;height:10px;border-radius:50%;box-shadow:0 0 0 4px color-mix(in srgb,var(--leaf) 14%,transparent);background:var(--leaf)}.art{height:100%;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}.art img{display:block;width:120px;height:90px;object-fit:contain;transform:translateY(2px)}.art.reveal-art:before{content:"";position:absolute;inset:7px 8%;border-radius:10px;background:linear-gradient(120deg,rgba(237,244,222,.6),rgba(251,250,234,.3));border:1px solid rgba(202,219,184,.65)}.art.reveal-art img{position:relative}.foot{height:38px;display:flex;align-items:flex-end;justify-content:space-between;color:#798579;font-size:11px}.foot strong{color:#536c4c;font-weight:600}.foot .milestones{letter-spacing:.5px}
</style></head><body><main class="slide"><header class="top"><div><div class="eyebrow">CAT WALK &nbsp;·&nbsp; SPECIES GROWTH ATLAS</div><h1 class="title">一顆神秘種子，長成八種樹木</h1><p class="subtitle">種下時品種保密；成長至小樹，才揭曉牠的模樣。</p></div><div class="rule"><b>✦</b><span>種子</span><em>→</em><span>幼苗</span><em>→</em><span>小樹苗</span><em>→</em><span>大樹苗</span><em>→</em><strong>小樹・揭曉品種</strong></div></header>
<section class="atlas"><div class="head"><div></div>${stages.map(([id,name,pct,tag],i)=>`<div class="col ${i===0?'reveal-col':''}"><span>${String(i+1).padStart(2,'0')}</span><span>${name}</span><span class="stage-number">${pct}</span>${tag?`<span>✦ ${tag}</span>`:''}</div>`).join('')}</div>
${species.map(([id,name,color])=>`<div class="row" style="--leaf:${color}"><div class="name"><i class="dot"></i>${name}</div>${stages.map(([stage])=>`<div class="art ${stage==='young'?'reveal-art':''}">${img(`${id}-${stage}`,`${name}・${stage}`)}</div>`).join('')}</div>`).join('')}
</section><footer class="foot"><span class="milestones">30% 小樹　·　60% 大樹　·　85% 開花　·　100% 結果</span><strong>散步發現種子・持續照料・探索樹木圖鑑</strong></footer></main></body></html>`;

await writeFile(resolve(root, 'docs/tree-species-growth-slide-16x9.html'), html, 'utf8');
const server = createServer(async (req, res) => {
  if (req.url === '/slide') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
  const prefix = '/client/public/';
  if (req.url?.startsWith(prefix)) {
    const file = resolve(root, 'client/public', decodeURIComponent(req.url.slice(prefix.length)));
    if (!file.startsWith(resolve(root, 'client/public') + '\\')) { res.statusCode=403; res.end(); return; }
    try { res.setHeader('Content-Type', 'image/png'); res.end(await readFile(file)); return; } catch { /* return a normal 404 */ }
  }
  res.statusCode = 404; res.end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const profile = await import('node:fs/promises').then(fs => fs.mkdtemp(join(tmpdir(), 'cat-walk-slide-')));
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new','--no-first-run','--remote-debugging-port=9339',`--user-data-dir=${profile}`,'about:blank',
], {windowsHide:true,stdio:'ignore'});
let ws;
try {
  let tabs;
  for(let i=0;i<50;i++){try{tabs=await(await fetch('http://127.0.0.1:9339/json')).json();break;}catch{await new Promise(r=>setTimeout(r,200));}}
  if(!tabs)throw new Error('Chrome did not start');
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}};
  const send=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw new Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;};
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/slide`});
  await evaluate('new Promise((resolve,reject)=>{let n=0;const images=[...document.images];const check=()=>{if(images.every(i=>i.complete&&i.naturalWidth)){resolve()}else if(++n>60){reject(new Error("圖片載入失敗"))}else setTimeout(check,100)};check()})');
  const report=await evaluate('({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,images:document.images.length,broken:[...document.images].filter(i=>!i.naturalWidth).length})');
  if(report.width!==1920||report.height!==1080||report.images!==32||report.broken)throw new Error(JSON.stringify(report));
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const output=resolve(root,'docs/tree-species-growth-slide-16x9.png');
  await writeFile(output,Buffer.from(screenshot.result.data,'base64'));
  const png=await readFile(output);
  const dimensions={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
  if(dimensions.width!==1920||dimensions.height!==1080)throw new Error(JSON.stringify(dimensions));
  console.log(JSON.stringify({...report,...dimensions,output}));
} finally {ws?.close();chrome.kill();server.close();}
