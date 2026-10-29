// Register existing generated poses. No new anatomical poses or in-between pixels.
import {createRequire} from 'node:module';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const {PNG} = require('pngjs');
const root = 'client/public/images/pet';
const output = join(root, 'animations/drag-drop');
await mkdir(output, {recursive: true});
const clips = [
  {name: 'pickup', source: 'pickup-v2-source.png', columns: 2, rows: 2, width: 370, durations: [80,90,110,120], loop: false},
  {name: 'held', source: 'held-source.png', columns: 2, rows: 2, width: 370, durations: [220,160,220,160], loop: true},
  {name: 'falling', source: 'release-fall.png', columns: 4, rows: 2, width: 370, durations: [60,60,80,80,70,70,70,110], loop: false},
  {name: 'jumping-up', source: 'jump-up-source.png', columns: 4, rows: 2, width: 370, durations: [100,90,100,110,110,100,100,90], loop: false},
  {name: 'jumping-down', source: 'jump-down-source.png', columns: 4, rows: 2, width: 370, durations: [100,90,100,110,110,100,100,90], loop: false},
  {name: 'sleeping', source: 'sleep-study.png', columns: 4, rows: 2, width: 320, durations: [400,300,300,400,400,300,300,400], loop: true},
];
const cellWidth = 460, cellHeight = 400, baseline = 376;
for (const clip of clips) {
  const bytes = await readFile(join(root, 'motion-studies/drag-drop', clip.source));
  const image = PNG.sync.read(bytes);
  // Some authored poses cross their nominal grid row. Extract whole connected
  // silhouettes from the sheet before sorting; regular cell crops cut tails/feet.
  const w=image.width,h=image.height,total=w*h,visited=new Uint8Array(total),labels=new Int16Array(total),queue=new Int32Array(total),components=[];
  const neighbours = p => {const x=p%w,y=Math.floor(p/w);return [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1];};
  for(let start=0;start<total;start++) {
    if(visited[start] || image.data[start*4+3]<64) continue;
    let read=0,count=1,left=w,right=0,top=h,bottom=0;
    queue[0]=start;visited[start]=1;
    while(read<count) {
      const p=queue[read++],x=p%w,y=Math.floor(p/w);
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const next of neighbours(p)) if(next>=0 && !visited[next] && image.data[next*4+3]>=64){visited[next]=1;queue[count++]=next;}
    }
    if(count<10000) continue;
    const id=components.length+1;
    for(let i=0;i<count;i++) labels[queue[i]]=id;
    components.push({id,left,right,top,bottom});
  }
  if(components.length!==clip.columns*clip.rows) throw Error(`${clip.name}: expected ${clip.columns*clip.rows} complete silhouettes, got ${components.length}`);
  let length=0;
  const distance=new Uint8Array(total);
  for(let p=0;p<total;p++)if(labels[p])queue[length++]=p;
  for(let read=0;read<length;read++){
    const p=queue[read];if(distance[p]>=18)continue;
    for(const next of neighbours(p))if(next>=0&&!labels[next]){labels[next]=labels[p];distance[next]=distance[p]+1;queue[length++]=next;}
  }
  const sorted=Array.from({length:clip.rows},(_,row)=>components.filter(c=>Math.floor((c.top+c.bottom)/2/h*clip.rows)===row).sort((a,b)=>a.left-b.left)).flat();
  if(sorted.length!==components.length)throw Error(`${clip.name}: unexpected row layout`);
  const frames=sorted.map(main=>({id:main.id,main,
    bounds:{left:Math.max(0,main.left-18),right:Math.min(w-1,main.right+18),top:Math.max(0,main.top-18),bottom:Math.min(h-1,main.bottom+18)},
    sourceCellTouches:main.left===0||main.right===w-1||main.top===0||main.bottom===h-1}));
  const scale = Math.min(clip.width / Math.max(...frames.map(f => f.bounds.right-f.bounds.left+1)),
    342 / Math.max(...frames.map(f => f.bounds.bottom-f.bounds.top+1)));
  const atlas = new PNG({width:cellWidth*clip.columns,height:cellHeight*clip.rows});
  let staticFrame;
  frames.forEach((frame,index) => {
    const b=frame.bounds,sourceWidth=b.right-b.left+1,sourceHeight=b.bottom-b.top+1;
    const width=Math.round(sourceWidth*scale),height=Math.round(sourceHeight*scale);
    const left=Math.round((cellWidth-width)/2),top=baseline-Math.round((frame.main.bottom-b.top+1)*scale);
    const cell = new PNG({width:cellWidth,height:cellHeight});
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
      const dx=left+x,dy=top+y;
      if(dx<0 || dx>=cellWidth || dy<0 || dy>=cellHeight) throw Error(`${clip.name} frame ${index}: clipped output`);
      const from=((b.top+Math.min(sourceHeight-1,Math.floor(y/scale)))*image.width+b.left+Math.min(sourceWidth-1,Math.floor(x/scale)))*4;
      if(labels[from/4]!==frame.id) continue;
      const to=(dy*cellWidth+dx)*4;
      image.data.copy(cell.data,to,from,from+4);
      const atlasTo=((Math.floor(index/clip.columns)*cellHeight+dy)*atlas.width+index%clip.columns*cellWidth+dx)*4;
      image.data.copy(atlas.data,atlasTo,from,from+4);
    }
    if(index===0) staticFrame=cell;
    frame.outputBounds={left,top,width,height};
  });
  await writeFile(join(output, `${clip.name}-atlas.png`),PNG.sync.write(atlas));
  if(clip.name==='sleeping') await writeFile(join(output,'sleeping-static.png'),PNG.sync.write(staticFrame));
  const manifest={source:`../../motion-studies/drag-drop/${clip.source}`,sourceSha256:createHash('sha256').update(bytes).digest('hex'),
    columns:clip.columns,rows:clip.rows,frames:frames.length,frameWidth:cellWidth,frameHeight:cellHeight,baseline,footInset:cellHeight-baseline,
    scale,durations:clip.durations,durationMs:clip.durations.reduce((a,b)=>a+b,0),loop:clip.loop,registration:'one uniform scale per source sheet; main silhouette horizontally centred and lowest opaque paw/body point aligned; antialiased padding retained',
    limitations:'Source anatomy, viewpoint and contacts may change between poses. Alignment cannot synthesize transitions or restore clipped source whiskers. Held sprites are not a skeletal rig.',frameDetails:frames};
  await writeFile(join(output,`${clip.name}.json`),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({name:clip.name,frames:frames.length,scale,durationMs:manifest.durationMs,sourceEdgeContacts:frames.filter(f=>f.sourceCellTouches).length}));
}
await writeFile(join(output,'README.md'),`# Drag, jump and sleep runtime assets\n\nDerived from existing imagegen source sheets in ../../motion-studies/drag-drop/. Originals remain unchanged. Prefer pickup-v2-source and jump-down-source; earlier pickup-source/jump-down-alternate are not runtime inputs. Every clip has a source hash, dimensions, fixed scale, durations and registration bounds in its JSON.\n\nAll cells are 460×400 with main paw/body baseline376 and footInset24. Sleeping width is limited to320 source pixels (about86CSSpx on the128×108 pet host), comparable to the existing idle, avoiding the oversized legacy sleeping fallback. No nonuniform anatomical scaling or invented in-between poses.\n\nSource pose anatomy, view and whiskers can still vary. Exact baseline registration does not prove natural motion. Rebuild with node scripts/prepare-companion-drag-animations.mjs from the repository root.\n`);
