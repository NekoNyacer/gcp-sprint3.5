// Promote the complete art handoff without rescaling any frame independently.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { PNG } = require('pngjs');
const source = 'client/public/images/pet/motion-studies/petting-unified';
const target = 'client/public/images/pet/animations/petting-unified';
await mkdir(target, { recursive: true });
const neutral = PNG.sync.read(await readFile(`${source}/idle-common-neutral.png`));
for (const name of ['idle', 'head', 'belly', 'expression-master']) {
  const metadata = JSON.parse(await readFile(`${source}/${name}-review.json`, 'utf8'));
  const png = PNG.sync.read(await readFile(`${source}/${metadata.atlas}`));
  if (png.width !== metadata.columns * metadata.frameWidth || png.height !== metadata.rows * metadata.frameHeight) throw Error(`${name}: geometry mismatch`);
  for (const frame of [0, metadata.frameCount - 1]) {
    for (let y = 0; y < neutral.height; y++) for (let x = 0; x < neutral.width; x++) {
      const a = ((Math.floor(frame / metadata.columns) * metadata.frameHeight + y) * png.width + frame % metadata.columns * metadata.frameWidth + x) * 4;
      const b = (y * neutral.width + x) * 4;
      if (!png.data.subarray(a, a + 4).equals(neutral.data.subarray(b, b + 4))) throw Error(`${name}: neutral endpoint mismatch`);
    }
  }
  await copyFile(`${source}/${metadata.atlas}`, `${target}/${name}-atlas.png`);
  await writeFile(`${target}/${name}.json`, JSON.stringify({ ...metadata, atlas: `${name}-atlas.png`, source: `../../motion-studies/petting-unified/${metadata.source}`, sourceManifest: `../../motion-studies/petting-unified/${name}-review.json`, endpointVerification: 'first and last RGBA pixels equal the shared neutral; interior poses still contain source-art variation' }, null, 2));
}
await copyFile(`${source}/idle-common-neutral.png`, `${target}/neutral.png`);
console.log('Verified and copied all four unified clips and the common neutral.');
