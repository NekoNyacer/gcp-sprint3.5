// Non-destructive preparation of newly generated food-key-pose sheets.
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(new URL('../client/package.json',import.meta.url));
const {PNG}=require('pngjs');
const dir=resolve('client/public/images/pet/motion-studies/jump-food-prepared');
for(const name of ['pick','rise']){
  const src=PNG.sync.read(await readFile(resolve(dir,`${name}-v4-source.png`)));
  const count=src.width*src.height,seen=new Uint8Array(count),labels=new Int16Array(count),q=new Int32Array(count),comps=[];
  for(let p=0;p<count;p++){
    if(seen[p]||src.data[p*4+3]<96)continue;
    let b=0,e=1,left=src.width,right=0,top=src.height,bottom=0;seen[p]=1;q[0]=p;
    while(b<e){const pos=q[b++],x=pos%src.width,y=Math.floor(pos/src.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const k of [x?pos-1:-1,x+1<src.width?pos+1:-1,y?pos-src.width:-1,y+1<src.height?pos+src.width:-1])if(k>=0&&!seen[k]&&src.data[k*4+3]>=96){seen[k]=1;q[e++]=k;}}
    if(e<1000)continue; const id=comps.length+1;for(let i=0;i<e;i++)labels[q[i]]=id;comps.push({id,left,right,top,bottom,area:e});
  }
  const bodies=comps.filter(c=>c.area>20000).sort((a,b)=>Math.floor(((a.top+a.bottom)/2)/(src.height/2))-Math.floor(((b.top+b.bottom)/2)/(src.height/2))||a.left-b.left);
  console.log(name,src.width,src.height,'bodies',bodies.length,JSON.stringify(comps));
  if(bodies.length!==8)throw Error(`${name}: expected 8 distinct bodies, found ${bodies.length}`);
  // Assign detached berries to the nearest body within the same generated row.
  const small=comps.filter(c=>c.area<=20000);
  for(const component of small){const cx=(component.left+component.right)/2,cy=(component.top+component.bottom)/2;
    const candidates=bodies.filter(c=>Math.floor(((c.top+c.bottom)/2)/(src.height/2))===Math.floor(cy/(src.height/2)));
    const body=candidates.reduce((best,c)=>Math.abs((c.left+c.right)/2-cx)<Math.abs((best.left+best.right)/2-cx)?c:best);
    for(let i=0;i<count;i++)if(labels[i]===component.id)labels[i]=body.id;
    body.left=Math.min(body.left,component.left);body.right=Math.max(body.right,component.right);body.top=Math.min(body.top,component.top);body.bottom=Math.max(body.bottom,component.bottom);
  }
  const dist=new Uint8Array(count);let end=0;for(let i=0;i<count;i++)if(labels[i])q[end++]=i;
  for(let j=0;j<end;j++){const p=q[j],x=p%src.width,y=Math.floor(p/src.width);if(dist[p]>=24)continue;for(const k of [x?p-1:-1,x+1<src.width?p+1:-1,y?p-src.width:-1,y+1<src.height?p+src.width:-1])if(k>=0&&!labels[k]){labels[k]=labels[p];dist[k]=dist[p]+1;q[end++]=k;}}
  const fw=560,fh=500,baseline=450,columns=4,rows=2,atlas=new PNG({width:fw*columns,height:fh*rows});
  const frames=bodies.map((c,i)=>{const dx=Math.round(fw/2-(c.left+c.right)/2),dy=baseline-c.bottom;
    for(let y=Math.max(0,c.top-24);y<=Math.min(src.height-1,c.bottom+24);y++)for(let x=Math.max(0,c.left-24);x<=Math.min(src.width-1,c.right+24);x++){
      if(labels[y*src.width+x]!==c.id)continue;const xx=x+dx,yy=y+dy;if(xx<0||xx>=fw||yy<0||yy>=fh)throw Error(`${name} frame ${i+1} clips`);
      src.data.copy(atlas.data,(((Math.floor(i/4)*fh+yy)*atlas.width)+(i%4)*fw+xx)*4,(y*src.width+x)*4,(y*src.width+x)*4+4);
    }return {index:i,sourceBounds:c};});
  await writeFile(resolve(dir,`${name}-v4-atlas.png`),PNG.sync.write(atlas));
  await writeFile(resolve(dir,`${name}-v4-atlas.json`),JSON.stringify({source:`${name}-v4-source.png`,columns,rows,frameCount:8,frameWidth:fw,frameHeight:fh,baseline,loop:false,registration:'same scale; centered opaque silhouette, lowest point on baseline; detached berries retained',note:name==='pick'?'Small incremental motions but berry and paws may drift; review.':'Frame 3 to 4 jumps noticeably from crouch to sitting; not yet a smooth transition.',frames},null,2)+'\n');
}
