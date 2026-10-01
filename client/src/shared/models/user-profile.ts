import { Timestamp } from '@angular/fire/firestore';

export type OnboardingStatus = 'required' | 'completed';

export type UserProfile = {
  displayName: string;
  photoUrl: string;
  dailyGoal: number;
  onboardingStatus: OnboardingStatus;
  isDemo: false;
  treePoints: number;
  totalMatureTrees: number;
  updatedAt: Timestamp;
};

export type SaveUserProfile = Pick<
  UserProfile,
  'displayName' | 'photoUrl' | 'dailyGoal' | 'onboardingStatus'
>;
