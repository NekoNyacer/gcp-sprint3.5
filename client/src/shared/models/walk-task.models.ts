import type { SceneEnvironment } from './tree-scene-environment';
import { GeoPoint } from './geo.models';

export type SupplyReward = { resource: 'water' | 'fertilizer'; amount: number };

export type WalkRoutePoint = {
  id: string;
  position: GeoPoint;
  routeStop: { position: GeoPoint; segmentIndex: number; fraction: number };
};

export function supplyRewardLabel(reward: SupplyReward): string {
  return `+${reward.amount}${reward.resource === 'water' ? '水' : '肥料'}`;
}

export function supplyRewardsLabel(rewards: readonly SupplyReward[]): string {
  const water = rewards
    .filter((reward) => reward.resource === 'water')
    .reduce((total, reward) => total + reward.amount, 0);
  const fertilizer = rewards
    .filter((reward) => reward.resource === 'fertilizer')
    .reduce((total, reward) => total + reward.amount, 0);
  return (
    [
      ...(water > 0 ? [supplyRewardLabel({ resource: 'water', amount: water })] : []),
      ...(fertilizer > 0
        ? [supplyRewardLabel({ resource: 'fertilizer', amount: fertilizer })]
        : []),
    ].join(' · ') || '無額外補給'
  );
}

export type SupplyStationInfo = {
  category: '美食' | '購物';
  isCathayTwqrMerchant: boolean;
  offer: string;
  terms: string;
  supply: SupplyReward;
  validUntil: string;
};

export type WalkTaskPoint = WalkRoutePoint &
  Partial<SceneEnvironment> & {
    name: string;
    kind: 'water' | 'fertilizer';
    description: string;
    supplyStation: SupplyStationInfo;
    isDemo: true;
    estimatedExtraSteps: number;
  };

export type DemoSupplyStation = SupplyStationInfo &
  Partial<SceneEnvironment> &
  Pick<WalkTaskPoint, 'id' | 'name' | 'kind' | 'estimatedExtraSteps'> & {
    routeFraction: number;
  };

export const METERS_PER_WALK_STEP = 0.75;

export type RoutedWalkTaskPoint = WalkTaskPoint & {
  routeGeometry: readonly GeoPoint[];
  routeDistanceMeters: number;
};
