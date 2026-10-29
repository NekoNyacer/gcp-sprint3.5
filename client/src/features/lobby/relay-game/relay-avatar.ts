const FACES = ['😺', '🦊', '🐼', '🐸', '🦁', '🐧', '🐨', '🐯', '🐙', '🦄'];
const COLORS = ['#d9f2e6', '#ffe3b3', '#dce9ff', '#f8d7e8', '#e8ddff', '#fff1a8'];

function hash(seed: string): number {
  let value = 0;
  for (const character of seed) value = (value * 31 + character.charCodeAt(0)) >>> 0;
  return value;
}

export function createAvatarSeed(): string {
  return crypto.randomUUID();
}

export function avatarFace(seed: string): string {
  return FACES[hash(seed) % FACES.length];
}

export function avatarColor(seed: string): string {
  return COLORS[(hash(seed) >>> 4) % COLORS.length];
}

export function avatarDataUrl(seed: string): string {
  const face = avatarFace(seed);
  const background = avatarColor(seed);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="34" fill="${background}"/><circle cx="64" cy="64" r="48" fill="white" fill-opacity=".72"/><text x="64" y="82" font-size="58" text-anchor="middle">${face}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
