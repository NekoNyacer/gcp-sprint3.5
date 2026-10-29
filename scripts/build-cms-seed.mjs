import { expandCatalog } from "./expanded-catalog.mjs";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const require = createRequire(resolve(root, "client/package.json"));
const { build } = require("esbuild");
const output = await build({
  stdin: {
    contents: `
  import { DEFAULT_SEED_TYPES, DEFAULT_WALK_SEED_DROP } from '../functions/src/planting-catalog';
  import { homeTrees } from './src/features/home/home-tree-recommendations';
  import { demoSupplyStations } from './src/environments/environment-dev';
  import { SHOP_REDEMPTION_OPTIONS, SHOP_CHARITY_CAMPAIGN } from './src/features/shop/shop.config';
  import { DEMO_HARVEST_POINTS } from './src/shared/models/tree-cultivation';
  import { DEMO_POI_ENVIRONMENTS } from './src/shared/models/tree-scene-environment';
  export const seed = {
    harvestPoints: DEMO_HARVEST_POINTS,
    seedTypes: DEFAULT_SEED_TYPES,
    walkSeedDrop: DEFAULT_WALK_SEED_DROP,
    species: [...new Set([...homeTrees.map(t => t.species), ...DEFAULT_SEED_TYPES[0].outcomes.map(o => o.species)])],
    trees: homeTrees.map(t => ({ id: t.id, name: t.nickName, species: t.species, place: t.poiName, postalCode: t.postalCode,
      latitude: t.position.latitude, longitude: t.position.longitude, empty: !!t.empty, growth: t.growth,
      weather: t.weather, timeOfDay: t.timeOfDay ?? 'day' })),
    // Original supply fixtures have route-relative anchors, not real addresses.
    // Freeze explicit simulated positions around Banqiao solely for this demo.
    merchants: demoSupplyStations.map((m, i) => ({ id: m.id, name: m.name,
      address: '板橋展示區・模擬位置（非真實商家）', latitude: 25.0134 + (i % 3 - 1) * 0.0014,
      longitude: 121.4628 + (Math.floor(i / 3) ? 1 : -1) * 0.0015,
      category: m.category, twqr: m.isCathayTwqrMerchant, enabled: true, roles: ['planting', 'supply'],
      offer: m.offer, terms: 'Demo 模擬優惠，非真實商家活動。' + m.terms, validUntil: m.validUntil.replaceAll('/', '-'),
      resource: m.supply.resource, amount: m.supply.amount, weather: m.weather ?? 'sunny', timeOfDay: m.timeOfDay ?? 'day' })),
    rewards: [
      { id: 'demo-drink', name: '飲品折抵券', kind: 'PRODUCT', enabled: true, requiredPoints: 30, costNtd: 30 },
      { id: 'demo-green-transport', name: '綠色交通折抵券', kind: 'PRODUCT', enabled: true, requiredPoints: 50, costNtd: 50 },
      { id: SHOP_CHARITY_CAMPAIGN.id, name: SHOP_CHARITY_CAMPAIGN.name, kind: 'CHARITY', enabled: true,
        requiredPoints: 50, costNtd: SHOP_CHARITY_CAMPAIGN.totalAmount }],
    scenes: [...new Set(Object.values(DEMO_POI_ENVIRONMENTS).map(s => s.weather + '-' + s.timeOfDay))].map(id => ({
      id, name: id, weather: id.split('-')[0], timeOfDay: id.split('-')[1] })),
  };
`,
    resolveDir: resolve(root, "client"),
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
});
const module = { exports: {} };
new Function("module", "exports", "require", output.outputFiles[0].text)(
  module,
  module.exports,
  require,
);
const taskSeed = JSON.parse(await readFile(resolve(root, 'firebase/seed/tasks.json'), 'utf8'));
const start = Date.parse('2026-10-21T00:00:00+08:00');
module.exports.seed.tasks = taskSeed.tasks.map(task => ({
  id: task.taskIdPrefix, name: task.title, description: task.description,
  areaId: task.areaId, cadence: task.cadence, enabled: true,
  startsAt: new Date(start).toISOString(),
  endsAt: new Date(start + (task.cadence === 'daily' ? 1 : task.cadence === 'weekly' ? 7 : (task.durationDays ?? 30)) * 86400000).toISOString(),
  destinationName: task.destination.name, address: task.destination.address,
  latitude: task.destination.latitude, longitude: task.destination.longitude, rewardAmount: task.reward.amount,
}));
const json = JSON.stringify(expandCatalog(module.exports.seed), null, 2) + "\n";
for (const destination of [
  "firebase/seed/cms-demo.json",
  "cms/public/cms-demo.json",
]) {
  const path = resolve(root, destination);
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, json);
}
console.log(
  "Generated CMS seed from existing fixtures (without changing client configuration).",
);
