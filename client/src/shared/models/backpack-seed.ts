import type { MysterySeed } from '../../../../functions/src/planting-catalog';

export type BackpackSeed = {
  id: string;
  name: '小種子' | '普通種子' | '大種子' | '特別種子';
  place: string;
  tint: string;
  size: number;
  seam: number;
};

// Presentation defaults only: these groups never change species odds or growth.
const appearances: Record<string, Pick<BackpackSeed, 'name' | 'tint' | 'size' | 'seam'>> = {
  榕樹: { name: '普通種子', tint: '#8c956d', size: 1, seam: -8 },
  樟樹: { name: '普通種子', tint: '#7f9276', size: 1, seam: 8 },
  桂花: { name: '小種子', tint: '#b6a17b', size: 0.82, seam: -5 },
  櫻花: { name: '小種子', tint: '#b28e8c', size: 0.82, seam: 10 },
  柿子: { name: '大種子', tint: '#b19570', size: 1.14, seam: -10 },
  楓香: { name: '大種子', tint: '#a58675', size: 1.14, seam: 6 },
  銀杏: { name: '特別種子', tint: '#b6ac78', size: 1.03, seam: -4 },
  國泰小樹: { name: '特別種子', tint: '#849d81', size: 1.03, seam: 12 },
};

export function backpackSeeds(seeds: readonly MysterySeed[], balance: number): BackpackSeed[] {
  return [
    ...seeds.slice(0, balance).map((seed) => ({
      id: seed.id,
      ...(appearances[seed.species] ?? appearances['榕樹']),
      place: seed.origin?.place || '取得地點未記錄',
    })),
    ...Array.from({ length: Math.max(0, balance - seeds.length) }, (_, index) => ({
      id: `legacy-seed-${index}`,
      name: '普通種子' as const,
      tint: '#999277',
      size: 1,
      seam: 0,
      place: '取得地點未記錄',
    })),
  ];
}
