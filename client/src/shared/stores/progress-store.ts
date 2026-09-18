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
  todaySteps: 0,
  inventory: {
    lightEnergy: 0,
    waterDrops: 0,
    fertilizer: 0,
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
