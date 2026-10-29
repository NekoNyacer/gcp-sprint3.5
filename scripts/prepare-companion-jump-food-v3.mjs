// Extract generated key poses while preserving the original art and alpha.
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const {PNG} = require('pngjs');
const dir = resolve('client/public/images/pet/motion-studies/jump-food-prepared');
const specs = {
  jump: {names:['stand','prepare','crouch','push-off','rising-1','rising-2','tuck-1','tuck-2','apex','extend-down','touch-down','land'], offsets:[0,0,0,-10,-32,-52,-68,-80,-80,-55,-15,0]},
  food: {names:['hold','lift','mouth','bite-1','bite-2','bite-3','chew','pouch-1','pouch-2','cheeks-1','cheeks-2','content'], offsets:Array(12).fill(0)}
};
for(const [name,spec] of Object.entries(specs)){
  const source=PNG.sync.read(await readFile(resolve(dir,`${name}-v3-source.png`)));
  const count=source.width*source.height, seen=new Uint8Array(count), labels=new Int16Array(count), q=new Int32Array(count), comps=[];
  for(let p=0;p<count;p++){
    if(seen[p]||source.data[p*4+3]<96)continue;
    let begin=0,end=1,left=source.width,right=0,top=source.height,bottom=0;
    q[0]=p; seen[p]=1;
    while(begin<end){const pos=q[begin++],x=pos%source.width,y=Math.floor(pos/source.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const k of [x?pos-1:-1,x+1<source.width?pos+1:-1,y?pos-source.width:-1,y+1<source.height?pos+source.width:-1]) if(k>=0&&!seen[k]&&source.data[k*4+3]>=96){seen[k]=1;q[end++]=k;}
    }
    if(end<1000) continue;
    const id=comps.length+1; for(let i=0;i<end;i++) labels[q[i]]=id; comps.push({id,left,right,top,bottom,area:end});
  }
  const bodies=comps.filter(c=>c.area>12000).sort((a,b)=>Math.floor(((a.top+a.bottom)/2)/(source.height/3))-Math.floor(((b.top+b.bottom)/2)/(source.height/3))||a.left-b.left);
  console.log(name,source.width,source.height,JSON.stringify(bodies));
  if(bodies.length!==12)throw new Error(`${name}: expected 12 separate silhouettes, found ${bodies.length}`);
  const distance=new Uint8Array(count); let end=0;for(let i=0;i<count;i++)if(labels[i])q[end++]=i;
  for(let start=0;start<end;start++){const p=q[start],x=p%source.width,y=Math.floor(p/source.width);if(distance[p]>=20)continue;for(const k of [x?p-1:-1,x+1<source.width?p+1:-1,y?p-source.width:-1,y+1<source.height?p+source.width:-1])if(k>=0&&!labels[k]){labels[k]=labels[p];distance[k]=distance[p]+1;q[end++]=k;}}
  const frameWidth=440,frameHeight=400,baseline=360,columns=4,rows=3,atlas=new PNG({width:frameWidth*columns,height:frameHeight*rows});
  const frames=bodies.map((body,index)=>{
    const dx=Math.round(frameWidth/2-(body.left+body.right)/2),dy=baseline-body.bottom;
    for(let y=Math.max(0,body.top-20);y<=Math.min(source.height-1,body.bottom+20);y++)for(let x=Math.max(0,body.left-20);x<=Math.min(source.width-1,body.right+20);x++){
      if(labels[y*source.width+x]!==body.id)continue;
      const fx=x+dx,fy=y+dy;
      if(fx<0||fx>=frameWidth||fy<0||fy>=frameHeight)throw new Error(`${name} frame ${index+1} clips`);
      source.data.copy(atlas.data,(((Math.floor(index/columns)*frameHeight+fy)*atlas.width)+(index%columns)*frameWidth+fx)*4,(y*source.width+x)*4,(y*source.width+x)*4+4);
    }
    return {index,pose:spec.names[index],sourceBounds:body,previewOffsetY:spec.offsets[index]};
  });
  await writeFile(resolve(dir,`${name}-v3-atlas.png`),PNG.sync.write(atlas));
  await writeFile(resolve(dir,`${name}-v3-atlas.json`),JSON.stringify({source:`${name}-v3-source.png`,columns,rows,frameCount:12,frameWidth,frameHeight,baseline,loop:false,registration:'fixed scale; opaque silhouette centered, common lowest-point baseline; jump arc offsets are suggestions and not baked in',note:'Generated key poses require visual review; alignment is not anatomical interpolation.',frames},null,2)+'\n');
}
