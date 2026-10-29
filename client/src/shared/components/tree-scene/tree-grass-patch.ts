/** Painted grass blades baked once into a small alpha texture, rather than wirelike geometry. */
const SIZE = 256;
let seed = 31947;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const blades = Array.from({ length: 150 }, () => ({
  x: 14 + random() * 228,
  y: 256 + random() * 9,
  height: 65 + random() * 170,
  lean: (random() - 0.5) * 64,
  width: 1.6 + random() * 3.2,
  tint: random(),
})).sort((a, b) => b.height - a.height);

function bladePoint(blade: (typeof blades)[number], t: number) {
  return {
    x: blade.x + blade.lean * t * t,
    y: blade.y - blade.height * t,
    width: blade.width * (1 - t) ** 0.7,
  };
}

export function grassPatchPixels(): Uint8Array {
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  for (const blade of blades) {
    for (let step = 0; step <= blade.height * 2; step++) {
      const t = step / (blade.height * 2);
      const p = bladePoint(blade, t);
      const y = Math.floor(p.y);
      if (y < 0 || y >= SIZE) continue;
      for (let x = Math.floor(p.x - p.width - 1); x <= Math.ceil(p.x + p.width + 1); x++) {
        if (x < 0 || x >= SIZE) continue;
        const coverage = Math.max(0, Math.min(1, p.width + 0.7 - Math.abs(x - p.x)));
        if (coverage < 0.1) continue;
        const light = Math.min(1, t * 0.85 + blade.tint * 0.18);
        const ridge = x > p.x ? 0 : 9;
        const noise = Math.sin(x * 7 + y * 11) * 3;
        const index = (y * SIZE + x) * 4;
        pixels[index] = 31 + light * 108 + ridge + noise;
        pixels[index + 1] = 78 + light * 108 + ridge + noise;
        pixels[index + 2] = 35 + light * 49 + noise;
        pixels[index + 3] = Math.max(pixels[index + 3], Math.round(coverage * 255));
      }
    }
  }
  return pixels;
}

/** Used to generate the matching, cached SVG asset for the explicit 2D renderer. */
export function grassPatchSvg(): string {
  const paths = blades
    .map((blade) => {
      const points = Array.from({ length: 13 }, (_, i) => bladePoint(blade, i / 12));
      const outline = [
        ...points.map((p) => `${(p.x - p.width).toFixed(1)},${p.y.toFixed(1)}`),
        ...[...points].reverse().map((p) => `${(p.x + p.width).toFixed(1)},${p.y.toFixed(1)}`),
      ].join(' ');
      return `<polygon points="${outline}" fill="url(#grass)" opacity="${(0.85 + blade.tint * 0.15).toFixed(2)}"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><linearGradient id="grass" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#244f29"/><stop offset=".55" stop-color="#518f3d"/><stop offset="1" stop-color="#a4c56a"/></linearGradient></defs>${paths}</svg>`;
}
