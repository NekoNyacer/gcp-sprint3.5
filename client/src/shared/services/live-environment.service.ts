import { DestroyRef, inject, Service, signal } from '@angular/core';
import { currentWeather, CurrentWeather, taipeiTimeOfDay } from '../../../../functions/src/live-weather';
import { GeoPoint } from '../models/geo.models';

@Service()
export class LiveEnvironmentService {
  readonly now = signal(new Date());
  private readonly cache = new Map<string, {at: number; value: CurrentWeather}>();
  constructor() {
    const timer = setInterval(() => this.now.set(new Date()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
  timeOfDay() { return taipeiTimeOfDay(this.now()); }
  async weatherAt(position: GeoPoint, signal: AbortSignal): Promise<CurrentWeather> {
    const key = `${position.latitude.toFixed(2)},${position.longitude.toFixed(2)}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < 5 * 60_000) return cached.value;
    const value = await currentWeather(position, signal);
    if (!signal.aborted && value.source !== 'unavailable') this.cache.set(key, {at: Date.now(), value});
    return value;
  }
}
