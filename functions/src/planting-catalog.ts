/** Species are independent of places. Weights are relative within each seed pool. */
export interface SeedType {
  id: string;
  name: string;
  enabled: boolean;
  outcomes: { species: string; weight: number }[];
}
export const DEFAULT_SEED_TYPES: SeedType[] = [{
  id: 'mystery', name: '神秘種子', enabled: true,
  outcomes: [{ species: '榕樹', weight: 30 }, { species: '樟樹', weight: 24 }, { species: '桂花', weight: 18 }, { species: '柿子', weight: 12 }, { species: '楓香', weight: 8 }, { species: '櫻花', weight: 5 }, { species: '銀杏', weight: 2 }, { species: '國泰小樹', weight: 1 }],
}];
export interface WalkSeedDrop { enabled: boolean; chancePercent: number; seedTypeId: string; }
export const DEFAULT_WALK_SEED_DROP: WalkSeedDrop = { enabled: true, chancePercent: 35, seedTypeId: 'mystery' };
export interface SeedOrigin { routeId: string; place: string; acquiredAt: number; }
export interface MysterySeed { id: string; species: string; seedTypeId: string; version: number; origin?: SeedOrigin; }
/** Two independent draws: whether a seed drops, then its hidden species. */
export function drawWalkSeed(rule: WalkSeedDrop, pools: SeedType[], dropRoll: number, speciesRoll: number): string | null {
  if (!Number.isFinite(dropRoll) || dropRoll < 0 || dropRoll >= 1 ||
      !Number.isFinite(rule.chancePercent) || rule.chancePercent < 0 || rule.chancePercent > 100) throw new Error('種子掉落率無效');
  const pool = pools.find(p => p.id === rule.seedTypeId && p.enabled);
  if (!rule.enabled || !pool || dropRoll >= rule.chancePercent / 100) return null;
  return drawSpecies(pool, speciesRoll);
}
export function drawSpecies(seed: SeedType, random: number): string {
  const total = seed.outcomes.reduce((sum, o) => sum + o.weight, 0);
  if (!seed.enabled || !Number.isFinite(random) || random < 0 || random >= 1 || !total ||
      seed.outcomes.some(o => !Number.isSafeInteger(o.weight) || o.weight <= 0)) throw new Error('種子機率池無效');
  let cursor = random * total;
  for (const outcome of seed.outcomes) {
    cursor -= outcome.weight;
    if (cursor < 0) return outcome.species;
  }
  return seed.outcomes[seed.outcomes.length - 1].species;
}
export interface CubeChannel {
  id: string;
  name: string;
  plan: string;
  brand: string;
  startsOn: string;
  endsOn: string;
  domestic: boolean;
  enabled: boolean;
  sourceUrl: string;
  terms: string;
}
export function matchesCubePlan(merchant: { cubeChannelIds?: string[] }, channels: CubeChannel[], plan: string, day: string): boolean {
  return !plan || channels.some(c => c.plan === plan && c.enabled && c.domestic &&
    c.startsOn <= day && c.endsOn >= day && merchant.cubeChannelIds?.includes(c.id));
}
