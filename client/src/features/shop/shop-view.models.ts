import {
  CharityCampaignView,
  RedemptionOptionView,
  ShopTransaction,
} from './shop.models';

export type RedemptionOption = RedemptionOptionView;
export type CharityCampaign = CharityCampaignView;
export type RedemptionTransaction = ShopTransaction;

export function transactionTitle(transaction: RedemptionTransaction): string {
  switch (transaction.type) {
    case 'PRODUCT':
      return transaction.productName ?? '商品兌換';
    case 'HARVEST':
      return '小樹收成';
    case 'TREE_POINTS':
      return '小樹點兌換';
    case 'CHARITY':
      return '生態公益投入';
    case 'ENTITLEMENT_EXPIRED':
      return '大樹兌換資格到期';
  }
}

export function transactionStatusLabel(transaction: RedemptionTransaction): string {
  if (transaction.type === 'ENTITLEMENT_EXPIRED' || transaction.status === 'EXPIRED') {
    return '已超過使用期限';
  }

  if (transaction.status === 'FAILED') {
    return transaction.type === 'CHARITY' ? '投入失敗' : '兌換失敗';
  }

  return transaction.type === 'CHARITY' ? '投入成功' : '兌換成功';
}

export function transactionSummary(transaction: RedemptionTransaction): string {
  if (transaction.type === 'HARVEST') return `獲得 ${transaction.treePointsAmount ?? 0} 小樹點`;
  if (transaction.type === 'PRODUCT' || (transaction.treePointsAmount ?? 0) < 0) {
    return `使用 ${Math.abs(transaction.treePointsAmount ?? 0)} 小樹點${transaction.productName ? '・' + transaction.productName : ''}`;
  }
  if (transaction.type === 'TREE_POINTS') {
    const prefix = transaction.status === 'FAILED' ? '預計獲得' : '獲得';
    return `${prefix}${transaction.treePointsAmount ?? 0}點・${treeUsageText(transaction)}`;
  }

  if (transaction.type === 'CHARITY') {
    const prefix = transaction.status === 'FAILED' ? '預計投入' : '公益投入';
    return `${prefix}NT$${transaction.charityTotalAmount ?? 0}・${treeUsageText(transaction)}`;
  }

  return `${transaction.requestedTreeCount}棵・未使用`;
}

function treeUsageText(transaction: RedemptionTransaction): string {
  const isFailed = transaction.status === 'FAILED';
  const verb = isFailed ? '預計使用' : '使用';
  const count = isFailed ? transaction.requestedTreeCount : transaction.usedTreeCount;
  return `${verb}${count}棵`;
}
