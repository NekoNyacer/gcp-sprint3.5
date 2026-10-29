// Extract and align generated agent-state poses, without changing App assets.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { PNG } = require('pngjs');
const root='client/public/images/pet/motion-studies/agent-states';
for (const name of ['thinking','success','confused']) {
  const image=PNG.sync.read(await readFile(join(root,`${name}-source.png`)));
  const {width,height,data}=image, count=width*height;
  const seen=new Uint8Array(count),labels=new Int16Array(count),queue=new Int32Array(count),components=[];
  const neighbors=p=>{const x=p%width,y=Math.floor(p/width);return [x>0?p-1:-1,x<width-1?p+1:-1,y>0?p-width:-1,y<height-1?p+width:-1]};
  for(let p=0;p<count;p++) {
    if(seen[p]||data[p*4+3]<96) continue;
    let read=0,len=1,left=width,right=0,top=height,bottom=0; queue[0]=p;seen[p]=1;
    while(read<len) {const q=queue[read++], x=q%width,y=Math.floor(q/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const n of neighbors(q)){if(n<0||seen[n]||data[n*4+3]<96)continue;seen[n]=1;queue[len++]=n;}}
    if(len<1500)continue;
    const id=components.length+1; for(let i=0;i<len;i++)labels[queue[i]]=id;components.push({id,left,right,top,bottom,area:len});
  }
  if(components.length!==8)throw Error(`${name}: expected 8 separate animals, got ${components.length}`);
  const sorted=[0,1].flatMap(row=>components.filter(c=>Math.floor((c.top+c.bottom)/height)===row).sort((a,b)=>a.left-b.left));
  if(sorted.length!==8)throw Error(`${name}: unexpected layout`);
  const distance=new Uint8Array(count);let len=0;for(let p=0;p<count;p++)if(labels[p])queue[len++]=p;
  // Limit expansion so a nearby animal's detached whiskers do not leak into this frame.
  for(let read=0;read<len;read++){const p=queue[read];if(distance[p]>=16)continue;for(const n of neighbors(p)){if(n<0||labels[n])continue;labels[n]=labels[p];distance[n]=distance[p]+1;queue[len++]=n;}}
  const frameWidth=Math.max(...sorted.map(c=>c.right-c.left+1))+92,frameHeight=Math.max(...sorted.map(c=>c.bottom-c.top+1))+92;
  const atlas=new PNG({width:frameWidth*4,height:frameHeight*2});
  for(let i=0;i<8;i++){
    const c=sorted[i],offsetX=Math.round(frameWidth/2-(c.left+c.right)/2),offsetY=frameHeight-46-c.bottom;
    for(let y=Math.max(0,c.top-16);y<=Math.min(height-1,c.bottom+16);y++)for(let x=Math.max(0,c.left-16);x<=Math.min(width-1,c.right+16);x++){
      if(labels[y*width+x]!==c.id)continue; const dx=x+offsetX,dy=y+offsetY;
      if(dx<0||dy<0||dx>=frameWidth||dy>=frameHeight)throw Error(`${name} frame ${i+1} clipped`);
      const src=(y*width+x)*4,dst=(((Math.floor(i/4)*frameHeight)+dy)*atlas.width+(i%4)*frameWidth+dx)*4;
      data.copy(atlas.data,dst,src,src+4);
    }
  }
  await writeFile(join(root,`${name}-atlas.png`),PNG.sync.write(atlas));
  const manifest={name,source:`${name}-source.png`,atlas:`${name}-atlas.png`,columns:4,rows:2,frameCount:8,frameWidth,frameHeight,framesPerSecond:6,loop:name!=='success',usableFrameRange:[1,8],usableFrameRangePurpose:'preview only; not a production-quality acceptance',sourceBoundaryClippedFrames:name==='thinking'?[]:[4,8],registration:'constant scale; silhouette horizontally centered and bottom aligned',caveat:'Review poses only: body and facial proportions drift; alignment does not synthesize intermediate movement. Some whiskers touch the source edge; do not treat all frames as production-ready.',bounds:sorted};
  await writeFile(join(root,`${name}.json`),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({name,frameWidth,frameHeight,bounds:sorted}));
}
