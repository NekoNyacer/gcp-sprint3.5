import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { provisionStarterSeed } from './starter-seed.js';

const resourceKeys = ['lightEnergy', 'waterDrops', 'fertilizer', 'seeds'] as const;
const validCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export const initializeWalkProgress = onCall({ region: 'asia-east1', enforceAppCheck: false, invoker: 'public' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '必須先登入');
  await provisionStarterSeed(getFirestore(), request.auth.uid);
  return { ready: true };
});

export const saveWalkProgress = onCall({ region: 'asia-east1', enforceAppCheck: false, invoker: 'public' }, async (request) => {
  if (!request.auth || request.data?.uid !== request.auth.uid) {
    throw new HttpsError('unauthenticated', '必須以自己的身分儲存');
  }
  const { state, revision, previousInventory } = request.data;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (!state || !validCount(revision) || !validCount(state.todaySteps) ||
      !validCount(state.lightEarnedToday) || !validCount(state.totalRecordedSteps) ||
      !validCount(state.totalRecordedLightEnergy) || !validCount(state.demoTreePoints) ||
      typeof state.todayStepsDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(state.todayStepsDay) ||
      state.todayStepsDay > day || !state.demoTrees || typeof state.demoTrees !== 'object' ||
      !state.demoSupplyStationClaimedOn || typeof state.demoSupplyStationClaimedOn !== 'object' ||
      resourceKeys.some((key) => !validCount(state.inventory?.[key]) || !validCount(previousInventory?.[key])) ||
      JSON.stringify(state).length > 200_000) {
    throw new HttpsError('invalid-argument', '散步紀錄格式錯誤');
  }
  const db = getFirestore();
  const uid = request.auth.uid;
  await provisionStarterSeed(db, uid);
  const progressRef = db.doc(`users/${uid}/progress/current`);
  const inventoryRef = db.doc(`users/${uid}/inventory/current`);
  await db.runTransaction(async (tx) => {
    const [progress, inventory] = await Promise.all([tx.get(progressRef), tx.get(inventoryRef)]);
    if ((progress.data()?.revision ?? 0) !== revision) {
      throw new HttpsError('aborted', '資料已在其他裝置更新，請重新載入。');
    }
    const balances: Record<string, number> = {};
    for (const key of resourceKeys) {
      balances[key] = Number(inventory.data()?.[key] ?? 0) + state.inventory[key] - previousInventory[key];
      if (!validCount(balances[key])) throw new HttpsError('failed-precondition', '資源餘額已變更，請重新載入。');
    }
    const updatedAt = FieldValue.serverTimestamp();
    tx.set(progressRef, { state: { ...state, inventory: balances }, revision: revision + 1, updatedAt });
    tx.set(inventoryRef, { ...balances, updatedAt }, { merge: true });
    tx.set(db.doc(`users/${uid}/dailyProgress/${state.todayStepsDay}`), {
      day: state.todayStepsDay, steps: state.todaySteps, lightEnergy: state.lightEarnedToday, updatedAt,
    });
  });
  return { revision: revision + 1 };
});
