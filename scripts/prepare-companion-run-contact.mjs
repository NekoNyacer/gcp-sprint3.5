// Prepare a review atlas from authored run poses and new contact/recovery poses.
// This does not invent in-betweens or alter the running asset used by the app.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { PNG } = require('pngjs');
const dir = 'client/public/images/pet/motion-studies';
const sheet = PNG.sync.read(await readFile(`${dir}/run-contact-transitions.png`));
const old = PNG.sync.read(await readFile(`${dir}/run-v2-aligned.png`));
const w = sheet.width, h = sheet.height, count = w*h;
const seen = new Uint8Array(count), labels = new Int16Array(count), queue = new Int32Array(count), components = [];
for (let i = 0; i < count; i++) {
  if (seen[i] || sheet.data[i*4+3] < 96) continue;
  let first = 0, last = 1, left=w, right=0, top=h, bottom=0;
  queue[0]=i; seen[i]=1;
  while (first < last) {
    const p=queue[first++], x=p%w, y=Math.floor(p/w);
    left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y);
    for (const n of [p-1,p+1,p-w,p+w]) {
      if(n<0||n>=count||seen[n]||sheet.data[n*4+3]<96) continue;
      seen[n]=1; queue[last++]=n;
    }
  }
  if(last<3000) continue;
  const id=components.length+1;
  for(let j=0;j<last;j++) labels[queue[j]]=id;
  components.push({id,left,right,top,bottom,area:last});
}
if (components.length !== 4) throw Error(`Expected 4 isolated animals, got ${components.length}`);
components.sort((a,b)=>a.left-b.left);
let end=0; const distance=new Uint8Array(count);
for(let i=0;i<count;i++) if(labels[i]) queue[end++]=i;
for(let start=0;start<end;start++){
  const p=queue[start]; if(distance[p]>=12) continue;
  for(const n of [p-1,p+1,p-w,p+w]) if(n>=0&&n<count&&!labels[n]) {labels[n]=labels[p];distance[n]=distance[p]+1;queue[end++]=n;}
}
const fw=460,fh=352,cols=5;
function resize(src,nw,nh) {
  const dst=new PNG({width:nw,height:nh});
  for(let y=0;y<nh;y++) for(let x=0;x<nw;x++) {
    const sx=Math.max(0,Math.min(src.width-1,(x+.5)*src.width/nw-.5)), sy=Math.max(0,Math.min(src.height-1,(y+.5)*src.height/nh-.5));
    const x0=Math.floor(sx), y0=Math.floor(sy), x1=Math.min(src.width-1,x0+1), y1=Math.min(src.height-1,y0+1), fx=sx-x0, fy=sy-y0;
    const neighbors=[[x0,y0,(1-fx)*(1-fy)],[x1,y0,fx*(1-fy)],[x0,y1,(1-fx)*fy],[x1,y1,fx*fy]];
    let a=0,r=0,g=0,b=0;
    for(const [xx,yy,weight] of neighbors) {const i=(yy*src.width+xx)*4, alpha=src.data[i+3]/255*weight; a+=alpha;r+=src.data[i]*alpha;g+=src.data[i+1]*alpha;b+=src.data[i+2]*alpha;}
    const d=(y*nw+x)*4; dst.data[d]=a?r/a:0;dst.data[d+1]=a?g/a:0;dst.data[d+2]=a?b/a:0;dst.data[d+3]=a*255;
  }
  return dst;
}
const frameSpec=[['old',0],['old',1],['old',2],['old',3],['old',4],['new',1],['new',2],['new',3],['old',6],['old',7]];
const output = new PNG({width:fw*cols,height:fh*2});
for(let index=0;index<frameSpec.length;index++){
  const [kind,id]=frameSpec[index]; let frame;
  if(kind==='old'){
    frame=new PNG({width:fw,height:fh});
    for(let y=0;y<fh;y++) for(let x=0;x<fw;x++){
      const src=(((Math.floor(id/4)*fh)+y)*old.width+(id%4*fw+x))*4;
      old.data.copy(frame.data,(y*fw+x)*4,src,src+4);
    }
  } else {
    const c=components[id], l=Math.max(0,c.left-12), t=Math.max(0,c.top-12), r=Math.min(w-1,c.right+12), b=Math.min(h-1,c.bottom+12);
    const crop=new PNG({width:r-l+1,height:b-t+1});
    for(let y=t;y<=b;y++) for(let x=l;x<=r;x++){
      if(labels[y*w+x]!==c.id) continue;
      const src=(y*w+x)*4; sheet.data.copy(crop.data,((y-t)*crop.width+x-l)*4,src,src+4);
    }
    const scale=0.76, nw=Math.round(crop.width*scale),nh=Math.round(crop.height*scale);
    const resized=resize(crop,nw,nh);
    frame=new PNG({width:fw,height:fh});
    const px=fw-15-nw, py=fh-15-nh;
    if(px<0||py<0) throw Error('Resized pose exceeds cell');
    for(let y=0;y<nh;y++) for(let x=0;x<nw;x++) resized.data.copy(frame.data,((y+py)*fw+x+px)*4,(y*nw+x)*4,(y*nw+x)*4+4);
  }
  for(let y=0;y<fh;y++) for(let x=0;x<fw;x++){
    const dst=(((Math.floor(index/cols)*fh)+y)*output.width+(index%cols*fw+x))*4;
    frame.data.copy(output.data,dst,(y*fw+x)*4,(y*fw+x)*4+4);
  }
}
await writeFile(`${dir}/run-contact-review.png`,PNG.sync.write(output));
await writeFile(`${dir}/run-contact-review.json`,JSON.stringify({columns:cols,rows:2,frameCount:frameSpec.length,frameWidth:fw,frameHeight:fh,framesPerSecond:12,sourceImages:['run-v2-aligned.png','run-contact-transitions.png'],sequence:frameSpec,notes:'Experimental review only. New recovery poses bridge the main change but registration and movement require human animation review.'},null,2));
console.log(JSON.stringify({components,frameSpec}));
