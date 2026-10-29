import { TestBed } from '@angular/core/testing';
import { SHOP_CHARITY_CAMPAIGN } from './shop.config';
import { ShopStore } from './shop-store';
import { ShopRepository } from '../../shared/repositories/shop.repository';
import { ShopCommandResult } from './shop.models';

describe('ShopStore', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the demo summary and derives card, expiry, milestone, and recent-history views', async () => {
    const store = configureStore(new ShopRepository());
    await waitForLoaded(store);

    expect(store.treePointsBalance()).toBe(2_680);
    expect(store.availableMatureTrees()).toBe(7);
    expect(store.expirySummary()).toMatchObject({
      count: 2,
      expiresAt: '2027-03-31T15:59:59.999Z',
    });
    expect(store.redemptionOptions().map((option) => [option.id, option.missingTrees])).toEqual([
      ['TREE_POINTS_10', 0],
      ['TREE_POINTS_50', 0],
      ['TREE_POINTS_100', 2],
      ['TREE_POINTS_200', 9],
    ]);
    expect(store.charityCampaign()).toMatchObject({ canDonate: true, missingTrees: 0 });
    expect(store.milestoneProgress()).toMatchObject({
      lifetimeMatureTrees: 56,
      completedMilestone: 50,
      nextMilestone: 100,
      progressPercent: 56,
    });
    expect(store.recentTransactions()).toHaveLength(3);
  });

  it('updates balance, availability, and recent history after point redemption', async () => {
    const store = configureStore(new ShopRepository());
    await waitForLoaded(store);

    const result = await store.redeemTreePoints('TREE_POINTS_50', 'store-points');

    expect(result?.success).toBe(true);
    expect(store.treePointsBalance()).toBe(2_730);
    expect(store.availableMatureTrees()).toBe(2);
    expect(store.recentTransactions()[0]).toMatchObject({
      type: 'TREE_POINTS',
      status: 'SUCCESS',
    });
  });

  it('updates eligibility and history, but not balance, after charity donation', async () => {
    const store = configureStore(new ShopRepository());
    await waitForLoaded(store);

    const result = await store.donateToCharity(
      SHOP_CHARITY_CAMPAIGN.id,
      'store-charity',
    );

    expect(result?.success).toBe(true);
    expect(store.treePointsBalance()).toBe(2_680);
    expect(store.availableMatureTrees()).toBe(2);
    expect(store.recentTransactions()[0]).toMatchObject({
      type: 'CHARITY',
      status: 'SUCCESS',
    });
  });

  it('prevents a second submission while the first command is in flight', async () => {
    const repository = new DelayedShopRepository();
    const store = configureStore(repository);
    await waitForLoaded(store);

    const first = store.redeemTreePoints('TREE_POINTS_10', 'first-in-flight');
    expect(store.isSubmitting()).toBe(true);

    const duplicate = await store.redeemTreePoints('TREE_POINTS_10', 'second-in-flight');
    expect(duplicate).toBeNull();
    expect(repository.redeemCalls).toBe(1);

    repository.release();
    await first;
    expect(store.isSubmitting()).toBe(false);
  });

  it('keeps charity available when the points balance fails to load', async () => {
    const store = configureStore(new PointsFailingShopRepository());

    await vi.waitFor(() => {
      expect(store.loadStatus()).toBe('loaded');
      expect(store.pointsStatus()).toBe('error');
    });

    expect(store.treePointsBalance()).toBeNull();
    expect(store.pointsError()).toBe('TREE_POINTS_UNAVAILABLE');
    expect(store.canRedeemTreePoints()).toBe(false);
    expect(store.canDonateToCharity()).toBe(true);

    const result = await store.donateToCharity(
      SHOP_CHARITY_CAMPAIGN.id,
      'charity-with-points-error',
    );
    expect(result?.success).toBe(true);
  });

  it('exposes a full-page error when redemption data cannot load', async () => {
    const store = configureStore(new DataFailingShopRepository());

    await vi.waitFor(() => expect(store.loadStatus()).toBe('error'));

    expect(store.loadError()).toBe('REDEMPTION_DATA_UNAVAILABLE');
  });

  it('restores the original demo state through reset', async () => {
    const store = configureStore(new ShopRepository());
    await waitForLoaded(store);
    await store.redeemTreePoints('TREE_POINTS_50', 'before-store-reset');

    await store.resetDemo();

    expect(store.treePointsBalance()).toBe(2_680);
    expect(store.availableMatureTrees()).toBe(7);
    expect(store.lifetimeMatureTrees()).toBe(56);
  });
});

function configureStore(repository: ShopRepository): InstanceType<typeof ShopStore> {
  TestBed.configureTestingModule({
    providers: [ShopStore, { provide: ShopRepository, useValue: repository }],
  });
  return TestBed.inject(ShopStore);
}

async function waitForLoaded(store: InstanceType<typeof ShopStore>): Promise<void> {
  await vi.waitFor(() => {
    expect(store.loadStatus()).toBe('loaded');
    expect(store.pointsStatus()).toBe('loaded');
  });
}

class PointsFailingShopRepository extends ShopRepository {
  override async loadTreePointsBalance(): Promise<number> {
    throw new Error('points unavailable');
  }
}

class DataFailingShopRepository extends ShopRepository {
  override async loadRedemptionData(): Promise<never> {
    throw new Error('data unavailable');
  }
}

class DelayedShopRepository extends ShopRepository {
  redeemCalls = 0;
  private releaseCommand!: () => void;
  private readonly gate = new Promise<void>((resolve) => {
    this.releaseCommand = resolve;
  });

  override async redeemTreePoints(
    optionId: Parameters<ShopRepository['redeemTreePoints']>[0],
    idempotencyKey: string,
  ): Promise<ShopCommandResult> {
    this.redeemCalls += 1;
    await this.gate;
    return super.redeemTreePoints(optionId, idempotencyKey);
  }

  release(): void {
    this.releaseCommand();
  }
}
