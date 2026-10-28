/** Browser-demo qualification rules; step totals are client-reported simulation. */
export type TaskCadence = "daily" | "weekly" | "event";
export type TaskRewardType = "waterDrops" | "fertilizer" | "seeds";
export const DEFAULT_TASK_STEPS = {
  daily: 1000,
  weekly: 5000,
  event: 2000,
} as const;
export const DEFAULT_TASK_RADIUS = 100;
export const TASK_MAX_ACCURACY = 10;
export const TASK_LOCATION_MAX_AGE_MS = 30_000;
export function taskDay(at: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
export function taskPeriodStart(cadence: TaskCadence, at: number): string {
  const day = taskDay(at);
  if (cadence !== "weekly") return day;
  const date = new Date(`${day}T00:00:00+08:00`);
  const weekday = new Date(date.getTime() + 8 * 3600_000).getUTCDay();
  return taskDay(date.getTime() - ((weekday + 6) % 7) * 86400_000);
}
export function taskSteps(
  task: { cadence: TaskCadence; startsAt: number; joinedBaseline?: number },
  days: Record<string, number>,
  total: number,
  now: number,
): number {
  if (task.cadence === "event")
    return Math.max(0, total - (task.joinedBaseline ?? total));
  const start = taskPeriodStart(task.cadence, Math.max(task.startsAt, now));
  const end = taskDay(now);
  return Object.entries(days).reduce(
    (sum, [day, steps]) => sum + (day >= start && day <= end ? steps : 0),
    0,
  );
}
export function freshTaskLocation(
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    observedAt: number;
  },
  now: number,
): boolean {
  return (
    Number.isFinite(location.latitude) &&
    Math.abs(location.latitude) <= 90 &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.longitude) <= 180 &&
    Number.isFinite(location.accuracy) &&
    location.accuracy >= 0 &&
    location.accuracy <= TASK_MAX_ACCURACY &&
    Number.isFinite(location.observedAt) &&
    now - location.observedAt >= -5000 &&
    now - location.observedAt <= TASK_LOCATION_MAX_AGE_MS
  );
}
export function taskDistance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
