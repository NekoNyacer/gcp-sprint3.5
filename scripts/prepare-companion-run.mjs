// Deterministic extraction of generated animation frames; no pose synthesis.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { PNG } = require('pngjs');
const sourcePath = process.argv[2];
if (!sourcePath) throw Error('Usage: node scripts/prepare-companion-run.mjs <generated-4x3-sheet.png>');
const source = PNG.sync.read(await readFile(sourcePath));
const columns = 4, rows = 3;
const cellWidth = Math.floor(source.width / columns), cellHeight = Math.floor(source.height / rows);
// Generated gutters are not exact pixel grids. Extract the 12 complete connected
// silhouettes rather than clipping whiskers at guessed cell boundaries.
const count = source.width * source.height;
const seen = new Uint8Array(count), labels = new Int16Array(count);
const queue = new Int32Array(count), components = [];
for (let i = 0; i < count; i++) {
  if (seen[i] || source.data[i * 4 + 3] < 96) continue;
  let start = 0, end = 1;
  queue[0] = i; seen[i] = 1;
  let left = source.width, right = 0, top = source.height, bottom = 0;
  while (start < end) {
    const pixel = queue[start++], x = pixel % source.width, y = Math.floor(pixel / source.width);
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    for (const adjacent of [pixel - 1, pixel + 1, pixel - source.width, pixel + source.width]) {
      if (adjacent < 0 || adjacent >= count || seen[adjacent] || source.data[adjacent * 4 + 3] < 96) continue;
      seen[adjacent] = 1; queue[end++] = adjacent;
    }
  }
  if (end < 3000) continue;
  const id = components.length + 1;
  for (let j = 0; j < end; j++) labels[queue[j]] = id;
  components.push({ id, left, top, right, bottom, area: end });
}
if (components.length !== 12) throw Error(`Expected 12 separate full animals, found ${components.length}`);
const frames = [];
for (let row = 0; row < rows; row++) {
  const group = components.filter(c => Math.floor((c.top + c.bottom) / 2 / cellHeight) === row).sort((a, b) => a.left - b.left);
  if (group.length !== columns) throw Error(`Row ${row + 1} has ${group.length} poses`);
  frames.push(...group.map(c => ({ ...c, row })));
}
// Grow labels only into the nearby antialiased fur, preserving soft alpha.
let end = 0;
const distance = new Uint8Array(count);
for (let i = 0; i < count; i++) if (labels[i]) queue[end++] = i;
for (let start = 0; start < end; start++) {
  const pixel = queue[start];
  if (distance[pixel] >= 12) continue;
  for (const adjacent of [pixel - 1, pixel + 1, pixel - source.width, pixel + source.width]) {
    if (adjacent < 0 || adjacent >= count || labels[adjacent]) continue;
    labels[adjacent] = labels[pixel]; distance[adjacent] = distance[pixel] + 1; queue[end++] = adjacent;
  }
}
const cropWidth = Math.max(...frames.map(c => c.right - c.left + 1)) + 28;
const cropHeight = Math.max(...frames.map(c => c.bottom - c.top + 1)) + 56;
const output = new PNG({ width: cropWidth * columns, height: cropHeight * rows });
for (let index = 0; index < frames.length; index++) {
  const frame = frames[index];
  const baseline = Math.max(...frames.filter(c => c.row === frame.row).map(c => c.bottom));
  const offsetX = Math.round(cropWidth / 2 - (frame.left + frame.right) / 2);
  const offsetY = cropHeight - 14 - baseline;
  for (let y = Math.max(0, frame.top - 12); y <= Math.min(source.height - 1, frame.bottom + 12); y++) {
    for (let x = Math.max(0, frame.left - 12); x <= Math.min(source.width - 1, frame.right + 12); x++) {
      if (labels[y * source.width + x] !== frame.id) continue;
      const dx = x + offsetX, dy = y + offsetY;
      if (dx < 0 || dx >= cropWidth || dy < 0 || dy >= cropHeight) throw Error(`Pose ${index + 1} would clip`);
      const from = (y * source.width + x) * 4;
      const to = (((Math.floor(index / columns) * cropHeight) + dy) * output.width + (index % columns * cropWidth) + dx) * 4;
      source.data.copy(output.data, to, from, from + 4);
    }
  }
}
const outputPath = resolve('client/public/images/pet/chipmunk-run-cycle.png');
await writeFile(outputPath, PNG.sync.write(output));
await writeFile(resolve('client/public/images/pet/chipmunk-run-cycle.json'), JSON.stringify({
  columns, rows, frameCount: 12, framesPerSecond: 24,
  frameWidth: cropWidth, frameHeight: cropHeight,
  sourcePath, sourceWidth: source.width, sourceHeight: source.height,
  registration: 'shared scale; silhouette-centered X; shared baseline per generated row', frames,
}, null, 2) + '\n');
console.log(JSON.stringify({ outputPath, frameWidth: cropWidth, frameHeight: cropHeight, frames }));
