import { InjectionToken } from '@angular/core';
import type { TreeSceneController } from './tree-scene.controller';

export type TreeSceneRenderer = Pick<
  TreeSceneController,
  | 'dispose'
  | 'refresh'
  | 'update'
  | 'setResourceEffect'
  | 'setWaterState'
  | 'setFertilized'
  | 'setTreeVisible'
  | 'setFruitState'
  | 'setShakeAngle'
  | 'stopPointerInteraction'
>;
export type TreeSceneRendererModule = {
  TreeSceneController: new (
    ...args: ConstructorParameters<typeof TreeSceneController>
  ) => TreeSceneRenderer;
};

export const TREE_SCENE_RENDERER = new InjectionToken<() => Promise<TreeSceneRendererModule>>(
  'TREE_SCENE_RENDERER',
  {
    providedIn: 'root',
    factory: () => () => import('./tree-scene.controller'),
  },
);
