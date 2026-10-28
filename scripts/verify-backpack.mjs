// Local fixture of the actual compiled component. No authentication or cloud writes.
import { readFile, readdir, writeFile, mkdtemp } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'client/dist/client/browser');
const chunks = await Promise.all((await readdir(dist)).filter(f => /^chunk-.*\.js$/.test(f)).map(async name => ({ name, text: await readFile(join(dist, name), 'utf8') })));
const exported = name => chunks.find(c => c.text.slice(c.text.lastIndexOf('export {')).includes(`  ${name}`))?.name;
const component = chunks.find(c => c.text.includes('var HomeBackpackComponent ='));
if (!component) throw new Error('Build the client in development mode first.');
const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><style>body{margin:0;background:#d8e0cc}body:before{content:'散步的風景';position:fixed;top:25px;left:25px;color:#677451;font-size:18px}</style></head><body><ion-app><home-backpack></home-backpack></ion-app><script type="module">
import { bootstrapApplication, provideIonicAngular } from '/${exported('bootstrapApplication')}';
import { SessionStore } from '/${exported('SessionStore')}';
import { HomeBackpackComponent, backpackSeeds } from '/${component.name}';
try {
 const app=await bootstrapApplication(HomeBackpackComponent,{providers:[provideIonicAngular({mode:'md',animated:false}),{provide:SessionStore,useValue:{displayName:()=> '國泰阿發'}}]});
 const ref=app.components[0],vm=ref.instance;
 const seeds=backpackSeeds(['桂花','榕樹','柿子','銀杏','櫻花','樟樹','楓香','國泰小樹','榕樹','桂花','柿子','銀杏'].map((species,i)=>({id:'seed-'+i,species,seedTypeId:'mystery',version:1,origin:{routeId:'banqiao-walk',place:['板橋車站','新板萬坪公園','新北市市民廣場'][i%3],acquiredAt:1}})),12);
 window.qa={app,ref,vm,seeds,plants:[]};
 vm.plant.subscribe(value=>{window.qa.plants.push(value);ref.setInput('open',false);app.tick()});
 vm.closed.subscribe(()=>{ref.setInput('open',false);app.tick()});
 ref.setInput('seeds',seeds);ref.setInput('fertilizer',3);ref.setInput('canPlant',true);ref.setInput('canFertilize',true);ref.setInput('open',true);app.tick();window.qa.ready=true;
}catch(e){window.qa={error:String(e)}}
</script></body></html>`;
const server = createServer(async (req,res) => {
  try {
    if (req.url === '/') { res.setHeader('Content-Type','text/html');res.end(html);return; }
    const path = resolve(dist,'.'+decodeURIComponent(req.url.split('?')[0]));
    if (!path.startsWith(dist+sep)) { res.statusCode=403;res.end();return; }
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[extname(path)] ?? 'application/octet-stream');
    let data=await readFile(path);
    if (path===join(dist,component.name)) data=Buffer.from(data.toString()+'\nexport { HomeBackpackComponent, backpackSeeds };');
    res.end(data);
  } catch {res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const chrome=spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--no-first-run','--remote-debugging-port=9341',`--user-data-dir=${await mkdtemp(join(tmpdir(),'cat-backpack-'))}`,'about:blank',
],{windowsHide:true,stdio:'ignore'});
let ws;
try {
  let tabs;
  for(let i=0;i<50;i++){try{tabs=await(await fetch('http://127.0.0.1:9341/json')).json();break;}catch{await new Promise(r=>setTimeout(r,200));}}
  if(!tabs)throw new Error('Chrome did not start');
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.onopen=r);
  let id=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);};
  const send=(method,params={})=>new Promise(r=>{const callId=++id;pending.set(callId,r);ws.send(JSON.stringify({id:callId,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw new Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;};
  const pause=()=>new Promise(r=>setTimeout(r,250));
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const screenshot=async name=>{const result=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(root,'docs',name),Buffer.from(result.result.data,'base64'));};
  await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
  for(let i=0;i<80;i++){if(await evaluate('!!window.qa?.ready'))break;const error=await evaluate('window.qa?.error');if(error)throw new Error(error);await pause();}
  await pause();
  assert(await evaluate('!!document.querySelector(".seed-card")'),'Backpack did not mount: '+errors.join(','));
  const report=[];
  for(const width of [320,390,430,1024]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await pause();
    const state=await evaluate(`(()=>{const modal=document.querySelector('.backpack-sheet'),box=modal.shadowRoot.querySelector('[part="content"]').getBoundingClientRect(),cards=[...document.querySelectorAll('.seed-card')],rects=cards.slice(0,4).map(c=>c.getBoundingClientRect());return {width:${width},height:box.height,top:box.top,columns:getComputedStyle(document.querySelector('.seed-grid')).gridTemplateColumns.split(' ').length,overflow:document.documentElement.scrollWidth>innerWidth,gridOverflow:document.querySelector('.seed-grid').scrollWidth>document.querySelector('.seed-grid').clientWidth,cards:cards.length,firstRow:rects[0].top===rects[2].top&&rects[3].top>rects[2].top}})()`);
    report.push(state);assert(!state.overflow&&!state.gridOverflow&&state.columns===3&&state.cards===12&&state.firstRow&&Math.abs(state.height-844*.9)<3,JSON.stringify(state));
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause();
  await screenshot('backpack-seeds-preview.png');
  await evaluate(`document.querySelector('ion-segment-button[value="items"]').click()`);await pause();
  assert(await evaluate(`!!document.querySelector('.fertilizer-card')&&!document.querySelector('.seed-grid')`),'Segment did not switch');
  await screenshot('backpack-items-preview.png');
  await evaluate(`document.querySelector('ion-segment-button[value="seeds"]').click()`);await pause();
  await evaluate(`document.querySelector('.seed-card').click()`);await pause();
  assert(await evaluate(`document.querySelector('#seed-tree-name')?.value==='國泰阿發的樹'&&qa.plants.length===0`),'Default name or pre-confirmation failed');
  await screenshot('backpack-name-preview.png');
  await evaluate(`document.querySelector('.name-form .cancel').click()`);await pause();
  assert(await evaluate('qa.plants.length===0&&qa.vm.selectedSeed()===null'),'Cancel planted a seed');
  await evaluate(`document.querySelectorAll('.seed-card')[2].click()`);await pause();
  await evaluate(`const input=document.querySelector('#seed-tree-name');input.value='散步的回憶';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.name-form').requestSubmit()`);await pause();
  assert(await evaluate(`qa.plants.length===1&&qa.plants[0].id==='seed-2'&&qa.plants[0].name==='散步的回憶'`),'Confirm did not select the clicked seed');
  await evaluate(`qa.ref.setInput('seeds',[]);qa.ref.setInput('open',true);qa.app.tick()`);await pause();
  assert(await evaluate(`!!document.querySelector('.empty-inventory')&&!document.querySelector('.seed-card')`),'Empty inventory missing');
  await evaluate(`qa.vm.close()`);await pause();
  await evaluate(`qa.ref.setInput('seeds',qa.seeds);qa.ref.setInput('open',true);qa.app.tick()`);await pause();
  assert(await evaluate(`document.querySelectorAll('.seed-card').length===12`),'Drawer did not reopen');
  assert(errors.length===0,'Browser errors: '+errors.join(','));
  console.log(JSON.stringify({report,interactions:'segment, default name, cancel, confirm selected seed, empty inventory, reopen passed',errors}));
}finally{ws?.close();chrome.kill();server.close();}
