// Extract the eight existing silhouettes without synthesizing any in-between frames.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { PNG } = require('pngjs');
const root = 'client/public/images/pet/motion-studies';
const outDir = join(root, 'registered-closeups');
await mkdir(outDir, { recursive: true });
for (const name of ['idle', 'head-rub', 'belly-rub', 'groom']) {
  const sourcePath = join(root, `${name}.png`);
  const image = PNG.sync.read(await readFile(sourcePath));
  const { width, height, data } = image;
  const count = width * height, seen = new Uint8Array(count), labels = new Int16Array(count), queue = new Int32Array(count), components = [];
  const neighbours = p => { const x = p % width, y = Math.floor(p / width); return [x > 0 ? p-1 : -1, x < width-1 ? p+1 : -1, y > 0 ? p-width : -1, y < height-1 ? p+width : -1]; };
  for (let p = 0; p < count; p++) {
    if (seen[p] || data[p * 4 + 3] < 96) continue;
    let read = 0, len = 1, left = width, right = 0, top = height, bottom = 0;
    queue[0] = p; seen[p] = 1;
    while (read < len) {
      const q = queue[read++], x = q % width, y = Math.floor(q / width);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const next of neighbours(q)) {
        if (next < 0 || seen[next] || data[next*4+3] < 96) continue;
        seen[next] = 1; queue[len++] = next;
      }
    }
    if (len < 1500) continue;
    const id = components.length + 1;
    for (let i = 0; i < len; i++) labels[queue[i]] = id;
    components.push({ id, left, right, top, bottom, area: len });
  }
  if (components.length !== 8) throw Error(`${name}: expected 8 animals, found ${components.length}`);
  const sorted = [0, 1].flatMap(row => components.filter(c => Math.floor((c.top + c.bottom) / height) === row).sort((a,b) => a.left-b.left));
  if (sorted.length !== 8) throw Error(`${name}: unexpected source layout`);
  // Expand labels into nearby antialiased fur and whiskers. Areas close to two
  // animals are attributed to the nearest connected silhouette, never doubled.
  const distance = new Uint8Array(count);
  let len = 0;
  for (let p = 0; p < count; p++) if (labels[p]) queue[len++] = p;
  for (let read = 0; read < len; read++) {
    const p = queue[read]; if (distance[p] >= 40) continue;
    for (const next of neighbours(p)) {
      if (next < 0 || labels[next]) continue;
      labels[next] = labels[p]; distance[next] = distance[p] + 1; queue[len++] = next;
    }
  }
  const frameWidth = Math.max(...sorted.map(c => c.right - c.left + 1)) + 92;
  const frameHeight = Math.max(...sorted.map(c => c.bottom - c.top + 1)) + 92;
  const sheet = new PNG({ width: frameWidth * 4, height: frameHeight * 2 });
  const framePaths = [];
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i], frame = new PNG({ width: frameWidth, height: frameHeight });
    const offsetX = Math.round(frameWidth / 2 - (c.left + c.right) / 2), offsetY = frameHeight - 46 - c.bottom;
    for (let y = Math.max(0,c.top-40); y <= Math.min(height-1,c.bottom+40); y++) for (let x = Math.max(0,c.left-40); x <= Math.min(width-1,c.right+40); x++) {
      if (labels[y * width + x] !== c.id) continue;
      const dx = x + offsetX, dy = y + offsetY;
      if (dx < 0 || dy < 0 || dx >= frameWidth || dy >= frameHeight) throw Error(`${name} frame ${i+1} clips`);
      const from = (y * width + x) * 4, to = (dy * frameWidth + dx) * 4;
      data.copy(frame.data, to, from, from+4);
      const sheetTo = (((Math.floor(i/4)*frameHeight)+dy)*sheet.width + (i%4)*frameWidth + dx)*4;
      data.copy(sheet.data, sheetTo, from, from+4);
    }
    const framePath = `${name}-${String(i+1).padStart(2,'0')}.png`;
    await writeFile(join(outDir, framePath), PNG.sync.write(frame));
    framePaths.push(framePath);
  }
  await writeFile(join(outDir, `${name}-atlas.png`), PNG.sync.write(sheet));
  const manifest = { source: `../${name}.png`, atlas: `${name}-atlas.png`, columns: 4, rows: 2, frameCount: 8, frameWidth, frameHeight,
    registration: 'constant scale; each silhouette horizontally centered; lowest opaque point aligned to shared baseline', frames: framePaths,
    caveat: 'Pose studies, not a continuous animation cycle; review transition timing and add in-betweens. Registration does not track anatomical landmarks.' };
  await writeFile(join(outDir, `${name}.json`), JSON.stringify(manifest, null, 2)+'\n');
  console.log(JSON.stringify({ name, frameWidth, frameHeight, bounds: sorted }));
}

