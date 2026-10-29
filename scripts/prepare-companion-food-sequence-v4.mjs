// Compose a review sequence from aligned generated key poses; no new anatomical in-betweens are synthesized.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(new URL('../client/package.json',import.meta.url));
const {PNG}=require('pngjs');
const dir=resolve('client/public/images/pet/motion-studies/jump-food-prepared');
const inputs={pick:PNG.sync.read(await readFile(resolve(dir,'pick-v4-atlas.png'))),rise:PNG.sync.read(await readFile(resolve(dir,'rise-v4-atlas.png'))),eat:PNG.sync.read(await readFile(resolve(dir,'food-v3-atlas.png')))};
const sequence=[...Array.from({length:5},(_,i)=>['pick',i]),...Array.from({length:3},(_,i)=>['rise',i+1]),...Array.from({length:12},(_,i)=>['eat',i])];
const fw=440,fh=400,cols=4,rows=5,atlas=new PNG({width:fw*cols,height:fh*rows});
for(let k=0;k<sequence.length;k++){
  const [name,i]=sequence[k],src=inputs[name],sw=name==='eat'?440:560,sh=name==='eat'?400:500,scale=name==='eat'?1:0.8;
  const sx0=(i%4)*sw,sy0=Math.floor(i/4)*sh;
  const ox=Math.round((fw-sw*scale)/2),oy=0;
  for(let y=0;y<fh;y++)for(let x=0;x<fw;x++){
    const sx=(x-ox+0.5)/scale-0.5,sy=(y-oy+0.5)/scale-0.5;
    if(sx<0||sy<0||sx>=sw-1||sy>=sh-1)continue;
    const x0=Math.floor(sx),y0=Math.floor(sy),dx=sx-x0,dy=sy-y0;
    let alpha=0,red=0,green=0,blue=0;
    for(const [tx,ty,w] of [[0,0,(1-dx)*(1-dy)],[1,0,dx*(1-dy)],[0,1,(1-dx)*dy],[1,1,dx*dy]]){
      const p=(((sy0+y0+ty)*src.width)+(sx0+x0+tx))*4,a=src.data[p+3]/255;
      alpha+=w*a;red+=w*a*src.data[p];green+=w*a*src.data[p+1];blue+=w*a*src.data[p+2];
    }
    if(alpha<=0)continue;const d=(((Math.floor(k/cols)*fh+y)*atlas.width)+(k%cols)*fw+x)*4;
    atlas.data[d]=Math.round(red/alpha);atlas.data[d+1]=Math.round(green/alpha);atlas.data[d+2]=Math.round(blue/alpha);atlas.data[d+3]=Math.round(alpha*255);
  }
}
await writeFile(resolve(dir,'food-sequence-v4-atlas.png'),PNG.sync.write(atlas));
await writeFile(resolve(dir,'food-sequence-v4-atlas.json'),JSON.stringify({columns:cols,rows,frameCount:sequence.length,frameWidth:fw,frameHeight:fh,baseline:360,loop:false,frames:sequence.map(([source,index],i)=>({index:i,source,sourceFrame:index+1})),note:'Review sequence assembled from generated sheets. Crouch-to-sit still jumps, and transitions between differently generated sheets can drift in scale, character details and berry location. No loop; final pose has full cheeks.'},null,2)+'\n');
