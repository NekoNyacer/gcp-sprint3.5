import { Service, signal } from '@angular/core';

export type TreeDisplayMode = '3d' | '2d';
const STORAGE_KEY = 'cat-walk.tree-display-mode';

/**
 * Settings-page entry point: inject(TreeDisplayService).setMode('2d' | '3d').
 * Observe mode() for the saved choice. A failure fallback never changes it.
 */
@Service()
export class TreeDisplayService {
  private readonly selectedMode = signal<TreeDisplayMode>(this.readMode());
  readonly mode = this.selectedMode.asReadonly();

  setMode(mode: TreeDisplayMode): void {
    if (mode !== '3d' && mode !== '2d') return;
    this.selectedMode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Still apply the preference in memory if device storage is unavailable.
    }
  }

  private readMode(): TreeDisplayMode {
    try {
      return localStorage.getItem(STORAGE_KEY) === '2d' ? '2d' : '3d';
    } catch {
      return '3d';
    }
  }
}
