import { TestBed } from '@angular/core/testing';
import { LiveEnvironmentService } from './live-environment.service';
describe('live scene environment', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); vi.useRealTimers(); });
  it('shares a five-minute weather cache for nearby sites and refreshes it afterward', async () => {
    vi.useFakeTimers();
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({current: {
      weather_code: 61, precipitation: 1, temperature_2m: 22, time: Math.floor(Date.now() / 1000),
    }}));
    const service = TestBed.inject(LiveEnvironmentService);
    const signal = new AbortController().signal;
    const p = {latitude: 25.001, longitude: 121.451};
    expect(await service.weatherAt(p, signal)).toMatchObject({condition: 'rainy'});
    await service.weatherAt({...p, latitude: 25.002}, signal);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5 * 60_000);
    await service.weatherAt(p, signal);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('changes scene time at the Taipei boundary without reopening the scene', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T18:59:00+08:00'));
    const service = TestBed.inject(LiveEnvironmentService);
    expect(service.timeOfDay()).toBe('dusk');
    vi.advanceTimersByTime(60_000);
    expect(service.timeOfDay()).toBe('night');
  });
  it('does not cache failed lookups so the next opening can recover', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(Response.json({current: {weather_code: 0, precipitation: 0, temperature_2m: 28, time: Math.floor(Date.now() / 1000)}}));
    const service = TestBed.inject(LiveEnvironmentService), signal = new AbortController().signal;
    const p = {latitude: 25, longitude: 121.45};
    expect((await service.weatherAt(p, signal)).condition).toBe('unknown');
    expect((await service.weatherAt(p, signal)).condition).toBe('sunny');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
