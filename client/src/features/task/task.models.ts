export type TaskCadence = 'daily' | 'weekly' | 'event';
export type TaskStatus = 'available' | 'active' | 'completed' | 'expired';
export type TaskRewardType = 'waterDrops' | 'fertilizer';
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
  inventory: { waterDrops: number; fertilizer: number };
}

export const TASK_AREAS: readonly TaskArea[] = [
  { areaId: 'banqiao', name: '板橋' },
  { areaId: 'xihu', name: '西湖' },
] as const;

