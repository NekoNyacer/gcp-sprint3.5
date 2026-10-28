import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateConfig } from '../lib/cms-domain.js';
import { distance } from '../../scripts/expanded-catalog.mjs';

const [projectId, cliPath, mode = '--preview'] = process.argv.slice(2);
if (projectId !== 'cathay-ai-hackathon-team-03' || !cliPath || !['--preview', '--apply', '--diagnose', '--export'].includes(mode))
  throw new Error('Usage: node scripts/merge-expanded-catalog.mjs cathay-ai-hackathon-team-03 FIREBASE_CLI_PACKAGE_PATH [--preview|--apply|--diagnose|--export]');
const cliRequire = createRequire(resolve(cliPath, 'package.json'));
const auth = cliRequire('./lib/auth.js');
const account = auth.getGlobalDefaultAccount();
if (!account) throw new Error('Sign in with firebase login first.');
const token = account.tokens.access_token && account.tokens.expires_at > Date.now() + 60000
  ? account.tokens : await auth.getAccessToken(account.tokens.refresh_token, [
    'https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/datastore',
  ]);
const localRequire = createRequire(import.meta.url);
const { Firestore, Timestamp } = localRequire('@google-cloud/firestore');
const { GoogleAuth } = localRequire('google-gax');
const client = new GoogleAuth().fromJSON({type: 'authorized_user',
  client_id: cliRequire('./lib/api.js').clientId(), client_secret: cliRequire('./lib/api.js').clientSecret(),
  refresh_token: account.tokens.refresh_token});
client.setCredentials({...client.credentials, access_token: token.access_token, expiry_date: Date.now() + 3000000});
if (mode === '--diagnose') {
  try {
    const response = await client.request({url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`, method: 'POST', data: {writes: []}});
    console.log(JSON.stringify({emptyCommitStatus: response.status, changedDocuments: 0}));
  } catch (error) {
    const data = error.response?.data;
    console.log(JSON.stringify({status: error.response?.status,
      title: typeof data === 'string' ? data.match(/<title[^>]*>([^<]*)/i)?.[1] : undefined,
      message: typeof data === 'object' ? data?.error?.message : undefined}));
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}
const db = new Firestore({projectId, authClient: client, preferRest: true});
const incoming = validateConfig(JSON.parse(await readFile(new URL('../../firebase/seed/cms-demo.json', import.meta.url), 'utf8')));
const refs = [db.doc('cmsDrafts/demo'), db.doc('cmsPublished/demo')];
// Firestore can return object fields in a different order after a write.
const fingerprint = value => createHash('sha256').update(JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)).digest('hex');
const timestampString = timestamp => new Date(timestamp.seconds * 1000).toISOString()
  .replace('.000Z', `.${String(timestamp.nanoseconds).padStart(9, '0')}Z`);
const fields = object => Object.fromEntries(Object.entries(object).map(([key, item]) => [key, value(item)]));
function value(item) {
  if (item === null) return {nullValue: null};
  if (typeof item === 'string') return {stringValue: item};
  if (typeof item === 'boolean') return {booleanValue: item};
  if (typeof item === 'number' && Number.isFinite(item)) return Number.isSafeInteger(item) ? {integerValue: String(item)} : {doubleValue: item};
  if (item instanceof Timestamp) return {timestampValue: timestampString(item)};
  if (Array.isArray(item)) return {arrayValue: {values: item.map(value)}};
  if (item && typeof item === 'object') return {mapValue: {fields: fields(item)}};
  throw new Error('Unsupported value in migration data');
}
const merge = original => {
  if (!original) throw new Error('Existing catalog missing; do not initialize or republish an unpublished catalog implicitly.');
  const result = structuredClone(original);
  const additions = {};
  const skippedNearby = [];
  // Only merge this change's content categories. Never publish draft-only task,
  // reward, budget or scene changes as a side effect of this migration.
  for (const category of ['merchants', 'trees', 'seedTypes', 'cubeChannels']) {
    const current = [...(result[category] ?? [])];
    additions[category] = [];
    for (const item of incoming[category] ?? []) {
      if (current.some(previous => previous.id === item.id)) continue;
      // The existing 13 demo sites remain untouched. New sites respect live edits.
      if (category === 'trees' && current.some(previous => distance(previous, item) < 450)) {
        skippedNearby.push(item.id); continue;
      }
      current.push(item); additions[category].push(item.id);
    }
    result[category] = current;
  }
  result.species = [...new Set([...original.species, ...incoming.species])];
  validateConfig(result);
  return {config: result, additions, skippedNearby, changed: fingerprint(result) !== fingerprint(original)};
};
const initial = await Promise.all(refs.map(ref => ref.get()));
if (initial.some(snapshot => !snapshot.exists)) throw new Error('Expected both catalog documents.');
const before = initial.map(snapshot => snapshot.data());
const planned = before.map(document => merge(document.config));
console.log(JSON.stringify({mode, projectId, documents: planned.map((change, i) => ({
  path: refs[i].path, revision: before[i].revision ?? null, version: before[i].version ?? null,
  currentCounts: Object.fromEntries(['merchants','trees','seedTypes','cubeChannels'].map(k => [k, (before[i].config[k] ?? []).length])),
  changed: change.changed, additions: change.additions, skippedNearby: change.skippedNearby,
  counts: Object.fromEntries(['merchants','trees','species','seedTypes','cubeChannels'].map(k => [k, change.config[k].length])),
}))}));
if (mode === '--export') {
  // Export a CMS-compatible complete draft locally. Never write to Firestore here.
  const exported = validateConfig(planned[0].config);
  const json = JSON.stringify(exported, null, 2) + '\n';
  if (Buffer.byteLength(json, 'utf8') > 350000) throw new Error('Export exceeds CMS import size limit');
  const destination = new URL('../../firebase/seed/cms-expanded-2026-10-27.json', import.meta.url);
  await writeFile(destination, json, 'utf8');
  console.log(JSON.stringify({exported: true, destination: destination.pathname,
    basedOnDraftRevision: before[0].revision, bytes: Buffer.byteLength(json, 'utf8'),
    counts: Object.fromEntries(['merchants','trees','species','seedTypes','cubeChannels','tasks','rewards','scenes'].map(k => [k, (exported[k] ?? []).length]))}));
}
if (mode === '--apply' && planned.some(change => change.changed)) {
    // Use the official REST commit endpoint, verified to work with this proxy.
    // Exact nanosecond update-time preconditions prevent overwriting concurrent edits.
    const writes = [];
    const fullName = ref => `projects/${projectId}/databases/(default)/documents/${ref.path}`;
    const tx = {
      create(ref, data) { writes.push({update: {name: fullName(ref), fields: fields(data)}, currentDocument: {exists: false}}); },
      update(ref, data, precondition) { writes.push({update: {name: fullName(ref), fields: fields(data)},
        updateMask: {fieldPaths: Object.keys(data)}, currentDocument: {updateTime: timestampString(precondition.lastUpdateTime)}}); },
    };
    const now = new Date().toISOString();
    const oldVersion = before[1].version;
    const nextVersion = oldVersion + (planned[1].changed ? 1 : 0);
    const audit = db.collection('cmsAudit').doc();
    // Backup and both catalog updates commit atomically. No player documents touched.
    tx.create(audit, {action: 'merge-expanded-catalog-v1', scope: 'demo', at: now,
      operator: account.user?.email ?? 'authenticated-firebase-cli',
      beforeDraft: before[0], beforePublication: before[1],
      additions: planned.map(change => change.additions), publicationVersion: nextVersion,
      expiresAt: Timestamp.fromDate(new Date('2026-11-16T16:00:00.000Z'))});
    if (planned[1].changed) tx.update(refs[1], {config: planned[1].config, version: nextVersion, publishedAt: now}, {lastUpdateTime: initial[1].updateTime});
    tx.update(refs[0], {config: planned[0].config, revision: before[0].revision + 1,
      ...(before[0].publishedVersion === oldVersion ? {publishedVersion: nextVersion} : {}),
      updatedAt: now, operator: 'expanded-catalog-migration'}, {lastUpdateTime: initial[0].updateTime});
    try {
      await client.request({url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`,
        method: 'POST', data: {writes}, timeout: 30000});
    } catch (error) {
      const data = error.response?.data;
      const reason = typeof data === 'string' ? data.match(/<title[^>]*>([^<]*)/i)?.[1]
        : data?.error?.message;
      // Never dump request headers, credentials, or entire backup bodies.
      throw new Error(`Firestore commit failed: HTTP ${error.response?.status ?? 'unknown'}; ${reason ?? 'request failed'}`);
    }
}
if (mode === '--apply') {
  const verified = await Promise.all(refs.map(ref => ref.get()));
  verified.forEach((snapshot, i) => {
    if (fingerprint(snapshot.data().config) !== fingerprint(planned[i].config))
      throw new Error(`Readback mismatch at ${refs[i].path}`);
  });
  console.log(JSON.stringify({verified: true, documents: verified.map(snapshot => ({path: snapshot.ref.path,
    revision: snapshot.data().revision ?? null, version: snapshot.data().version ?? null,
    counts: Object.fromEntries(['merchants','trees','seedTypes','cubeChannels'].map(k => [k, snapshot.data().config[k].length])),
  }))}));
}
await db.terminate();
