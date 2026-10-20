export type SceneWeather = 'sunny' | 'rainy' | 'cloudy';
export type SceneTimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
export type SceneEnvironment = { weather: SceneWeather; timeOfDay: SceneTimeOfDay };

export const SCENE_WEATHERS: readonly SceneWeather[] = ['sunny', 'rainy', 'cloudy'];
export const SCENE_TIMES: readonly SceneTimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];
export const SCENE_WEATHER_LABELS: Record<SceneWeather, string> = {
  sunny: '晴天',
  rainy: '雨天',
  cloudy: '陰天',
};
export const SCENE_TIME_LABELS: Record<SceneTimeOfDay, string> = {
  dawn: '清晨',
  day: '白日',
  dusk: '黃昏',
  night: '夜晚',
};

export function treeSceneBackground(weather: SceneWeather, timeOfDay: SceneTimeOfDay): string {
  return `/images/backgrounds/tree-scene/${weather}-${timeOfDay}.webp`;
}

/** Demo assignments shuffled once with seed 20261019: inspecting/reloading a POI preserves its scene. */
export const DEMO_POI_ENVIRONMENTS = {
  'tree-1': { weather: 'rainy', timeOfDay: 'dawn' },
  'tree-2': { weather: 'sunny', timeOfDay: 'day' },
  'tree-3': { weather: 'cloudy', timeOfDay: 'day' },
  'tree-4': { weather: 'sunny', timeOfDay: 'dawn' },
  'tree-5': { weather: 'rainy', timeOfDay: 'dusk' },
  'tree-6': { weather: 'cloudy', timeOfDay: 'dawn' },
  'tree-7': { weather: 'cloudy', timeOfDay: 'night' },
  'tree-8': { weather: 'rainy', timeOfDay: 'night' },
  'tree-9': { weather: 'sunny', timeOfDay: 'night' },
  'tree-10': { weather: 'rainy', timeOfDay: 'day' },
  'planting-banqiao-1': { weather: 'sunny', timeOfDay: 'dusk' },
  'planting-banqiao-2': { weather: 'cloudy', timeOfDay: 'dusk' },
  'planting-banqiao-3': { weather: 'rainy', timeOfDay: 'dawn' },
  'route-water-1': { weather: 'rainy', timeOfDay: 'day' },
  'route-water-2': { weather: 'sunny', timeOfDay: 'dusk' },
  'route-water-3': { weather: 'rainy', timeOfDay: 'dusk' },
  'route-water-4': { weather: 'cloudy', timeOfDay: 'dusk' },
  'route-fertilizer': { weather: 'sunny', timeOfDay: 'dawn' },
} as const satisfies Record<string, SceneEnvironment>;
