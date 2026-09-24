export type RedemptionOptionId =
  | 'TREE_POINTS_10'
  | 'TREE_POINTS_50'
  | 'TREE_POINTS_100'
  | 'TREE_POINTS_200';

export type EntitlementStatus =
  | 'AVAILABLE'
  | 'REDEEMED'
  | 'DONATED'
  | 'EXPIRED';

export type ShopTransactionType =
  | 'TREE_POINTS'
  | 'CHARITY'
  | 'ENTITLEMENT_EXPIRED';

export type ShopTransactionStatus = 'SUCCESS' | 'FAILED' | 'EXPIRED';

export type ShopLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type ShopPointsStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type ShopLoadError = 'REDEMPTION_DATA_UNAVAILABLE';

export type ShopPointsError = 'TREE_POINTS_UNAVAILABLE';

export type ShopCommandError =
  | 'REQUEST_NOT_SENT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'UNKNOWN_OPTION'
  | 'UNKNOWN_CAMPAIGN';

export interface RedemptionOption {
  readonly id: RedemptionOptionId;
  readonly treePoints: number;
  readonly requiredTrees: number;
}

export interface CharityCampaign {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly requiredTrees: number;
  readonly userContributionAmount: number;
  readonly cathayMatchingAmount: number;
  readonly totalAmount: number;
  readonly isDemo: true;
}

export interface TreeEntitlement {
  readonly id: string;
  readonly sourceTreeId: string;
  readonly claimedAt: string;
  readonly expiresAt: string;
  readonly status: EntitlementStatus;
  readonly usedAt: string | null;
  readonly transactionId: string | null;
  readonly isDemo: true;
}

export interface ShopTransaction {
  readonly id: string;
  readonly transactionNumber: string | null;
  readonly type: ShopTransactionType;
  readonly status: ShopTransactionStatus;
  readonly requestedTreeCount: number;
  readonly usedTreeCount: number;
  readonly treePointsAmount: number | null;
  readonly charityCampaignId: string | null;
  readonly charityCampaignName: string | null;
  readonly userContributionAmount: number | null;
  readonly cathayMatchingAmount: number | null;
  readonly charityTotalAmount: number | null;
  readonly occurredAt: string;
  readonly isDemo: true;
}

export interface ShopRedemptionData {
  readonly entitlements: readonly TreeEntitlement[];
  readonly lifetimeMatureTrees: number;
  readonly transactions: readonly ShopTransaction[];
}

export interface ShopSnapshot extends ShopRedemptionData {
  readonly treePointsBalance: number;
}

export interface ShopCommandResult {
  readonly idempotencyKey: string;
  readonly success: boolean;
  readonly transaction: ShopTransaction;
  readonly snapshot: ShopSnapshot;
}

export interface RedemptionOptionView extends RedemptionOption {
  readonly canRedeem: boolean;
  readonly missingTrees: number;
}

export interface CharityCampaignView extends CharityCampaign {
  readonly canDonate: boolean;
  readonly missingTrees: number;
}

export interface ExpirySummary {
  readonly count: number;
  readonly expiresAt: string;
  readonly daysRemaining: number;
  readonly urgency: 'normal' | 'within-90-days' | 'within-30-days' | 'within-7-days';
}

export interface MilestoneProgress {
  readonly lifetimeMatureTrees: number;
  readonly completedMilestone: number | null;
  readonly nextMilestone: number | null;
  readonly progressPercent: number;
}

export type ShopSubmission =
  | { readonly type: 'TREE_POINTS'; readonly optionId: RedemptionOptionId }
  | { readonly type: 'CHARITY'; readonly campaignId: string };

export interface ShopState {
  readonly loadStatus: ShopLoadStatus;
  readonly pointsStatus: ShopPointsStatus;
  readonly loadError: ShopLoadError | null;
  readonly pointsError: ShopPointsError | null;
  readonly commandError: ShopCommandError | null;
  readonly treePointsBalance: number | null;
  readonly entitlements: readonly TreeEntitlement[];
  readonly lifetimeMatureTrees: number;
  readonly transactions: readonly ShopTransaction[];
  readonly isSubmitting: boolean;
  readonly submission: ShopSubmission | null;
}
