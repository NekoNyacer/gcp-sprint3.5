// Two bounded authenticated Demo calls, then remove only the created test identity.
// Tokens and Firebase credentials are never printed or saved.
import { readFile } from 'node:fs/promises';
const config = await readFile(new URL('../client/src/app/firebase-config.ts', import.meta.url), 'utf8');
const apiKey = /apiKey:\s*'([^']+)'/.exec(config)?.[1];
const project = /projectId:\s*'([^']+)'/.exec(config)?.[1];
if (!apiKey || !project) throw Error('Missing public Firebase configuration');
const authUrl = action => `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${apiKey}`;
let idToken;
try {
  const endpoint = `https://asia-east1-${project}.cloudfunctions.net/companionChat`;
  const preflight = await fetch(endpoint, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:4200', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' },
    signal: AbortSignal.timeout(20000),
  });
  if (!preflight.ok || !['*', 'http://localhost:4200'].includes(preflight.headers.get('access-control-allow-origin'))) {
    throw Error(`Browser preflight failed (${preflight.status})`);
  }
  const response = await fetch(authUrl('signUp'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(`Test identity creation failed (${response.status})`);
  const identity = await response.json();
  idToken = identity.idToken;
  if (!idToken) throw Error('Test identity was not issued');
  const history = [];
  const report = [];
  for (const message of ['今天走了一小段路就有點累，可以陪我休息一下嗎？', '那你喜歡什麼點心？']) {
    const start = Date.now();
    const reply = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json', Origin: 'http://localhost:4200' },
      body: JSON.stringify({ data: { scope: 'demo', message, history } }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await reply.json();
    if (!reply.ok || body.result?.source !== 'gemini' || !body.result.text?.trim()) {
      throw Error(`Live companion chat failed (${reply.status}, ${body.error?.status ?? 'invalid-output'})`);
    }
    history.push({ role: 'user', text: message }, { role: 'model', text: body.result.text });
    report.push({ source: body.result.source, text: body.result.text, elapsedMs: Date.now() - start });
    await new Promise(resolve => setTimeout(resolve, 1600));
  }
  console.log(JSON.stringify({ liveGemini: true, conversationTurns: report }, null, 2));
} finally {
  if (idToken) {
    const response = await fetch(authUrl('delete'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error(`Created test identity cleanup failed (${response.status})`);
    console.log('Created test identity removed.');
  }
}
