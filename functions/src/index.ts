import { initializeApp } from 'firebase-admin/app';
initializeApp();

export { initializeWalkProgress, saveWalkProgress } from './walk-progress.js';
export { completeTask } from './task-completion.js';
export { cmsCommand, cmsTrack, cmsDashboard, cmsWallet, cmsRedeem, cmsHarvest, cmsResetDemo, cmsRecommend, cmsCleanup, cmsValidateStation } from './cms.js';
