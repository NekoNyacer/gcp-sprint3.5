import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();

export { initializeWalkProgress, saveWalkProgress } from './walk-progress.js';
export { cmsCommand, cmsTrack, cmsDashboard, cmsWallet, cmsRedeem, cmsHarvest, cmsResetDemo, cmsRecommend, cmsCleanup, cmsValidateStation } from './cms.js';

type CompleteTaskInput = {
  taskId?: unknown;
  idempotencyKey?: unknown;
  isDemo?: unknown;
  expectedVersion?: unknown;
  location?: { latitude?: unknown; longitude?: unknown; accuracy?: unknown; observedAt?: unknown };
};

export const completeTask = onCall({ region: 'asia-east1', enforceAppCheck: false }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '必須先登入');
  const input = validateInput(request.data as CompleteTaskInput);
  if (input.isDemo) throw new HttpsError('failed-precondition', 'Demo 任務不得寫入正常資料');

  const db = getFirestore();
  const uid = request.auth.uid;
  const taskRef = db.doc(`tasks/${input.taskId}`);
  const enrollmentRef = db.doc(`users/${uid}/taskEnrollments/${input.taskId}`);
  const completionRef = db.doc(`users/${uid}/taskCompletions/${input.taskId}`);
  const inventoryRef = db.doc(`users/${uid}/inventory/current`);
  const commandRef = db.doc(`users/${uid}/commands/${input.idempotencyKey}`);
  const ledgerRef = db.doc(`users/${uid}/ledger/${input.idempotencyKey}`);

  return db.runTransaction(async (transaction) => {
    const priorCommand = await transaction.get(commandRef);
    if (priorCommand.exists) return priorCommand.data()?.['result'];

    const [taskSnapshot, completionSnapshot, inventorySnapshot] = await Promise.all([
      transaction.get(taskRef), transaction.get(completionRef), transaction.get(inventoryRef),
    ]);
    if (!taskSnapshot.exists) throw new HttpsError('not-found', '找不到任務');
    if (completionSnapshot.exists) throw new HttpsError('already-exists', '任務已完成');

    const task = taskSnapshot.data()!;
    if (task['enabled'] === false) throw new HttpsError('failed-precondition', '任務已停用或下架');
    if (task['cmsVersion'] !== undefined && task['cmsVersion'] !== input.expectedVersion)
      throw new HttpsError('failed-precondition', '任務設定已更新，請重新查看任務內容後確認');
    const now = Timestamp.now();
    if (task['startsAt'].toMillis() > now.toMillis() || task['endsAt'].toMillis() <= now.toMillis()) throw new HttpsError('failed-precondition', '任務尚未開始或已過期');
    if (task['cadence'] === 'event' && !(await transaction.get(enrollmentRef)).exists) throw new HttpsError('failed-precondition', '請先參加活動');
    if (input.location.accuracy > 10) throw new HttpsError('failed-precondition', '定位精確度不足');

    const distance = distanceMeters(input.location, task['destination']);
    if (distance > 10) throw new HttpsError('failed-precondition', `距目的地尚有 ${Math.ceil(distance)} 公尺`);
    const expectedType = task['cadence'] === 'event' ? 'fertilizer' : 'waterDrops';
    if (task['reward']?.['type'] !== expectedType || !Number.isInteger(task['reward']?.['amount']) || task['reward']['amount'] <= 0) throw new HttpsError('data-loss', '任務獎勵設定無效');

    const inventory = inventorySnapshot.exists ? inventorySnapshot.data()! : { waterDrops: 0, fertilizer: 0, lightEnergy: 0 };
    const nextInventory = { waterDrops: Number(inventory['waterDrops'] ?? 0), fertilizer: Number(inventory['fertilizer'] ?? 0) };
    nextInventory[expectedType] += task['reward']['amount'];
    const result = { taskId: input.taskId, completedAt: now.toDate().toISOString(), reward: task['reward'], inventory: nextInventory };

    transaction.set(completionRef, { taskId: input.taskId, destinationId: task['destination']['id'], completedAt: now, calculatedDistanceMeters: Math.round(distance * 10) / 10, reportedAccuracyMeters: input.location.accuracy, reward: task['reward'], isDemo: false,
      taskSnapshot: {title: task['title'], description: task['description'] ?? '', areaId: task['areaId'], cadence: task['cadence'],
        startsAt: task['startsAt'], endsAt: task['endsAt'], destination: task['destination'], reward: task['reward']} });
    transaction.set(inventoryRef, { ...nextInventory, updatedAt: now }, { merge: true });
    transaction.create(ledgerRef, { type: 'taskReward', resource: expectedType, amount: task['reward']['amount'], sourceId: input.taskId, isDemo: false, idempotencyKey: input.idempotencyKey, createdAt: now });
    transaction.create(commandRef, { command: 'completeTask', result, createdAt: now });
    return result;
  });
});

function validateInput(data: CompleteTaskInput) {
  if (typeof data.taskId !== 'string' || !data.taskId || typeof data.idempotencyKey !== 'string' || !data.idempotencyKey) throw new HttpsError('invalid-argument', '缺少任務或冪等鍵');
  const location = data.location;
  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number' || typeof location.accuracy !== 'number' || typeof location.observedAt !== 'string') throw new HttpsError('invalid-argument', '定位資料格式錯誤');
  if (!Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90 || !Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 180 || !Number.isFinite(location.accuracy) || location.accuracy < 0) throw new HttpsError('invalid-argument', '定位資料超出範圍');
  return { taskId: data.taskId, idempotencyKey: data.idempotencyKey, isDemo: data.isDemo === true, expectedVersion: data.expectedVersion, location: { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy, observedAt: location.observedAt } };
}

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude); const dLng = rad(b.longitude - a.longitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
