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
 * 追蹤購物車的商品
 * ...其他自己想
 */

const initialState: ShopStore = {};

export const ShopStore = signalStore(
  { providedIn: 'root' },
  withState({}),
  withProps(() => ({})),
  withComputed((store) => ({})),
  withMethods((store) => ({})),
  withHooks((store) => ({})),
);

type ShopStore = {};
