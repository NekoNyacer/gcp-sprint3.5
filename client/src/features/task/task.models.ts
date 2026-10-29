export type TaskCadence = 'daily' | 'weekly' | 'event';
export type TaskStatus = 'available' | 'active' | 'ready' | 'completed' | 'expired';
export type TaskRewardType = 'waterDrops' | 'fertilizer' | 'seeds';
export type DemoLocationState = 'not-arrived' | 'poor-accuracy' | 'eligible';

export interface TaskDestination {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface TaskItem {
  taskId: string;
  cmsVersion?: number;
  areaId: string;
  cadence: TaskCadence;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  destination: TaskDestination;
  reward: { type: TaskRewardType; amount: number };
  status: TaskStatus;
  joinedAt?: Date;
  joinedBaseline?: number;
  readyAt?: Date;
  requiredSteps?: number;
  radiusMeters?: number;
  completedAt?: Date;
  calculatedDistanceMeters?: number;
}

export interface TaskArea {
  areaId: string;
  name: string;
}

export interface LocationEvidence {
  latitude: number;
  longitude: number;
  accuracy: number;
  observedAt: Date;
}

export interface TaskCompletionResult {
  taskId: string;
  completedAt: Date;
  reward: { type: TaskRewardType; amount: number };
  inventory: { waterDrops: number; fertilizer: number; seeds?: number };
  mysterySeeds?: import('../../../../functions/src/planting-catalog').MysterySeed[];
  progressRevision?: number;
}

export const taskRewardLabel = (task: Pick<TaskItem, 'reward'>): string =>
  `${({ waterDrops: '水滴', fertilizer: '肥料', seeds: '種子' })[task.reward.type]} +${task.reward.amount}`;

export const TASK_AREAS: readonly TaskArea[] = [
  { areaId: 'banqiao', name: '板橋' },
  { areaId: 'xihu', name: '西湖' },
] as const;

