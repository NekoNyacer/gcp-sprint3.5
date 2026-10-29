// Extract the two generated jump studies without overwriting their source.
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const require = createRequire(new URL('../client/package.json', import.meta.url));
const {PNG} = require('pngjs');
const directory = resolve('client/public/images/pet/motion-studies/jump-segments');
const poses = {
  launch: ['crouch', 'prepare', 'front-paws-lift', 'push', 'rise-1', 'rise-2', 'rise-3', 'extended'],
  landing: ['descending', 'approach', 'front-contact', 'compress', 'hind-recovery', 'hind-contact', 'crouch', 'rest'],
};

for (const [name, names] of Object.entries(poses)) {
  const source = PNG.sync.read(await readFile(resolve(directory, `${name}-source.png`)));
  const size = source.width * source.height;
  const seen = new Uint8Array(size), labels = new Int16Array(size), queue = new Int32Array(size);
  const components = [];
  for (let p = 0; p < size; p++) {
    if (seen[p] || source.data[p * 4 + 3] < 96) continue;
    let start = 0, end = 1, left = source.width, right = 0, top = source.height, bottom = 0;
    queue[0] = p; seen[p] = 1;
    while (start < end) {
      const pos = queue[start++], x = pos % source.width, y = Math.floor(pos / source.width);
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const k of [x ? pos - 1 : -1, x + 1 < source.width ? pos + 1 : -1, y ? pos - source.width : -1, y + 1 < source.height ? pos + source.width : -1]) {
        if (k >= 0 && !seen[k] && source.data[k * 4 + 3] >= 96) { seen[k] = 1; queue[end++] = k; }
      }
    }
    if (end < 1000) continue;
    const id = components.length + 1;
    for (let i = 0; i < end; i++) labels[queue[i]] = id;
    components.push({id, left, right, top, bottom, area: end});
  }
  const bodies = components.filter(c => c.area > 12000).sort((a, b) =>
    Math.floor((a.top + a.bottom) / source.height) - Math.floor((b.top + b.bottom) / source.height) || a.left - b.left);
  if (bodies.length !== 8) throw new Error(`${name}: expected 8 silhouettes, found ${bodies.length}`);
  const distance = new Uint8Array(size); let end = 0;
  for (let i = 0; i < size; i++) if (labels[i]) queue[end++] = i;
  for (let start = 0; start < end; start++) {
    const p = queue[start], x = p % source.width, y = Math.floor(p / source.width);
    if (distance[p] >= 16) continue;
    for (const k of [x ? p - 1 : -1, x + 1 < source.width ? p + 1 : -1, y ? p - source.width : -1, y + 1 < source.height ? p + source.width : -1]) {
      if (k >= 0 && !labels[k]) { labels[k] = labels[p]; distance[k] = distance[p] + 1; queue[end++] = k; }
    }
  }
  const columns = 4, rows = 2, frameWidth = 500, frameHeight = 480, baseline = 430;
  const atlas = new PNG({width: frameWidth * columns, height: frameHeight * rows});
  const frames = bodies.map((body, index) => {
    const dx = Math.round(frameWidth / 2 - (body.left + body.right) / 2), dy = baseline - body.bottom;
    for (let y = Math.max(0, body.top - 16); y <= Math.min(source.height - 1, body.bottom + 16); y++) {
      for (let x = Math.max(0, body.left - 16); x <= Math.min(source.width - 1, body.right + 16); x++) {
        if (labels[y * source.width + x] !== body.id) continue;
        const fx = x + dx, fy = y + dy;
        if (fx < 0 || fx >= frameWidth || fy < 0 || fy >= frameHeight) throw new Error(`${name} frame ${index + 1} clips`);
        source.data.copy(atlas.data, (((Math.floor(index / columns) * frameHeight + fy) * atlas.width) + (index % columns) * frameWidth + fx) * 4, (y * source.width + x) * 4, (y * source.width + x) * 4 + 4);
      }
    }
    return {index, pose: names[index], sourceBounds: body};
  });
  await writeFile(resolve(directory, `${name}-atlas.png`), PNG.sync.write(atlas));
  const manifest = {source: `${name}-source.png`, atlas: `${name}-atlas.png`, columns, rows, frameCount: 8, frameWidth, frameHeight, baseline, framesPerSecond: 8, loop: false, registration: 'fixed scale, silhouette centered and lowest point aligned; no jump trajectory is baked in', caveat: 'Generated poses require motion review; whiskers may be clipped and proportion drift remains.', frames};
  await writeFile(resolve(directory, `${name}.json`), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${name}: 8 frames registered`);
}
