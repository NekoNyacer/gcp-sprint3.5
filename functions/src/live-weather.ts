/** Shared by the scene client and trusted recommendation service. No stored locations. */
export type CurrentWeather = {
  source: 'open-meteo' | 'unavailable';
  condition: 'sunny' | 'rainy' | 'cloudy' | 'unknown';
  temperatureC: number | null;
  precipitationMm: number | null;
  observedAt: string | null;
};
export const unknownWeather = (): CurrentWeather => ({
  source: 'unavailable', condition: 'unknown', temperatureC: null,
  precipitationMm: null, observedAt: null,
});

export function taipeiTimeOfDay(now = new Date()): 'dawn' | 'day' | 'dusk' | 'night' {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei', hour: '2-digit', hourCycle: 'h23',
  }).format(now));
  return hour >= 5 && hour < 7 ? 'dawn' : hour >= 7 && hour < 17 ? 'day'
    : hour >= 17 && hour < 19 ? 'dusk' : 'night';
}

export async function currentWeather(
  point: {latitude: number; longitude: number}, signal?: AbortSignal,
): Promise<CurrentWeather> {
  try {
    // Approximate to a weather grid; do not transmit the exact player coordinate.
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', point.latitude.toFixed(2));
    url.searchParams.set('longitude', point.longitude.toFixed(2));
    url.searchParams.set('current', 'temperature_2m,precipitation,weather_code');
    url.searchParams.set('timeformat', 'unixtime');
    const response = await fetch(url, {
      signal: AbortSignal.any([AbortSignal.timeout(4000), ...(signal ? [signal] : [])]),
    });
    if (!response.ok) return unknownWeather();
    const data = await response.json();
    const weather = data?.current;
    const code = weather?.weather_code;
    const time = weather?.time;
    const allowed = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
    if (!weather || !allowed.includes(code) || typeof time !== 'number' || !Number.isFinite(time) ||
        Math.abs(Date.now() - time * 1000) > 90 * 60_000 ||
        typeof weather.temperature_2m !== 'number' || !Number.isFinite(weather.temperature_2m) ||
        typeof weather.precipitation !== 'number' || !Number.isFinite(weather.precipitation) || weather.precipitation < 0)
      return unknownWeather();
    return {
      source: 'open-meteo',
      condition: weather.precipitation > 0 || code >= 51 ? 'rainy' : code <= 1 ? 'sunny' : 'cloudy',
      temperatureC: weather.temperature_2m, precipitationMm: weather.precipitation,
      observedAt: new Date(time * 1000).toISOString(),
    };
  } catch { return unknownWeather(); }
}
