import { describe, it, expect } from 'vitest';
import { DEFAULT_SEED_TYPES, drawSpecies, matchesCubePlan, type CubeChannel } from './planting-catalog.js';
import { validateConfig, metrics, mergeCatalog } from './cms-domain.js';
import { readFileSync } from 'node:fs';
const seed = () => JSON.parse(readFileSync(new URL('../../firebase/seed/cms-demo.json', import.meta.url), 'utf8'));
describe('independent seed pools and domestic CUBE channels', () => {
  it('merges curated content without overwriting operator edits or duplicating IDs', () => {
    const incoming = seed();
    const original = structuredClone(incoming); original.merchants[0].name = '營運改名'; original.harvestPoints = 77;
    original.merchants = original.merchants.slice(0,1);
    const result = mergeCatalog(original, incoming);
    expect(result.merchants[0].name).toBe('營運改名');
    expect(result.merchants.length).toBe(incoming.merchants.length);
    expect(result.harvestPoints).toBe(77);
    expect(mergeCatalog(result, incoming)).toEqual(result);
  });
  it('spaces newly added planting sites at least 450 m from existing sites and each other', () => {
    const sites = seed().trees;
    for (let i = 13; i < sites.length; i++) for (let j = 0; j < i; j++) {
      const a = sites[i], b = sites[j], rad = Math.PI / 180;
      const h = Math.sin((a.latitude-b.latitude)*rad/2)**2 + Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin((a.longitude-b.longitude)*rad/2)**2;
      expect(6371000 * 2 * Math.asin(Math.sqrt(h))).toBeGreaterThanOrEqual(450);
    }
  });
  it('draws relative weights including exact boundaries and rare outcomes', () => {
    const pool = {...DEFAULT_SEED_TYPES[0], outcomes: [{species:'榕樹',weight:60},{species:'桂花',weight:30},{species:'櫻花',weight:9},{species:'銀杏',weight:1}]};
    expect(drawSpecies(pool, 0)).toBe('榕樹');
    expect(drawSpecies(pool, 0.599999)).toBe('榕樹');
    expect(drawSpecies(pool, 0.6)).toBe('桂花');
    expect(drawSpecies(pool, 0.9)).toBe('櫻花');
    expect(drawSpecies(pool, 0.99)).toBe('銀杏');
    expect(drawSpecies(pool, 0.99999999)).toBe('銀杏');
    for (const value of [-1, 1, NaN]) expect(() => drawSpecies(pool, value)).toThrow();
  });
  it('rejects malformed pools, invalid species, duplicate outcomes and invalid channel references', () => {
    for (const patch of [
      (c: any) => c.seedTypes[0].outcomes[0].weight = 0,
      (c: any) => c.seedTypes[0].outcomes[0].weight = 1.1,
      (c: any) => c.seedTypes[0].outcomes[0].species = '不存在',
      (c: any) => c.seedTypes[0].outcomes.push(c.seedTypes[0].outcomes[0]),
      (c: any) => c.merchants[0].cubeChannelIds = ['missing'],
      (c: any) => c.cubeChannels[0].startsOn = '2026-02-30',
    ]) { const data = seed(); patch(data); expect(() => validateConfig(data)).toThrow(); }
  });
  it('allows empty sites without preset species and preserves new catalog fields', () => {
    const c = seed(); c.trees[0].empty = true; c.trees[0].species = '';
    const actual = validateConfig(c);
    expect(actual.trees[0].species).toBe('');
    expect(actual.seedTypes).toEqual(c.seedTypes);
    expect(actual.cubeChannels).toEqual(c.cubeChannels);
    expect(actual.merchants.find(m => m.id === 'ikea-neihu')?.postalCode).toBe('114');
  });
  it('migrates legacy catalogs to a seed pool without changing their tree metadata', () => {
    const c = seed(); delete c.seedTypes;
    const actual = validateConfig(c);
    expect(actual.seedTypes?.[0].outcomes.every(o => c.species.includes(o.species))).toBe(true);
    expect(actual.trees[0].name).toBe(c.trees[0].name);
  });
  it('only matches domestic enabled channels within inclusive effective dates', () => {
    const c: CubeChannel = seed().cubeChannels[0];
    const merchant = {cubeChannelIds: [c.id]};
    expect(matchesCubePlan(merchant, [c], c.plan, c.startsOn)).toBe(true);
    expect(matchesCubePlan(merchant, [c], c.plan, c.endsOn)).toBe(true);
    for (const channel of [{...c, domestic: false}, {...c, enabled: false}, {...c, endsOn: '2025-12-31'}])
      expect(matchesCubePlan(merchant, [channel], c.plan, '2026-10-22')).toBe(false);
    expect(matchesCubePlan({}, [c], c.plan, '2026-10-22')).toBe(false);
    expect(matchesCubePlan(merchant, [c], '秋日遊', '2026-10-22')).toBe(false);
  });
  it('separates recommendation source, navigation intent, arrival count and visitors', () => {
    const result = metrics([
      {actor: 'a', entityId: 'shop', name: 'merchant_recommended', source: 'gemini', plan: '集精選', at: 1},
      {actor: 'a', entityId: 'shop', name: 'merchant_recommended', source: 'rules', at: 2},
      {actor: 'b', entityId: 'shop', name: 'navigation_started', at: 3},
      {actor: 'a', entityId: 'shop', name: 'merchant_arrived', at: 4},
      {actor: 'a', entityId: 'shop', name: 'merchant_arrived', at: 5},
    ], []);
    expect(result.merchants[0]).toMatchObject({recommended: 2, gemini: 1, rules: 1, navigations: 1, arrivals: 2, visitors: 1});
  });
});
