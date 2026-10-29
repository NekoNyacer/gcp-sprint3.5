// Produce review-only atlases without modifying source art or app code.
// Run from the repository root: node client/public/images/pet/motion-studies/petting-unified/prepare-review.mjs
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
const require = createRequire(resolve('client/package.json'));
const {PNG} = require('pngjs');
const dir = resolve('client/public/images/pet/motion-studies/petting-unified');
const ref = PNG.sync.read(await readFile(join(dir, 'head-anchor-reference.png')));
const width = 521, height = 549, baseline = 508, anchor = [359, 195];
if (ref.width !== width || ref.height !== height) throw Error('Unexpected reference dimensions');
const pixel = (image, x, y, c) => image.data[(y * image.width + x) * 4 + c];

function bounds(frame) {
  let left=frame.width, top=frame.height, right=-1, bottom=-1;
  for (let y=0;y<frame.height;y++) for (let x=0;x<frame.width;x++) {
    if (pixel(frame,x,y,3)<96) continue;
    left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y);
  }
  if (right<0) throw Error('Empty source cell');
  return {left,top,right,bottom};
}
function isolateAnimals(source) {
  const count=source.width*source.height, seen=new Uint8Array(count), labels=new Int16Array(count);
  const queue=new Int32Array(count), components=[];
  const neighbors=p=>{const x=p%source.width,y=Math.floor(p/source.width);return [x?p-1:-1,x+1<source.width?p+1:-1,y?p-source.width:-1,y+1<source.height?p+source.width:-1];};
  for(let p=0;p<count;p++){
    if(seen[p]||source.data[p*4+3]<96)continue;
    let start=0,end=1,left=source.width,right=0,top=source.height,bottom=0;
    queue[0]=p;seen[p]=1;
    while(start<end){const q=queue[start++],x=q%source.width,y=Math.floor(q/source.width);
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const n of neighbors(q))if(n>=0&&!seen[n]&&source.data[n*4+3]>=96){seen[n]=1;queue[end++]=n;}
    }
    if(end<5000)continue;
    const id=components.length+1;
    for(let i=0;i<end;i++)labels[queue[i]]=id;
    components.push({id,left,right,top,bottom,area:end});
  }
  if(components.length!==8)throw Error(`Expected 8 separate silhouettes; found ${components.length}`);
  const distance=new Uint8Array(count);let end=0;
  for(let p=0;p<count;p++)if(labels[p])queue[end++]=p;
  for(let i=0;i<end;i++){const p=queue[i];if(distance[p]>=40)continue;
    for(const n of neighbors(p))if(n>=0&&!labels[n]){labels[n]=labels[p];distance[n]=distance[p]+1;queue[end++]=n;}
  }
  components.sort((a,b)=>Math.floor((a.top+a.bottom)/source.height)-Math.floor((b.top+b.bottom)/source.height)||a.left-b.left);
  return {components,labels};
}
function readCell(source, n, labels, component) {
  // Include area beyond nominal grid lines; nearest-component labels protect
  // fine fur and whiskers without including a neighbour.
  const x0=Math.max(0,Math.min(Math.round((n%4)*source.width/4),component.left-42));
  const x1=Math.min(source.width,Math.max(Math.round((n%4+1)*source.width/4),component.right+43));
  const y0=Math.max(0,Math.min(Math.round(Math.floor(n/4)*source.height/2),component.top-42));
  const y1=Math.min(source.height,Math.max(Math.round((Math.floor(n/4)+1)*source.height/2),component.bottom+43));
  const cell=new PNG({width:x1-x0,height:y1-y0});
  for(let y=0;y<cell.height;y++) for(let x=0;x<cell.width;x++) {
    const src=((y+y0)*source.width+x+x0)*4, dst=(y*cell.width+x)*4;
    if(labels[(y+y0)*source.width+x+x0]===component.id)source.data.copy(cell.data,dst,src,src+4);
  }
  return cell;
}
// Locate the small nose patch, not the changing tail edge; keep the planted
// paws aligned vertically. This is an approximate colour template, not a rig.
function noseX(cell, scale, box) {
  let best=Infinity, bestX=Math.round(cell.width*.72), bestY=0;
  const estimateY=box.bottom-(baseline-anchor[1])/scale;
  const xmin=Math.floor(cell.width*.60), xmax=Math.ceil(cell.width*.83);
  for(let y=Math.max(6,Math.floor(estimateY-35));y<Math.min(cell.height-6,Math.ceil(estimateY+35));y++) {
    for(let x=xmin;x<xmax;x++) {
      let cost=0;
      for (const dy of [-5,-2,1,4]) for (const dx of [-5,-2,1,4]) {
        const sx=Math.round(x+dx/scale), sy=Math.round(y+dy/scale);
        if(sx<0||sy<0||sx>=cell.width||sy>=cell.height||pixel(cell,sx,sy,3)<96){cost+=100000;continue;}
        for(let c=0;c<3;c++){const d=pixel(cell,sx,sy,c)-pixel(ref,anchor[0]+dx,anchor[1]+dy,c);cost+=d*d;}
      }
      // Soft prior prevents an unrelated dark stripe from becoming the nose.
      cost+=((x/cell.width-.72)*100)**2*35+((y-estimateY)*8)**2;
      if(cost<best){best=cost;bestX=x;bestY=y;}
    }
  }
  return {x:bestX,y:bestY,score:Math.round(best)};
}
// Bilinear resampling in premultiplied-alpha space avoids dark fringes.
function transformed(cell, scale, dx, dy) {
  const out=new PNG({width,height});
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sx=(x-dx)/scale, sy=(y-dy)/scale;
    if(sx<0||sy<0||sx>=cell.width-1||sy>=cell.height-1)continue;
    const ix=Math.floor(sx),iy=Math.floor(sy),u=sx-ix,v=sy-iy;
    const neighbours=[[ix,iy,(1-u)*(1-v)],[ix+1,iy,u*(1-v)],[ix,iy+1,(1-u)*v],[ix+1,iy+1,u*v]];
    let a=0,r=0,g=0,b=0;
    for(const [px,py,w] of neighbours){const q=(py*cell.width+px)*4, alpha=cell.data[q+3]/255; a+=w*alpha;r+=w*alpha*cell.data[q];g+=w*alpha*cell.data[q+1];b+=w*alpha*cell.data[q+2];}
    const q=(y*width+x)*4;
    if(a){out.data[q]=Math.round(r/a);out.data[q+1]=Math.round(g/a);out.data[q+2]=Math.round(b/a);out.data[q+3]=Math.round(a*255);}
  }
  return out;
}
function hasEdge(frame) {
  for(let x=0;x<width;x++)if(pixel(frame,x,0,3)>=96||pixel(frame,x,height-1,3)>=96)return true;
  for(let y=0;y<height;y++)if(pixel(frame,0,y,3)>=96||pixel(frame,width-1,y,3)>=96)return true;
  return false;
}
async function prepare(name) {
  const path=join(dir,`${name}-unified-source.png`);
  // The expression study predates the unified naming convention.
  const file=name==='expression-master'?join(dir,'expression-master-source.png'):path;
  const source=PNG.sync.read(await readFile(file));
  const isolated=isolateAnimals(source);
  const cells=Array.from({length:8},(_,i)=>readCell(source,i,isolated.labels,isolated.components[i]));
  const boxes=cells.map(bounds);
  const heights=boxes.map(b=>b.bottom-b.top+1).sort((a,b)=>a-b);
  const scale=466/((heights[3]+heights[4])/2);
  const images=cells.map((cell,i)=>{
    const nose=noseX(cell,scale,boxes[i]);
    // Two pixels of extra right-edge room preserves the head sheet's fine whiskers.
    const dx=anchor[0]-nose.x*scale-(name==='head'?2:0), dy=baseline-boxes[i].bottom*scale;
    const image=transformed(cell,scale,dx,dy);
    return {image,sourceFrame:i+1,nose,dx,dy,sourceBounds:boxes[i],edgeContact:hasEdge(image)};
  });
  return {file,scale,images};
}
// The previous runtime reference has an already truncated right cheek/whisker.
// Use the first head study's isolated neutral as shared endpoints instead of
// propagating the pre-existing defect to every new sequence.
const head=await prepare('head');
const commonNeutral=head.images[0].image;
if(hasEdge(commonNeutral))throw Error('Common neutral touches output edge');
await writeFile(join(dir,'idle-common-neutral.png'),PNG.sync.write(commonNeutral));
for(const name of ['belly','head','expression-master','idle']){
  const {file,scale,images}=name==='head'?head:await prepare(name);
  const atlas=new PNG({width:width*5,height:height*2});
  const output=[commonNeutral,...images,commonNeutral];
  const frames=[];
  for(let i=0;i<output.length;i++){
    const item=output[i], image=item.image??item;
    if(hasEdge(image)) throw Error(`${name} frame ${i+1} has nontransparent pixels at an output edge`);
    for(let y=0;y<height;y++){
      const target=(((Math.floor(i/5)*height+y)*atlas.width)+(i%5)*width)*4;
      image.data.copy(atlas.data,target,y*width*4,(y+1)*width*4);
    }
    frames.push(item.image ? {frame:i+1,sourceFrame:item.sourceFrame,nose:item.nose,translation:[+item.dx.toFixed(2),+item.dy.toFixed(2)],sourceBounds:item.sourceBounds} :
      {frame:i+1,source:'idle-common-neutral.png (exact shared neutral)'});
  }
  const meta={source:name==='expression-master'?'expression-master-source.png':`${name}-unified-source.png`,reference:'idle-common-neutral.png (derived from head-unified-source frame 1); old runtime reference used for approximate coordinate template only',
    atlas:`${name}-review-atlas.png`,columns:5,rows:2,frameCount:10,frameWidth:width,frameHeight:height,
    scale:+scale.toFixed(6),baseline,anchor:name==='head'?[anchor[0]-2,anchor[1]]:anchor,
    framesPerSecond: name==='idle'?6:8, loop:name==='idle',frames,
    limitations:'The previous runtime idle first frame has a pre-existing cropped right side. These studies share a new complete neutral instead, which differs from the current app idle. Approximate nose template and lowest-paw alignment; same scale for all source frames, no per-frame resizing. Source poses may still shift or change proportions. Connections to the existing idle and transitions between frames require visual review; not animation-quality certification.'};
  await writeFile(join(dir,meta.atlas),PNG.sync.write(atlas));
  await writeFile(join(dir,`${name}-review.json`),JSON.stringify(meta,null,2)+'\n');
  console.log(name, 'scale', scale.toFixed(4), 'anchors',frames.filter(f=>f.nose).map(f=>[f.nose.x,f.nose.y]));
}
