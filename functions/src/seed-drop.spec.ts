import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_SEED_TYPES,
  DEFAULT_WALK_SEED_DROP,
  drawWalkSeed,
} from "./planting-catalog.js";
import { validateConfig } from "./cms-domain.js";
const config = () =>
  JSON.parse(
    readFileSync(
      new URL("../../firebase/seed/cms-demo.json", import.meta.url),
      "utf8",
    ),
  );
describe("route mystery-seed distribution", () => {
  it("separates the discovery draw from species weights, including exact boundaries", () => {
    const pool = {
      id: "test",
      name: "測試",
      enabled: true,
      outcomes: [
        { species: "常見", weight: 99 },
        { species: "稀有", weight: 1 },
      ],
    };
    const rule = { enabled: true, chancePercent: 35, seedTypeId: "test" };
    expect(drawWalkSeed(rule, [pool], 0, 0)).toBe("常見");
    expect(drawWalkSeed(rule, [pool], 0.349999, 0.99)).toBe("稀有");
    expect(drawWalkSeed(rule, [pool], 0.35, 0.99)).toBeNull();
    expect(
      drawWalkSeed({ ...rule, chancePercent: 0 }, [pool], 0, 0),
    ).toBeNull();
    expect(
      drawWalkSeed({ ...rule, chancePercent: 100 }, [pool], 0.999999, 0.999999),
    ).toBe("稀有");
    expect(drawWalkSeed({ ...rule, enabled: false }, [pool], 0, 0)).toBeNull();
    expect(drawWalkSeed(rule, [{ ...pool, enabled: false }], 0, 0)).toBeNull();
    expect(drawWalkSeed(rule, [], 0, 0)).toBeNull();
  });
  it("validates and round trips the published reward configuration", () => {
    const data = config();
    data.walkSeedDrop = { ...DEFAULT_WALK_SEED_DROP, chancePercent: 12.5 };
    expect(validateConfig(data).walkSeedDrop).toEqual(data.walkSeedDrop);
    for (const value of [-1, 101, NaN, "35", null]) {
      data.walkSeedDrop.chancePercent = value;
      expect(() => validateConfig(data)).toThrow();
    }
    data.walkSeedDrop = { ...DEFAULT_WALK_SEED_DROP, seedTypeId: "missing" };
    expect(() => validateConfig(data)).toThrow();
    data.walkSeedDrop.enabled = false;
    expect(validateConfig(data).walkSeedDrop?.enabled).toBe(false);
  });
  it("supports legacy catalogs and all eight default weighted outcomes", () => {
    const data = config();
    delete data.walkSeedDrop;
    expect(validateConfig(data).walkSeedDrop?.chancePercent).toBe(35);
    const pool = DEFAULT_SEED_TYPES[0];
    expect(pool.outcomes.reduce((sum, o) => sum + o.weight, 0)).toBe(100);
    let weight = 0;
    for (const o of pool.outcomes) {
      expect(
        drawWalkSeed(
          { ...DEFAULT_WALK_SEED_DROP, chancePercent: 100 },
          [pool],
          0,
          (weight + 0.01) / 100,
        ),
      ).toBe(o.species);
      weight += o.weight;
    }
  });
});
