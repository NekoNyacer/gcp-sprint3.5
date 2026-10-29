// Package generated poses non-destructively; this does not invent in-between art.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { PNG } = require('pngjs');
const directory = resolve('client/public/images/pet/motion-studies');
const outputDir = resolve(directory, 'jump-food-prepared');
await mkdir(outputDir, { recursive: true });
const specs = {
  jump: {
    names: ['stand', 'crouch', 'push-off', 'ascending', 'tucked-apex', 'descending', 'forepaw-contact', 'landing'],
    previewOffsetY: [0, 0, -22, -55, -70, -42, -8, 0],
    note: 'Eight key poses, not a complete smooth jump. In particular ascending to apex changes pose abruptly. Preview offsets describe a possible jump arc and are not baked into the atlas.'
  },
  food: {
    names: ['notice-berry', 'sniff', 'reach', 'hold', 'nibble', 'pouch', 'cheek-full', 'content'],
    previewOffsetY: [0, 0, 0, 0, 0, 0, 0, 0],
    note: 'Eight key poses, not a complete smooth eating animation. Transition from reaching on all fours to holding upright requires in-between drawings. The first berry is a separate component retained with its pose.'
  }
};
for (const [name, spec] of Object.entries(specs)) {
  const source = PNG.sync.read(await readFile(resolve(directory, name + '.png')));
  const count = source.width * source.height, seen = new Uint8Array(count), labels = new Int16Array(count), queue = new Int32Array(count), components = [];
  for (let i = 0; i < count; i++) {
    if (seen[i] || source.data[i * 4 + 3] < 96) continue;
    let start = 0, end = 1, left = source.width, right = 0, top = source.height, bottom = 0;
    queue[0] = i; seen[i] = 1;
    while (start < end) {
      const p = queue[start++], x = p % source.width, y = Math.floor(p / source.width);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const q of [x > 0 ? p - 1 : -1, x < source.width - 1 ? p + 1 : -1, y > 0 ? p - source.width : -1, y < source.height - 1 ? p + source.width : -1]) {
        if (q >= 0 && !seen[q] && source.data[q * 4 + 3] >= 96) { seen[q] = 1; queue[end++] = q; }
      }
    }
    if (end < 1000) continue;
    const id = components.length + 1;
    for (let j = 0; j < end; j++) labels[queue[j]] = id;
    components.push({id, left, right, top, bottom, area:end});
  }
  const bodies = components.filter(c => c.area > 20000).sort((a,b) => a.top < source.height / 2 && b.top >= source.height / 2 ? -1 : a.top >= source.height / 2 && b.top < source.height / 2 ? 1 : a.left - b.left);
  if (bodies.length !== 8) throw new Error(`${name}: expected eight distinct animal silhouettes, found ${bodies.length}`);
  if (name === 'food') {
    const berry = components.find(c => c.area < 20000 && c.left > 390 && c.left < 430 && c.top > 350 && c.top < 410);
    if (!berry) throw new Error('Expected detached berry in food frame 1');
    for (let i = 0; i < count; i++) if (labels[i] === berry.id) labels[i] = bodies[0].id;
    bodies[0].extra = {left:berry.left, right:berry.right, top:berry.top, bottom:berry.bottom};
  }
  // Grow each opaque component into neighboring alpha to keep fine fur edges.
  const distance = new Uint8Array(count); let end = 0;
  for (let i = 0; i < count; i++) if (labels[i]) queue[end++] = i;
  for (let start = 0; start < end; start++) {
    const p = queue[start], x = p % source.width, y = Math.floor(p / source.width);
    if (distance[p] >= 32) continue;
    for (const q of [x > 0 ? p - 1 : -1, x < source.width - 1 ? p + 1 : -1, y > 0 ? p - source.width : -1, y < source.height - 1 ? p + source.width : -1]) {
      if (q >= 0 && !labels[q]) { labels[q] = labels[p]; distance[q] = distance[p] + 1; queue[end++] = q; }
    }
  }
  const frameWidth = 520, frameHeight = 480, baseline = 430, columns = 4, rows = 2;
  const atlas = new PNG({width:frameWidth * columns, height:frameHeight * rows});
  const frames = bodies.map((body, index) => {
    const dx = Math.round(frameWidth / 2 - (body.left + body.right) / 2);
    const dy = baseline - body.bottom;
    const box = {left:Math.min(body.left, body.extra?.left ?? body.left), right:Math.max(body.right, body.extra?.right ?? body.right), top:Math.min(body.top, body.extra?.top ?? body.top), bottom:Math.max(body.bottom, body.extra?.bottom ?? body.bottom)};
    for (let y = Math.max(0, box.top - 32); y <= Math.min(source.height - 1, box.bottom + 32); y++) for (let x = Math.max(0, box.left - 32); x <= Math.min(source.width - 1, box.right + 32); x++) {
      if (labels[y * source.width + x] !== body.id) continue;
      const fx = x + dx, fy = y + dy;
      if (fx < 0 || fx >= frameWidth || fy < 0 || fy >= frameHeight) throw new Error(`${name} frame ${index + 1} clips`);
      source.data.copy(atlas.data, (((Math.floor(index / columns) * frameHeight + fy) * atlas.width) + (index % columns) * frameWidth + fx) * 4, (y * source.width + x) * 4, (y * source.width + x) * 4 + 4);
    }
    return {index, pose:spec.names[index], sourceBounds:box, previewOffsetY:spec.previewOffsetY[index]};
  });
  await writeFile(resolve(outputDir, name + '-atlas.png'), PNG.sync.write(atlas));
  await writeFile(resolve(outputDir, name + '-atlas.json'), JSON.stringify({source:`../${name}.png`, columns, rows, frameCount:8, frameWidth, frameHeight, baseline, registration:'same scale, silhouette centered horizontally, foot baseline aligned; no in-between frames generated', loop:false, note:spec.note, frames}, null, 2) + '\n');
  console.log(`${name}: ${atlas.width}x${atlas.height}, ${frames.length} frames`);
}
