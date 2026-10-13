import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
  withHooks,
  withProps,
} from '@ngrx/signals';

/**此Store管理:
 * 目前(本日)走了多少步
 * 有多少庫存資源(光能/水滴/肥料)
 * */

const initialState: ProgressState = {
  todaySteps: 15888,
  inventory: {
    lightEnergy: 5946,
    waterDrops: 777,
    fertilizer: 5,
  },
};

export const ProgressStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({})),
  withComputed((store) => ({})),
  withMethods((store) => ({
    applyTaskInventory(inventory: { waterDrops: number; fertilizer: number }): void {
      patchState(store, {
        inventory: {
          ...store.inventory(),
          waterDrops: inventory.waterDrops,
          fertilizer: inventory.fertilizer,
        },
      });
    },
    /**將步數轉為光能 */
    transformStepsToLightEnergy: () => {
      const steps = store.todaySteps();
      const lightEnergy = store.inventory().lightEnergy;
      patchState(store, {
        todaySteps: 0,
        inventory: {
          ...store.inventory(),
          lightEnergy: lightEnergy + steps,
        },
      });
    },
    /**增加步數 */
    addSteps: (steps: number) => {
      if (!Number.isSafeInteger(steps) || steps <= 0) {
        return;
      }

      patchState(store, {
        todaySteps: store.todaySteps() + steps,
      });
    },
  })),
  withHooks((store) => ({})),
);

type ProgressState = {
  todaySteps: number;
  inventory: {
    lightEnergy: number;
    waterDrops: number;
    fertilizer: number;
  };
};
