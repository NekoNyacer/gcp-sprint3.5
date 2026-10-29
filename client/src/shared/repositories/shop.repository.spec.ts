import { SHOP_CHARITY_CAMPAIGN, SHOP_DEMO_SEED } from '../../features/shop/shop.config';
import { ShopRepository, ShopRepositoryError } from './shop.repository';

describe('ShopRepository', () => {
  let repository: ShopRepository;

  beforeEach(() => {
    repository = new ShopRepository();
  });

  it('loads the seeded demo balance, entitlements, and lifetime progress', async () => {
    const data = await repository.loadRedemptionData();
    const balance = await repository.loadTreePointsBalance();

    expect(balance).toBe(2_680);
    expect(data.entitlements.filter((item) => item.status === 'AVAILABLE')).toHaveLength(7);
    expect(data.lifetimeMatureTrees).toBe(56);
  });

  it('redeems tree points with the earliest-expiring entitlement first', async () => {
    const result = await repository.redeemTreePoints('TREE_POINTS_10', 'points-fefo');

    expect(result.success).toBe(true);
    expect(result.snapshot.treePointsBalance).toBe(2_690);
    expect(result.snapshot.entitlements.find((item) => item.id === 'demo-entitlement-001'))
      .toMatchObject({
        status: 'REDEEMED',
        transactionId: result.transaction.id,
      });
    expect(result.snapshot.entitlements.find((item) => item.id === 'demo-entitlement-003')?.status)
      .toBe('AVAILABLE');
  });

  it('uses five entitlements for charity without changing the points balance', async () => {
    const result = await repository.donateToCharity(
      SHOP_CHARITY_CAMPAIGN.id,
      'charity-success',
    );

    expect(result.success).toBe(true);
    expect(result.snapshot.treePointsBalance).toBe(2_680);
    expect(result.snapshot.entitlements.filter((item) => item.status === 'DONATED')).toHaveLength(5);
    expect(result.transaction).toMatchObject({
      status: 'SUCCESS',
      usedTreeCount: 5,
      charityTotalAmount: 100,
    });
  });

  it('records an accepted failure without deducting entitlements or points', async () => {
    await repository.redeemTreePoints('TREE_POINTS_50', 'first-success');
    const result = await repository.redeemTreePoints('TREE_POINTS_100', 'insufficient');

    expect(result.success).toBe(false);
    expect(result.snapshot.treePointsBalance).toBe(2_730);
    expect(result.snapshot.entitlements.filter((item) => item.status === 'AVAILABLE')).toHaveLength(2);
    expect(result.transaction).toMatchObject({
      status: 'FAILED',
      requestedTreeCount: 9,
      usedTreeCount: 0,
    });
  });

  it('returns the cached result for an idempotent retry', async () => {
    const first = await repository.redeemTreePoints('TREE_POINTS_50', 'same-command');
    const retry = await repository.redeemTreePoints('TREE_POINTS_50', 'same-command');
    const data = await repository.loadRedemptionData();

    expect(retry).toEqual(first);
    expect(await repository.loadTreePointsBalance()).toBe(2_730);
    expect(data.entitlements.filter((item) => item.status === 'AVAILABLE')).toHaveLength(2);
    expect(data.transactions.filter((item) => item.id === first.transaction.id)).toHaveLength(1);
  });

  it('rejects reuse of an idempotency key for a different command', async () => {
    await repository.redeemTreePoints('TREE_POINTS_10', 'reused-key');

    await expect(
      repository.donateToCharity(SHOP_CHARITY_CAMPAIGN.id, 'reused-key'),
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    } satisfies Partial<ShopRepositoryError>);
  });

  it('resets every mutable demo value and command cache', async () => {
    await repository.redeemTreePoints('TREE_POINTS_50', 'before-reset');
    const reset = await repository.resetDemo();
    const replayAfterReset = await repository.redeemTreePoints('TREE_POINTS_50', 'before-reset');

    expect(reset).toEqual(SHOP_DEMO_SEED);
    expect(replayAfterReset.success).toBe(true);
    expect(replayAfterReset.snapshot.treePointsBalance).toBe(2_730);
  });
});
