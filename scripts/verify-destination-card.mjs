// Render the actual development-built component with local-only fixture data.
import {readFile, readdir, writeFile, mkdtemp} from 'node:fs/promises';
import {resolve, join, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'client/dist/client/browser');
const chunks = await Promise.all((await readdir(dist)).filter(f => /^chunk-.*\.js$/.test(f))
  .map(async name => ({name, text: await readFile(join(dist, name), 'utf8')})));
const exported = name => chunks.find(c => c.text.slice(c.text.lastIndexOf('export {')).includes(`  ${name}`))?.name;
const component = chunks.find(c => c.text.includes('var HomePlanComponent ='));
if (!component) throw new Error('Build the client in development mode first.');
const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><style>body{margin:0;background:#f1f1f1}home-plan{margin:16px}</style></head><body><ion-app><home-plan></home-plan></ion-app><script type="module">
import {bootstrapApplication,provideIonicAngular} from '/${exported('bootstrapApplication')}';
import {LocationStore,WalkSessionStore} from '/${exported('LocationStore')}';
import {ProgressStore} from '/${exported('ProgressStore')}';
import {HomePlanComponent} from '/${component.name}';
const no=()=>false,empty=()=>[],nil=()=>null;
try {
 const store={hasDestination:()=>true,destinationConfirmed:no,destination:nil,taskPoints:empty,availableTaskPoints:empty,treeStops:empty,plannedDistanceMeters:()=>1200,plannedDurationSeconds:()=>1080,planningError:nil,routeLoading:no,routingFailed:no,routeNeedsUpdate:no};
 const app=await bootstrapApplication(HomePlanComponent,{providers:[provideIonicAngular({mode:'md',animated:false}),{provide:LocationStore,useValue:{current:nil}},{provide:ProgressStore,useValue:{demoTrees:()=>({}),demoDay:()=> '2026-10-27'}},{provide:WalkSessionStore,useValue:store}]});
 const ref=app.components[0],vm=ref.instance;
 vm.selectedTree=()=>({poiName:'大安森林公園'});
 ref.changeDetectorRef.detectChanges();
 window.qa={app,ref,vm,events:[]};
 vm.reselectDestination.subscribe(()=>qa.events.push('reselect'));
 vm.confirmDestination.subscribe(()=>qa.events.push('confirm'));
 window.qa.ready=true;
}catch(e){window.qa={error:String(e)}}
</script></body></html>`;
const server=createServer(async(req,res)=>{
 try{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  const pathname=decodeURIComponent(req.url.split('?')[0]);
  const path=resolve(dist,'.'+pathname);
  if(!path.startsWith(dist+sep)){res.statusCode=403;res.end();return;}
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(path)]??'application/octet-stream');
  let data=pathname.startsWith('/svg/') ? await readFile(join(root,'client/node_modules/ionicons/dist',pathname)) : await readFile(path);
  if(path===join(dist,component.name)) data=Buffer.from(data.toString()+'\nexport {HomePlanComponent};');
  res.end(data);
 }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless=new','--no-first-run','--remote-debugging-port=9343',`--user-data-dir=${await mkdtemp(join(tmpdir(),'cat-destination-'))}`,'about:blank'
],{windowsHide:true,stdio:'ignore'});
let ws;
try{
 let tabs;
 for(let i=0;i<50;i++){try{tabs=await(await fetch('http://127.0.0.1:9343/json')).json();break;}catch{await new Promise(r=>setTimeout(r,200));}}
 if(!tabs)throw new Error('Chrome did not start');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);
 let id=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}};
 const send=(method,params={})=>new Promise(r=>{const callId=++id;pending.set(callId,r);ws.send(JSON.stringify({id:callId,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw new Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;};
 const pause=()=>new Promise(r=>setTimeout(r,200));
 await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:300,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
 for(let i=0;i<60;i++){if(await evaluate('!!window.qa?.ready'))break;const err=await evaluate('window.qa?.error');if(err)throw new Error(err);await pause();}
 const report=[];
 for(const width of [253,320,390,430]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:300,deviceScaleFactor:1,mobile:true});await pause();
  const result=await evaluate(`(()=>{const card=document.querySelector('.selected-destination'),buttons=[...document.querySelectorAll('.destination-actions ion-button')],chips=[...document.querySelectorAll('.route-info>div')];return {width,card:card.getBoundingClientRect().toJSON(),buttons:buttons.map(b=>{const n=b.shadowRoot.querySelector('button');return {rect:b.getBoundingClientRect().toJSON(),background:getComputedStyle(n).backgroundColor,fontSize:getComputedStyle(n).fontSize,color:getComputedStyle(n).color}}),chipRows:[...new Set(chips.map(c=>Math.round(c.getBoundingClientRect().top)))],overflow:document.documentElement.scrollWidth>innerWidth}})()`.replace('{width,','{width:'+width+','));
  if(result.overflow||result.chipRows.length!==1||Math.abs(result.buttons[0].rect.y-result.buttons[1].rect.y)>1||Math.abs(result.buttons[0].rect.width-result.buttons[1].rect.width)>1)throw new Error(JSON.stringify(result));
  report.push(result);
  if(width===390){const shot=await send('Page.captureScreenshot',{format:'png',clip:{x:result.card.x,y:result.card.y,width:result.card.width,height:result.card.height,scale:1}});await writeFile(join(root,'docs/destination-card-preview.png'),Buffer.from(shot.result.data,'base64'));}
 }
 await evaluate(`document.querySelector('.destination-reselect').click();document.querySelector('.plan-confirm').click()`);
 if((await evaluate('qa.events.join(",")'))!=='reselect,confirm')throw new Error('Actions did not emit');
 console.log(JSON.stringify({report,actions:'passed'}));
}finally{ws?.close();chrome.kill();server.close();}
