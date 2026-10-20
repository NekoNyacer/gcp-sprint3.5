import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const outputPath = resolve('public/runtime-config.js');
const mapboxAccessToken = process.env.MAPBOX_PUBLIC_TOKEN?.trim() ?? '';

const contents = `window.__CAT_WALK_RUNTIME_CONFIG__ = ${JSON.stringify(
  { mapboxAccessToken },
  null,
  2,
)};\n`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, contents, 'utf8');
