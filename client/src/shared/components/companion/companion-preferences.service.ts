import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'cat-walk.companion-enabled';

@Injectable({ providedIn: 'root' })
export class CompanionPreferencesService {
  private readonly preference = signal(this.readEnabled());
  readonly enabled = this.preference.asReadonly();

  setEnabled(enabled: boolean): void {
    this.preference.set(enabled);
    try { localStorage.setItem(STORAGE_KEY, String(enabled)); }
    catch { /* Apply for this session even when device storage is unavailable. */ }
  }

  private readEnabled(): boolean {
    try { return localStorage.getItem(STORAGE_KEY) !== 'false'; }
    catch { return true; }
  }
}
