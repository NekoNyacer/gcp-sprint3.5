import { describe, expect, it } from "vitest";
import {
  taskDay,
  taskPeriodStart,
  taskSteps,
  taskDistance,
  freshTaskLocation,
} from "./task-domain.js";
describe("Task walking periods and coordinates", () => {
  const now = Date.parse("2026-10-28T12:00:00+08:00");
  it("uses Taipei midnight and Monday as the period boundaries", () => {
    expect(taskDay(Date.parse("2026-10-28T15:59:59Z"))).toBe("2026-10-28");
    expect(taskDay(Date.parse("2026-10-28T16:00:00Z"))).toBe("2026-10-29");
    expect(taskPeriodStart("weekly", now)).toBe("2026-10-26");
    const days = {
      "2026-10-25": 10000,
      "2026-10-26": 1000,
      "2026-10-28": 2500,
      "2026-10-29": 10000,
    };
    expect(
      taskSteps({ cadence: "daily", startsAt: now - 1000 }, days, 23500, now),
    ).toBe(2500);
    expect(
      taskSteps({ cadence: "weekly", startsAt: now - 1000 }, days, 23500, now),
    ).toBe(3500);
  });
  it("counts only steps after event enrollment and does not invent a missing baseline", () => {
    expect(
      taskSteps(
        { cadence: "event", startsAt: 0, joinedBaseline: 1000 },
        {},
        3000,
        now,
      ),
    ).toBe(2000);
    expect(taskSteps({ cadence: "event", startsAt: 0 }, {}, 3000, now)).toBe(0);
  });
  it("keeps range and observation precision independent", () => {
    const location = {
      latitude: 25,
      longitude: 121,
      accuracy: 10,
      observedAt: now - 30000,
    };
    expect(freshTaskLocation(location, now)).toBe(true);
    expect(freshTaskLocation({ ...location, accuracy: 10.1 }, now)).toBe(false);
    expect(
      freshTaskLocation({ ...location, observedAt: now - 30001 }, now),
    ).toBe(false);
    expect(taskDistance(location, location)).toBe(0);
    expect(
      taskDistance(location, { latitude: 25.0008, longitude: 121 }),
    ).toBeLessThan(100);
    expect(
      taskDistance(location, { latitude: 25.001, longitude: 121 }),
    ).toBeGreaterThan(100);
  });
});
