import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentWeather, taipeiTimeOfDay } from './live-weather.js';
describe('live weather and Taipei scene time', () => {
  afterEach(() => vi.unstubAllGlobals());
  const point = {latitude: 25.001001886, longitude: 121.454754183};
  it.each([[0, 0, 'sunny'], [3, 0, 'cloudy'], [61, 0, 'rainy'], [0, 1, 'rainy'], [95, 2, 'rainy']])(
    'maps WMO %i / precipitation %i to %s', async (code, precipitation, condition) => {
      const fetch = vi.fn(async () => Response.json({current: {
        weather_code: code, precipitation, temperature_2m: 28, time: Math.floor(Date.now() / 1000),
      }}));
      vi.stubGlobal('fetch', fetch);
      expect(await currentWeather(point)).toMatchObject({source: 'open-meteo', condition, temperatureC: 28});
      const url = fetch.mock.calls[0][0] as unknown as URL;
      expect(url.searchParams.get('latitude')).toBe('25.00');
      expect(url.toString()).not.toContain('25.001001886');
    });
  it.each([
    {weather_code: 0, precipitation: 0, temperature_2m: 25, time: 1},
    {weather_code: 999, precipitation: 0, temperature_2m: 25, time: Math.floor(Date.now() / 1000)},
    {weather_code: 0, precipitation: 0, time: Math.floor(Date.now() / 1000)},
  ])('treats stale or malformed weather as unknown', async current => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({current})));
    expect(await currentWeather(point)).toMatchObject({source: 'unavailable', condition: 'unknown'});
  });
  it('handles unavailable weather without inventing sunshine', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await currentWeather(point)).toMatchObject({condition: 'unknown', temperatureC: null});
  });
  it.each([[4, 'night'], [5, 'dawn'], [6, 'dawn'], [7, 'day'], [16, 'day'], [17, 'dusk'], [18, 'dusk'], [19, 'night'], [23, 'night']])(
    'uses Taipei hour %i for %s regardless of host timezone', (hour, expected) => {
      expect(taipeiTimeOfDay(new Date(`2026-10-27T${String(hour).padStart(2, '0')}:00:00+08:00`))).toBe(expected);
    });
});
