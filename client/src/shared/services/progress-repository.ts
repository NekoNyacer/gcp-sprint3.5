import { inject, Injectable } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ProgressState, createProgressState } from '../stores/progress-store';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { taipeiDay } from '../models/tree-cultivation';

@Injectable({ providedIn: 'root' })
export class ProgressRepository {
  private readonly db = inject(Firestore);
  private readonly functions = inject(Functions);

  async load(uid: string): Promise<{ state: ProgressState; revision: number }> {
    await httpsCallable(this.functions, 'initializeWalkProgress')({});
    const [progress, inventory] = await Promise.all([
      getDoc(doc(this.db, 'users', uid, 'progress', 'current')),
      getDoc(doc(this.db, 'users', uid, 'inventory', 'current')),
    ]);
    const state = { ...createProgressState(false), ...progress.data()?.['state'] } as ProgressState;
    state.inventory = { ...createProgressState(false).inventory, ...inventory.data() };
    // Firestore metadata does not belong in the inventory saved by the client.
    state.inventory = Object.fromEntries(Object.keys(createProgressState(false).inventory)
      .map((key) => [key, state.inventory[key as keyof ProgressState['inventory']]])) as ProgressState['inventory'];
    if (state.todayStepsDay !== taipeiDay()) {
      state.todaySteps = 0;
      state.todayStepsDay = taipeiDay();
      state.lightEarnedOn = taipeiDay();
      state.lightEarnedToday = 0;
    }
    state.activeDemoTreeId = 'demo-tree';
    state.cultivationError = null;
    // Interrupted harvest animations can be retried without a second payout.
    for (const tree of Object.values(state.demoTrees)) tree.harvestStartedAt = null;
    return { state, revision: progress.data()?.['revision'] ?? 0 };
  }

  async save(uid: string, state: ProgressState, previous: ProgressState, revision: number): Promise<void> {
    await httpsCallable(this.functions, 'saveWalkProgress')({
      uid, state, previousInventory: previous.inventory, revision,
    });
  }
}
