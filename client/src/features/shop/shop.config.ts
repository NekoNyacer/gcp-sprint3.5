import {
  CharityCampaign,
  RedemptionOption,
  ShopSnapshot,
  ShopTransaction,
  TreeEntitlement,
} from './shop.models';

export const SHOP_REDEMPTION_OPTIONS: readonly RedemptionOption[] = [
  { id: 'TREE_POINTS_10', treePoints: 10, requiredTrees: 1 },
  { id: 'TREE_POINTS_50', treePoints: 50, requiredTrees: 5 },
  { id: 'TREE_POINTS_100', treePoints: 100, requiredTrees: 9 },
  { id: 'TREE_POINTS_200', treePoints: 200, requiredTrees: 16 },
] as const;

export const SHOP_CHARITY_CAMPAIGN: CharityCampaign = {
  id: 'CHARITY_2026_Q4',
  name: '台灣動植物保育計畫',
  description: '支持台灣原生動植物、棲地復育與生態保育行動。',
  requiredTrees: 5,
  userContributionAmount: 50,
  cathayMatchingAmount: 50,
  totalAmount: 100,
  isDemo: true,
} as const;

export const SHOP_MILESTONES: readonly number[] = [10, 50, 100, 200, 500, 1_000] as const;

const DEMO_ENTITLEMENTS: readonly TreeEntitlement[] = [
  ...createEntitlements('2027-03-31T15:59:59.999Z', 2, 1),
  ...createEntitlements('2027-08-31T15:59:59.999Z', 5, 3),
];

const DEMO_TRANSACTIONS: readonly ShopTransaction[] = [
  {
    id: 'demo-transaction-003',
    transactionNumber: 'TP202609140003',
    type: 'TREE_POINTS',
    status: 'FAILED',
    requestedTreeCount: 5,
    usedTreeCount: 0,
    treePointsAmount: 50,
    charityCampaignId: null,
    charityCampaignName: null,
    userContributionAmount: null,
    cathayMatchingAmount: null,
    charityTotalAmount: null,
    occurredAt: '2026-09-14T02:31:00.000Z',
    isDemo: true,
  },
  {
    id: 'demo-transaction-002',
    transactionNumber: 'ESG202609100002',
    type: 'CHARITY',
    status: 'SUCCESS',
    requestedTreeCount: 5,
    usedTreeCount: 5,
    treePointsAmount: null,
    charityCampaignId: SHOP_CHARITY_CAMPAIGN.id,
    charityCampaignName: SHOP_CHARITY_CAMPAIGN.name,
    userContributionAmount: SHOP_CHARITY_CAMPAIGN.userContributionAmount,
    cathayMatchingAmount: SHOP_CHARITY_CAMPAIGN.cathayMatchingAmount,
    charityTotalAmount: SHOP_CHARITY_CAMPAIGN.totalAmount,
    occurredAt: '2026-09-10T08:05:00.000Z',
    isDemo: true,
  },
  {
    id: 'demo-transaction-001',
    transactionNumber: 'TP202608260001',
    type: 'TREE_POINTS',
    status: 'SUCCESS',
    requestedTreeCount: 1,
    usedTreeCount: 1,
    treePointsAmount: 10,
    charityCampaignId: null,
    charityCampaignName: null,
    userContributionAmount: null,
    cathayMatchingAmount: null,
    charityTotalAmount: null,
    occurredAt: '2026-08-26T10:47:00.000Z',
    isDemo: true,
  },
];

export const SHOP_DEMO_SEED: ShopSnapshot = {
  treePointsBalance: 2_680,
  entitlements: DEMO_ENTITLEMENTS,
  lifetimeMatureTrees: 56,
  transactions: DEMO_TRANSACTIONS,
};

function createEntitlements(
  expiresAt: string,
  count: number,
  startIndex: number,
): TreeEntitlement[] {
  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset;

    return {
      id: `demo-entitlement-${index.toString().padStart(3, '0')}`,
      sourceTreeId: `demo-tree-${index.toString().padStart(3, '0')}`,
      claimedAt: index <= 2 ? '2026-04-01T01:00:00.000Z' : '2026-09-01T01:00:00.000Z',
      expiresAt,
      status: 'AVAILABLE',
      usedAt: null,
      transactionId: null,
      isDemo: true,
    } as const;
  });
}
