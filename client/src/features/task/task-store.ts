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
 * 追蹤目前任務進度狀況
 * 那些任務已完成，那些任務即將過期
 * ...其他自己想
 */

const initialState: TaskState = {};

export const TaskStore = signalStore(
  { providedIn: 'root' },
  withState({}),
  withProps(() => ({})),
  withComputed((store) => ({})),
  withMethods((store) => ({})),
  withHooks((store) => ({})),
);

type TaskState = {};
