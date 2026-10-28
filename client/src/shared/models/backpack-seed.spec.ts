import { backpackSeeds } from './backpack-seed';

describe('backpack seed presentation', () => {
  it('shows route origins and generic names without exposing species', () => {
    const rows = backpackSeeds(
      ['榕樹', '桂花', '柿子', '銀杏'].map((species, i) => ({
        id: `seed-${i}`,
        species,
        seedTypeId: 'mystery',
        version: 1,
        origin: { routeId: 'walk-banqiao', place: '板橋車站', acquiredAt: 10 },
      })),
      4,
    );
    expect(rows.map((row) => row.name)).toEqual(['普通種子', '小種子', '大種子', '特別種子']);
    expect(rows.every((row) => row.place === '板橋車站')).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('銀杏');
  });
  it('does not invent origins for legacy inventory', () => {
    expect(backpackSeeds([], 1)[0]).toMatchObject({ id: 'legacy-seed-0', place: '取得地點未記錄' });
    expect(backpackSeeds([], 0)).toEqual([]);
  });
});
