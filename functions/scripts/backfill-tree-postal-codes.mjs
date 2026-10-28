import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { legacyTreePostalCode } from '../lib/tree-region.js';

function backfill(config) {
  let count = 0;
  const trees = config.trees.map(tree => {
    // Current CMS edit verified against https://www.femh.org.tw/mainpage/contact.
    const postalCode = tree.place === '亞東紀念醫院' ? '220' : legacyTreePostalCode(tree.place);
    if (tree.postalCode !== undefined || !postalCode) return tree;
    count++;
    return { ...tree, postalCode };
  });
  return { config: { ...config, trees }, count };
}

const projectId = process.argv[2];
if (projectId === '--local') {
  for (const path of ['../../firebase/seed/cms-demo.json', '../../cms/public/cms-demo.json']) {
    const url = new URL(path, import.meta.url);
    const result = backfill(JSON.parse(await readFile(url, 'utf8')));
    if (result.count) await writeFile(url, JSON.stringify(result.config, null, 2) + '\n');
    console.log(`${path}: ${result.count} postal codes added`);
  }
} else {
  if (!projectId || !process.argv[3]) throw new Error('Usage: node scripts/backfill-tree-postal-codes.mjs PROJECT_ID FIREBASE_CLI_PACKAGE_PATH | --local');
  // Reuse the existing authenticated Firebase CLI without persisting credentials.
  const require = createRequire(resolve(process.argv[3], 'package.json'));
  const auth = require('./lib/auth.js');
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Sign in with firebase login first.');
  const token = account.tokens.access_token && account.tokens.expires_at > Date.now() + 60000
    ? account.tokens : await auth.getAccessToken(account.tokens.refresh_token, [
      'https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/datastore',
    ]);
  const localRequire = createRequire(import.meta.url);
  const { Firestore } = localRequire('@google-cloud/firestore');
  const { GoogleAuth } = localRequire('google-gax');
  const client = new GoogleAuth().fromJSON({ type: 'authorized_user',
    client_id: require('./lib/api.js').clientId(), client_secret: require('./lib/api.js').clientSecret(),
    refresh_token: account.tokens.refresh_token });
  client.setCredentials({ ...client.credentials, access_token: token.access_token, expiry_date: Date.now() + 3000000 });
  const db = new Firestore({ projectId, authClient: client, preferRest: true });
  const refs = [db.doc('cmsDrafts/demo'), db.doc('cmsPublished/demo')];
  const result = await db.runTransaction(async tx => {
    const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
    const changes = snapshots.map(snapshot => snapshot.exists ? backfill(snapshot.data().config) : null);
    const releaseVersion = snapshots[1].data()?.version ?? 0;
    const nextVersion = releaseVersion + (changes[1]?.count ? 1 : 0);
    const now = new Date().toISOString();
    if (changes[1]?.count) tx.update(refs[1], { config: changes[1].config, version: nextVersion, publishedAt: now });
    if (changes[0] && (changes[0].count || changes[1]?.count)) {
      tx.update(refs[0], { config: changes[0].config, revision: snapshots[0].data().revision + 1,
        ...(snapshots[0].data().publishedVersion === releaseVersion ? { publishedVersion: nextVersion } : {}),
        updatedAt: now, operator: 'tree-postal-code-backfill' });
    }
    if (changes.some(change => change?.count)) tx.create(db.collection('cmsAudit').doc(), {
      action: 'tree-postal-code-backfill', scope: 'demo', at: now,
      counts: changes.map(change => change?.count ?? 0),
    });
    return changes.map(change => change?.count ?? 0);
  });
  const verified = await Promise.all(refs.map(ref => ref.get()));
  console.log(JSON.stringify({ added: result, documents: verified.map(snapshot => ({
    path: snapshot.ref.path, revision: snapshot.data()?.revision, version: snapshot.data()?.version,
    trees: snapshot.data()?.config.trees.map(({ id, place, postalCode, latitude, longitude }) => ({ id, place, postalCode, latitude, longitude })),
  })) }));
}
