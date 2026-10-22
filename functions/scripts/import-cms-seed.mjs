import { readFile } from 'node:fs/promises';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { validateConfig } from '../lib/cms-domain.js';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const projectId = process.argv[2];
if (!projectId) throw new Error('Usage: node scripts/import-cms-seed.mjs PROJECT_ID');
let credential = applicationDefault();
let db;
// Optional use of an already authenticated Firebase CLI; never persist tokens.
if (process.argv[3]) {
  const require = createRequire(resolve(process.argv[3], 'package.json'));
  const auth = require('./lib/auth.js');
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Sign in with firebase login first.');
  const token = account.tokens.access_token && account.tokens.expires_at > Date.now() + 60000
    ? account.tokens : await auth.getAccessToken(account.tokens.refresh_token, [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/datastore',
  ]);
  const localRequire = createRequire(import.meta.url);
  const { Firestore } = localRequire('@google-cloud/firestore');
  const { GoogleAuth } = localRequire('google-gax');
  const googleAuth = new GoogleAuth();
  const client = googleAuth.fromJSON({ type: 'authorized_user',
    client_id: require('./lib/api.js').clientId(),
    client_secret: require('./lib/api.js').clientSecret(),
    refresh_token: account.tokens.refresh_token });
  client.setCredentials({ ...client.credentials, access_token: token.access_token, expiry_date: Date.now() + 3000000 });
  db = new Firestore({ projectId, authClient: client, preferRest: true });
}
initializeApp({ projectId, credential });
db ??= getFirestore();
const config = validateConfig(JSON.parse(await readFile(new URL('../../firebase/seed/cms-demo.json', import.meta.url), 'utf8')));
const draftRef = db.doc('cmsDrafts/demo');
const releaseRef = db.doc('cmsPublished/demo');
const result = await db.runTransaction(async tx => {
  const [draft, release] = await Promise.all([tx.get(draftRef), tx.get(releaseRef)]);
  // A rerun must never replace edits made through CMS.
  if (draft.exists || release.exists) return 'Already initialized; existing CMS content preserved.';
  const now = new Date().toISOString();
  tx.create(draftRef, { config, revision: 1, publishedVersion: 1, updatedAt: now, operator: 'client-mock-import' });
  tx.create(releaseRef, { config, version: 1, publishedAt: now });
  for (const task of config.tasks ?? []) {
    const ref = db.doc(`tasks/${task.id}`);
    tx.set(ref, {
      title: task.name, description: task.description, areaId: task.areaId, cadence: task.cadence,
      startsAt: Timestamp.fromDate(new Date(task.startsAt)), endsAt: Timestamp.fromDate(new Date(task.endsAt)),
      destination: { id: task.id, name: task.destinationName, address: task.address, latitude: task.latitude, longitude: task.longitude },
      reward: { type: task.cadence === 'event' ? 'fertilizer' : 'waterDrops', amount: task.rewardAmount },
      enabled: task.enabled, cmsVersion: 1,
    });
  }
  tx.create(db.collection('cmsAudit').doc(), { action: 'client-mock-import', scope: 'demo', at: now, revision: 1 });
  return 'Imported and published client mock content.';
});
const [draft, published] = await Promise.all([draftRef.get(), releaseRef.get()]);
console.log(result);
console.log(JSON.stringify({ revision: draft.data()?.revision, version: published.data()?.version,
  counts: Object.fromEntries(['merchants', 'trees', 'species', 'rewards', 'scenes', 'tasks'].map(key => [key, published.data()?.config?.[key]?.length ?? 0])) }));
