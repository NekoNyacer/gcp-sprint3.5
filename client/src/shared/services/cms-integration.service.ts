import { DestroyRef, Service, effect, inject, untracked } from '@angular/core';
import { CmsClientService } from './cms-client.service';
import { ProgressStore } from '../stores/progress-store';
import { SessionStore } from '../stores/session-store';
import { WalkSessionStore } from '../stores/walk-session-store';
import { cmsRetainedTrees } from '../models/cms-publication';
import { currentHomeTrees } from '../../features/home/home-tree-recommendations';
/** Connect public configuration to personal progress without resetting planted trees. */
@Service()
export class CmsIntegrationService {
  readonly cms = inject(CmsClientService);
  private readonly progress = inject(ProgressStore);
  private readonly session = inject(SessionStore);
  private readonly walk = inject(WalkSessionStore);
  private readonly destroy = inject(DestroyRef);
  private identity = '';
  private readonly pending = new Set<string>();
  private readonly settled = new Set<string>();
  private readonly retries = new Set<ReturnType<typeof setTimeout>>();
  constructor() {
    effect(() => {
      const identity = this.cms.identityKey();
      if (identity !== this.identity) {
        this.identity = identity;
        untracked(() => cmsRetainedTrees.set([]));
      }
      const trees = this.progress.demoTrees();
      const pinned = this.walk.hasActiveRoute()
        ? [this.walk.destination()?.id, ...this.walk.treeStops().map((t) => t.id)]
        : [];
      const retained = Object.entries(trees)
        .filter(([id, t]) => (t.planted || pinned.includes(id)) && t.site)
        .map(([, t]) => t.site!);
      untracked(() => {
        if (JSON.stringify(cmsRetainedTrees()) !== JSON.stringify(retained))
          cmsRetainedTrees.set(retained);
      });
    });
    effect(() => {
      const sites = currentHomeTrees();
      const demo = this.session.isDemoMode();
      this.progress.demoTrees();
      untracked(() => this.progress.ensureCmsTrees(sites, demo));
    });
    effect(() => {
      const identity = this.cms.identityKey();
      const config = this.cms.config();
      const trees = this.progress.demoTrees();
      if (!config || !this.session.canAccessApp()) return;
      for (const [treeId, tree] of Object.entries(trees)) {
        if (!tree.harvestCount) continue;
        const key = `${identity}:${treeId}:${tree.plantedAt}`;
        if (
          this.pending.has(key) ||
          this.settled.has(key) ||
          this.cms.harvestConfirmations().some((h) => h.key === key)
        )
          continue;
        this.pending.add(key);
        untracked(
          () =>
            void this.settleHarvest(
              key,
              treeId,
              String(tree.plantedAt),
              identity,
              tree.harvestVersion ?? this.cms.release()!.version,
            ),
        );
      }
    });
    this.destroy.onDestroy(() => {
      for (const timer of this.retries) clearTimeout(timer);
    });
  }
  private async settleHarvest(
    key: string,
    treeId: string,
    cycle: string,
    identity: string,
    version: number,
    attempt = 0,
  ): Promise<void> {
    try {
      if (identity !== this.cms.identityKey()) return;
      await this.cms.wallet();
      const result = await this.cms.call<{ amount: number; version: number }>('cmsHarvest', {
        treeId,
        cycle,
        version,
      });
      this.cms.harvestConfirmations.update((items) => items.filter((item) => item.key !== key));
      this.progress.reconcileCmsHarvest(treeId, result.amount, result.version);
      this.settled.add(key);
      this.cms.walletRevision.update((v) => v + 1);
      this.cms.track('core_action', treeId);
    } catch (error) {
      if (identity !== this.cms.identityKey()) return;
      const details = (error as { details?: { kind?: string; amount?: number; version?: number } })
        ?.details;
      if (
        details?.kind === 'harvest-price-changed' &&
        typeof details.amount === 'number' &&
        typeof details.version === 'number'
      ) {
        const newVersion = details.version;
        this.cms.harvestConfirmations.update((items) => [
          ...items.filter((item) => item.key !== key),
          {
            key,
            treeId,
            amount: details.amount!,
            confirm: () => {
              this.pending.add(key);
              void this.settleHarvest(key, treeId, cycle, identity, newVersion);
            },
          },
        ]);
        return;
      }
      if (attempt < 2 && identity === this.cms.identityKey()) {
        const timer = setTimeout(() => {
          this.retries.delete(timer);
          void this.settleHarvest(key, treeId, cycle, identity, version, attempt + 1);
        }, 2000);
        this.retries.add(timer);
        return;
      }
      this.cms.error.set('收成的雲端錢包同步尚未完成，請稍後重新載入。');
    } finally {
      this.pending.delete(key);
    }
  }
}
