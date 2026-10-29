import { computed, effect, inject, untracked } from '@angular/core';
import { cmsPublication, CMS_CONNECTION } from '../../shared/models/cms-publication';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
  WritableStateSource,
} from '@ngrx/signals';
import {
  ShopRepository,
  ShopRepositoryError,
} from '../../shared/repositories/shop.repository';
import {
  SHOP_CHARITY_CAMPAIGN,
  SHOP_MILESTONES,
  SHOP_REDEMPTION_OPTIONS,
} from './shop.config';
import {
  ExpirySummary,
  MilestoneProgress,
  RedemptionOptionId,
  ShopCommandError,
  ShopCommandResult,
  ShopSnapshot,
  ShopState,
} from './shop.models';

const initialState: ShopState = {
  loadStatus: 'idle',
  pointsStatus: 'idle',
  loadError: null,
  pointsError: null,
  commandError: null,
  treePointsBalance: null,
  entitlements: [],
  lifetimeMatureTrees: 0,
  transactions: [],
  isSubmitting: false,
  submission: null,
};

export const ShopStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    repository: inject(ShopRepository),
    cms: inject(CMS_CONNECTION, { optional: true }),
    generation: { value: 0 },
  })),
  withComputed((store) => ({
    availableEntitlements: computed(() =>
      store.entitlements().filter((entitlement) => entitlement.status === 'AVAILABLE'),
    ),
    availableMatureTrees: computed(
      () => store.entitlements().filter((entitlement) => entitlement.status === 'AVAILABLE').length,
    ),
    redemptionOptions: computed(() => {
      const availableTrees = store.entitlements().filter(
        (entitlement) => entitlement.status === 'AVAILABLE',
      ).length;

      const publication = cmsPublication();
      const options = publication.managed ? [] : SHOP_REDEMPTION_OPTIONS;
      return options.map((option) => ({
        ...option,
        canRedeem: availableTrees >= option.requiredTrees,
        missingTrees: Math.max(option.requiredTrees - availableTrees, 0),
      }));
    }),
    charityCampaign: computed(() => {
      const availableTrees = store.entitlements().filter(
        (entitlement) => entitlement.status === 'AVAILABLE',
      ).length;

      const publication = cmsPublication();
      const requiredTrees = publication.managed ? Number.MAX_SAFE_INTEGER : SHOP_CHARITY_CAMPAIGN.requiredTrees;
      return {
        ...SHOP_CHARITY_CAMPAIGN,
        enabled: !publication.managed,
        canDonate: availableTrees >= requiredTrees,
        missingTrees: Math.max(requiredTrees - availableTrees, 0),
      };
    }),
    expirySummary: computed(() => createExpirySummary(store.entitlements())),
    recentTransactions: computed(() =>
      [...store.transactions()]
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .slice(0, 3),
    ),
    milestoneProgress: computed(() => createMilestoneProgress(store.lifetimeMatureTrees())),
    canRedeemTreePoints: computed(
      () => store.pointsStatus() === 'loaded' && !store.isSubmitting(),
    ),
    canDonateToCharity: computed(
      () => store.loadStatus() === 'loaded' && !store.isSubmitting(),
    ),
  })),
  withMethods((store) => ({
    receiveSnapshot: (snapshot: ShopSnapshot) => { store.generation.value++; applySnapshot(store, snapshot); },
    load: () => load(store),
    reload: () => load(store, true),
    resetDemo: () => resetDemo(store),
    redeemTreePoints: (optionId: RedemptionOptionId, idempotencyKey?: string) =>
      submit(
        store,
        { type: 'TREE_POINTS', optionId },
        idempotencyKey ?? createIdempotencyKey('points'),
      ),
    donateToCharity: (campaignId = SHOP_CHARITY_CAMPAIGN.id, idempotencyKey?: string) =>
      submit(
        store,
        { type: 'CHARITY', campaignId },
        idempotencyKey ?? createIdempotencyKey('charity'),
      ),
    clearCommandError: () => patchState(store, { commandError: null }),
  })),
  withHooks({
    onInit(store) {
      if (!store.cms) { void store.load(); return; }
      effect(() => {
        store.cms!.identityKey(); store.cms!.walletRevision(); const managed = cmsPublication().managed;
        const demo = store.cms!.scope() === 'demo';
        untracked(() => { store.generation.value++; patchState(store, initialState); if (managed || demo) void store.load(); });
      });
    },
  }),
);

type ShopStateSource = WritableStateSource<ShopState>;

type ShopStoreSource = ShopStateSource & {
  repository: ShopRepository;
  loadStatus: () => ShopState['loadStatus'];
  pointsStatus: () => ShopState['pointsStatus'];
  isSubmitting: () => boolean;
  generation: { value: number };
};

async function load(store: ShopStoreSource, force = false): Promise<void> {
  if (!force && store.loadStatus() === 'loading') {
    return;
  }

  const generation = ++store.generation.value;
  patchState(store, {
    loadStatus: 'loading',
    pointsStatus: 'loading',
    loadError: null,
    pointsError: null,
    commandError: null,
  });

  const [dataResult, pointsResult] = await Promise.allSettled([
    store.repository.loadRedemptionData(),
    store.repository.loadTreePointsBalance(),
  ]);
  if (generation !== store.generation.value) return;

  if (dataResult.status === 'rejected') {
    patchState(store, {
      loadStatus: 'error',
      loadError: 'REDEMPTION_DATA_UNAVAILABLE',
    });
  } else {
    patchState(store, {
      loadStatus: 'loaded',
      loadError: null,
      entitlements: dataResult.value.entitlements,
      lifetimeMatureTrees: dataResult.value.lifetimeMatureTrees,
      transactions: dataResult.value.transactions,
    });
  }

  if (pointsResult.status === 'rejected') {
    patchState(store, {
      pointsStatus: 'error',
      pointsError: 'TREE_POINTS_UNAVAILABLE',
      treePointsBalance: null,
    });
  } else {
    patchState(store, {
      pointsStatus: 'loaded',
      pointsError: null,
      treePointsBalance: pointsResult.value,
    });
  }
}

async function resetDemo(store: ShopStoreSource): Promise<void> {
  if (store.isSubmitting()) {
    return;
  }

  patchState(store, {
    loadStatus: 'loading',
    pointsStatus: 'loading',
    loadError: null,
    pointsError: null,
    commandError: null,
  });

  try {
    const snapshot = await store.repository.resetDemo();
    applySnapshot(store, snapshot);
  } catch {
    patchState(store, {
      loadStatus: 'error',
      pointsStatus: 'error',
      loadError: 'REDEMPTION_DATA_UNAVAILABLE',
      pointsError: 'TREE_POINTS_UNAVAILABLE',
      treePointsBalance: null,
    });
  }
}

async function submit(
  store: ShopStoreSource,
  submission: NonNullable<ShopState['submission']>,
  idempotencyKey: string,
): Promise<ShopCommandResult | null> {
  if (store.isSubmitting()) {
    return null;
  }

  if (submission.type === 'TREE_POINTS' && store.pointsStatus() !== 'loaded') {
    patchState(store, { commandError: 'REQUEST_NOT_SENT' });
    return null;
  }

  const generation = store.generation.value;
  patchState(store, {
    isSubmitting: true,
    submission,
    commandError: null,
  });

  try {
    const result =
      submission.type === 'TREE_POINTS'
        ? await store.repository.redeemTreePoints(submission.optionId, idempotencyKey)
        : await store.repository.donateToCharity(submission.campaignId, idempotencyKey);
    if (generation !== store.generation.value) return null;
    applySnapshot(store, result.snapshot);
    return result;
  } catch (error: unknown) {
    if (generation !== store.generation.value) return null;
    patchState(store, {
      commandError: mapCommandError(error),
    });
    return null;
  } finally {
    if (generation === store.generation.value) patchState(store, {
      isSubmitting: false,
      submission: null,
    });
  }
}

function applySnapshot(store: ShopStateSource, snapshot: ShopSnapshot): void {
  patchState(store, {
    loadStatus: 'loaded',
    pointsStatus: 'loaded',
    loadError: null,
    pointsError: null,
    commandError: null,
    treePointsBalance: snapshot.treePointsBalance,
    entitlements: snapshot.entitlements,
    lifetimeMatureTrees: snapshot.lifetimeMatureTrees,
    transactions: snapshot.transactions,
  });
}

function createExpirySummary(
  entitlements: ShopState['entitlements'],
  now = new Date(),
): ExpirySummary | null {
  const available = entitlements
    .filter((entitlement) => entitlement.status === 'AVAILABLE')
    .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt));

  if (available.length === 0) {
    return null;
  }

  const expiresAt = available[0].expiresAt;
  const count = available.filter((entitlement) => entitlement.expiresAt === expiresAt).length;
  const daysRemaining = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000),
  );

  return {
    count,
    expiresAt,
    daysRemaining,
    urgency:
      daysRemaining <= 7
        ? 'within-7-days'
        : daysRemaining <= 30
          ? 'within-30-days'
          : daysRemaining <= 90
            ? 'within-90-days'
            : 'normal',
  };
}

function createMilestoneProgress(lifetimeMatureTrees: number): MilestoneProgress {
  const completedMilestone = [...SHOP_MILESTONES]
    .reverse()
    .find((milestone) => milestone <= lifetimeMatureTrees) ?? null;
  const nextMilestone = SHOP_MILESTONES.find(
    (milestone) => milestone > lifetimeMatureTrees,
  ) ?? null;

  return {
    lifetimeMatureTrees,
    completedMilestone,
    nextMilestone,
    progressPercent:
      nextMilestone === null
        ? 100
        : Math.round(Math.min(100, (lifetimeMatureTrees / nextMilestone) * 100) * 100) / 100,
  };
}

function createIdempotencyKey(prefix: string): string {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomPart}`;
}

function mapCommandError(error: unknown): ShopCommandError {
  return error instanceof ShopRepositoryError ? error.code : 'REQUEST_NOT_SENT';
}
