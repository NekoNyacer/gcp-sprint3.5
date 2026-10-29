import { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it, vi } from 'vitest';
import { provisionStarterSeed } from './starter-seed.js';

describe('provisionStarterSeed', () => {
  it('creates exactly one starter seed and an immutable ledger entry', async () => {
    const fake = createFakeFirestore();

    expect(await provisionStarterSeed(fake.db, 'new-user')).toBe('created');
    expect(await provisionStarterSeed(fake.db, 'new-user')).toBe('already-created');

    expect(fake.read('users/new-user/inventory/current')).toMatchObject({
      lightEnergy: 0,
      waterDrops: 0,
      fertilizer: 0,
      seeds: 1,
    });
    expect(fake.read('users/new-user/ledger/starter-seed')).toMatchObject({
      type: 'starterSeedGrant',
      resource: 'seeds',
      amount: 1,
      sourceId: 'accountCreation',
      isDemo: false,
      idempotencyKey: 'starter-seed',
    });
  });

  it('preserves an inventory created before the authentication event is handled', async () => {
    const fake = createFakeFirestore({
      'users/new-user/inventory/current': {
        lightEnergy: 6,
        waterDrops: 2,
        fertilizer: 1,
      },
    });

    await provisionStarterSeed(fake.db, 'new-user');

    expect(fake.read('users/new-user/inventory/current')).toMatchObject({
      lightEnergy: 6,
      waterDrops: 2,
      fertilizer: 1,
      seeds: 1,
    });
  });
});

function createFakeFirestore(initial: Record<string, Record<string, unknown>> = {}) {
  const documents = new Map(Object.entries(initial));
  const db = {
    doc: (path: string) => ({ path }),
    runTransaction: async <T>(callback: (transaction: FakeTransaction) => Promise<T>) => {
      const writes: Array<() => void> = [];
      const transaction: FakeTransaction = {
        get: vi.fn(async (reference: FakeReference) => ({
          exists: documents.has(reference.path),
          data: () => documents.get(reference.path),
        })),
        set: vi.fn((reference: FakeReference, data: Record<string, unknown>) => {
          writes.push(() => documents.set(reference.path, { ...documents.get(reference.path), ...data }));
        }),
        create: vi.fn((reference: FakeReference, data: Record<string, unknown>) => {
          writes.push(() => {
            if (documents.has(reference.path)) {
              throw new Error(`Document already exists: ${reference.path}`);
            }
            documents.set(reference.path, data);
          });
        }),
      };
      const result = await callback(transaction);
      writes.forEach((write) => write());
      return result;
    },
  };

  return {
    db: db as unknown as Firestore,
    read: (path: string) => documents.get(path),
  };
}

type FakeReference = { path: string };
type FakeTransaction = {
  get(reference: FakeReference): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(reference: FakeReference, data: Record<string, unknown>, options: { merge: boolean }): void;
  create(reference: FakeReference, data: Record<string, unknown>): void;
};
