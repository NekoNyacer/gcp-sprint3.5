import { Firestore, Timestamp } from 'firebase-admin/firestore';

const STARTER_SEED_LEDGER_ID = 'starter-seed';

export type StarterSeedProvisionResult = 'created' | 'already-created';

export async function provisionStarterSeed(
  db: Firestore,
  uid: string,
): Promise<StarterSeedProvisionResult> {
  const inventoryRef = db.doc(`users/${uid}/inventory/current`);
  const ledgerRef = db.doc(`users/${uid}/ledger/${STARTER_SEED_LEDGER_ID}`);

  return db.runTransaction(async (transaction) => {
    const [inventorySnapshot, ledgerSnapshot] = await Promise.all([
      transaction.get(inventoryRef),
      transaction.get(ledgerRef),
    ]);

    if (ledgerSnapshot.exists) {
      return 'already-created';
    }

    const inventory = inventorySnapshot.data();
    const now = Timestamp.now();
    const currentSeeds = Number(inventory?.['seeds'] ?? 0);

    transaction.set(
      inventoryRef,
      {
        lightEnergy: Number(inventory?.['lightEnergy'] ?? 0),
        waterDrops: Number(inventory?.['waterDrops'] ?? 0),
        fertilizer: Number(inventory?.['fertilizer'] ?? 0),
        seeds: currentSeeds + 1,
        updatedAt: now,
      },
      { merge: true },
    );
    transaction.create(ledgerRef, {
      type: 'starterSeedGrant',
      resource: 'seeds',
      amount: 1,
      sourceId: 'accountCreation',
      isDemo: false,
      idempotencyKey: STARTER_SEED_LEDGER_ID,
      createdAt: now,
    });

    return 'created';
  });
}
