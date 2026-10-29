// Slice existing approved artwork; no new poses or generated pixels.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { PNG } = require('pngjs');
const root = 'client/public/images/pet';
const out = `${root}/animations/petting-idle`;
await mkdir(out, { recursive: true });
for (const [name, source, columns, rows] of [['breathing','breathing-source.png',4,2],['blinking','blinking-4-source.png',2,2]]) {
  const png = PNG.sync.read(await readFile(`${root}/motion-studies/petting-idle/${source}`));
  const cells = [];
  for (let row=0;row<rows;row++) for(let col=0;col<columns;col++) {
    const x0=Math.round(col*png.width/columns),x1=Math.round((col+1)*png.width/columns);
    const y0=Math.round(row*png.height/rows),y1=Math.round((row+1)*png.height/rows);
    let left=x1,right=x0,top=y1,bottom=y0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(png.data[(y*png.width+x)*4+3]>80){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    cells.push({left,right,top,bottom});
  }
  const scale=Math.min(471/Math.max(...cells.map(c=>c.right-c.left+1)),469/Math.max(...cells.map(c=>c.bottom-c.top+1)));
  const atlas=new PNG({width:521*columns,height:549*rows});
  cells.forEach((c,i)=>{
    const w=Math.round((c.right-c.left+1)*scale),h=Math.round((c.bottom-c.top+1)*scale);
    const dx=i%columns*521+Math.round((521-w)/2),dy=Math.floor(i/columns)*549+509-h;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const src=((c.top+Math.min(c.bottom-c.top,Math.floor(y/scale)))*png.width+c.left+Math.min(c.right-c.left,Math.floor(x/scale)))*4;
      const dest=((dy+y)*atlas.width+dx+x)*4;
      png.data.copy(atlas.data,dest,src,src+4);
    }
  });
  await writeFile(`${out}/${name}-atlas.png`,PNG.sync.write(atlas));
  await writeFile(`${out}/${name}.json`,JSON.stringify({source:`../../motion-studies/petting-idle/${source}`,columns,rows,frames:columns*rows,frameWidth:521,frameHeight:549,registration:'constant scale per sheet, silhouette centre and foot baseline; no synthesized transitions'},null,2));
}
