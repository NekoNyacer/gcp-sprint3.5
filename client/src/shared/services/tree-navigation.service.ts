import { Injectable } from '@angular/core';

/** One-time handoff consumed only when the Home tab has entered. */
@Injectable({ providedIn: 'root' })
export class TreeNavigationService {
  private treeId: string | null = null;
  request(treeId: string): void { this.treeId = treeId; }
  take(): string | null {
    const treeId = this.treeId;
    this.treeId = null;
    return treeId;
  }
}
