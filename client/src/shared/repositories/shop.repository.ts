import { Injectable } from '@angular/core';
import {
  SHOP_CHARITY_CAMPAIGN,
  SHOP_DEMO_SEED,
  SHOP_REDEMPTION_OPTIONS,
} from '../../features/shop/shop.config';
import {
  RedemptionOptionId,
  ShopCommandError,
  ShopCommandResult,
  ShopRedemptionData,
  ShopSnapshot,
  ShopTransaction,
  TreeEntitlement,
} from '../../features/shop/shop.models';

interface CachedCommand {
  readonly signature: string;
  readonly result: ShopCommandResult;
}

export class ShopRepositoryError extends Error {
  constructor(readonly code: ShopCommandError) {
    super(code);
    this.name = 'ShopRepositoryError';
  }
}

/**
 * 兌換的 Seeded Demo Repository。
 *
 * 此實作刻意不連線 Firebase；未來接上 callable function 時，只要維持相同公開合約，
 * Store 與畫面層不需要理解 Firestore 或 GCP 細節。
 */
@Injectable({ providedIn: 'root' })
export class ShopRepository {
  private snapshot = cloneSnapshot(SHOP_DEMO_SEED);
  private readonly commandResults = new Map<string, CachedCommand>();
  private transactionSequence = this.snapshot.transactions.length;

  async loadRedemptionData(): Promise<ShopRedemptionData> {
    return cloneRedemptionData(this.snapshot);
  }

  async loadTreePointsBalance(): Promise<number> {
    return this.snapshot.treePointsBalance;
  }

  async redeemTreePoints(
    optionId: RedemptionOptionId,
    idempotencyKey: string,
  ): Promise<ShopCommandResult> {
    const option = SHOP_REDEMPTION_OPTIONS.find((candidate) => candidate.id === optionId);

    if (!option) {
      throw new ShopRepositoryError('UNKNOWN_OPTION');
    }

    return this.executeCommand(
      `TREE_POINTS:${option.id}`,
      idempotencyKey,
      'TREE_POINTS',
      option.requiredTrees,
      () => ({
        treePointsAmount: option.treePoints,
        charityCampaignId: null,
        charityCampaignName: null,
        userContributionAmount: null,
        cathayMatchingAmount: null,
        charityTotalAmount: null,
      }),
    );
  }

  async donateToCharity(
    campaignId: string,
    idempotencyKey: string,
  ): Promise<ShopCommandResult> {
    if (campaignId !== SHOP_CHARITY_CAMPAIGN.id) {
      throw new ShopRepositoryError('UNKNOWN_CAMPAIGN');
    }

    return this.executeCommand(
      `CHARITY:${campaignId}`,
      idempotencyKey,
      'CHARITY',
      SHOP_CHARITY_CAMPAIGN.requiredTrees,
      () => ({
        treePointsAmount: null,
        charityCampaignId: campaignId,
        charityCampaignName: SHOP_CHARITY_CAMPAIGN.name,
        userContributionAmount: SHOP_CHARITY_CAMPAIGN.userContributionAmount,
        cathayMatchingAmount: SHOP_CHARITY_CAMPAIGN.cathayMatchingAmount,
        charityTotalAmount: SHOP_CHARITY_CAMPAIGN.totalAmount,
      }),
    );
  }

  async resetDemo(): Promise<ShopSnapshot> {
    this.snapshot = cloneSnapshot(SHOP_DEMO_SEED);
    this.commandResults.clear();
    this.transactionSequence = this.snapshot.transactions.length;
    return cloneSnapshot(this.snapshot);
  }

  private executeCommand(
    signature: string,
    idempotencyKey: string,
    type: 'TREE_POINTS' | 'CHARITY',
    requiredTrees: number,
    createAmounts: () => Pick<
      ShopTransaction,
      | 'treePointsAmount'
      | 'charityCampaignId'
      | 'charityCampaignName'
      | 'userContributionAmount'
      | 'cathayMatchingAmount'
      | 'charityTotalAmount'
    >,
  ): ShopCommandResult {
    const cached = this.commandResults.get(idempotencyKey);
    if (cached) {
      if (cached.signature !== signature) {
        throw new ShopRepositoryError('IDEMPOTENCY_CONFLICT');
      }

      return cloneCommandResult(cached.result);
    }

    const now = new Date().toISOString();
    const available = this.snapshot.entitlements
      .filter((entitlement) => entitlement.status === 'AVAILABLE')
      .sort(compareEntitlementExpiry);
    const success = available.length >= requiredTrees;
    const transaction = this.createTransaction(
      type,
      success,
      requiredTrees,
      createAmounts(),
      now,
    );

    let entitlements = this.snapshot.entitlements;
    let treePointsBalance = this.snapshot.treePointsBalance;

    if (success) {
      const selectedIds = new Set(
        available.slice(0, requiredTrees).map((entitlement) => entitlement.id),
      );
      entitlements = entitlements.map((entitlement) =>
        selectedIds.has(entitlement.id)
          ? {
              ...entitlement,
              status: type === 'TREE_POINTS' ? 'REDEEMED' : 'DONATED',
              usedAt: now,
              transactionId: transaction.id,
            }
          : entitlement,
      );

      if (type === 'TREE_POINTS') {
        treePointsBalance += transaction.treePointsAmount ?? 0;
      }
    }

    this.snapshot = {
      ...this.snapshot,
      treePointsBalance,
      entitlements,
      transactions: sortTransactions([transaction, ...this.snapshot.transactions]),
    };

    const result: ShopCommandResult = {
      idempotencyKey,
      success,
      transaction,
      snapshot: cloneSnapshot(this.snapshot),
    };
    this.commandResults.set(idempotencyKey, {
      signature,
      result: cloneCommandResult(result),
    });

    return cloneCommandResult(result);
  }

  private createTransaction(
    type: 'TREE_POINTS' | 'CHARITY',
    success: boolean,
    requiredTrees: number,
    amounts: Pick<
      ShopTransaction,
      | 'treePointsAmount'
      | 'charityCampaignId'
      | 'charityCampaignName'
      | 'userContributionAmount'
      | 'cathayMatchingAmount'
      | 'charityTotalAmount'
    >,
    occurredAt: string,
  ): ShopTransaction {
    this.transactionSequence += 1;
    const sequence = this.transactionSequence.toString().padStart(4, '0');
    const date = occurredAt.slice(0, 10).replaceAll('-', '');
    const prefix = type === 'TREE_POINTS' ? 'TP' : 'ESG';

    return {
      id: `demo-transaction-${sequence}`,
      transactionNumber: `${prefix}${date}${sequence}`,
      type,
      status: success ? 'SUCCESS' : 'FAILED',
      requestedTreeCount: requiredTrees,
      usedTreeCount: success ? requiredTrees : 0,
      ...amounts,
      occurredAt,
      isDemo: true,
    };
  }
}

function compareEntitlementExpiry(left: TreeEntitlement, right: TreeEntitlement): number {
  const byDate = left.expiresAt.localeCompare(right.expiresAt);
  return byDate === 0 ? left.id.localeCompare(right.id) : byDate;
}

function sortTransactions(transactions: readonly ShopTransaction[]): ShopTransaction[] {
  return [...transactions].sort((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt),
  );
}

function cloneRedemptionData(snapshot: ShopSnapshot): ShopRedemptionData {
  return {
    entitlements: snapshot.entitlements.map((entitlement) => ({ ...entitlement })),
    lifetimeMatureTrees: snapshot.lifetimeMatureTrees,
    transactions: snapshot.transactions.map((transaction) => ({ ...transaction })),
  };
}

function cloneSnapshot(snapshot: ShopSnapshot): ShopSnapshot {
  return {
    ...cloneRedemptionData(snapshot),
    treePointsBalance: snapshot.treePointsBalance,
  };
}

function cloneCommandResult(result: ShopCommandResult): ShopCommandResult {
  return {
    ...result,
    transaction: { ...result.transaction },
    snapshot: cloneSnapshot(result.snapshot),
  };
}
