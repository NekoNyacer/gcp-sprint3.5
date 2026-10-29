// Bounded live Vertex AI smoke test with explicitly synthetic advisory context.
// Creates a temporary Firebase anonymous Demo identity, then removes that identity.
// No plan/check-in/reward is written. Never print tokens or credentials.
import { readFile } from 'node:fs/promises';
const config = await readFile(new URL('../client/src/app/firebase-config.ts', import.meta.url), 'utf8');
const apiKey = /apiKey:\s*'([^']+)'/.exec(config)?.[1];
const project = /projectId:\s*'([^']+)'/.exec(config)?.[1];
if (!apiKey || !project) throw Error('Missing public Firebase configuration');
const authUrl = action => `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${apiKey}`;
const endpoint = `https://asia-east1-${project}.cloudfunctions.net/companionChat`;
let idToken;
try {
  const signup = await fetch(authUrl('signUp'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }), signal: AbortSignal.timeout(20_000) });
  if (!signup.ok) throw Error(`Test identity creation failed (${signup.status})`);
  idToken = (await signup.json()).idToken;
  if (!idToken) throw Error('Test identity was not issued');
  const weather = { source: 'open-meteo', condition: 'rainy', temperatureC: 23, precipitationMm: 1, observedAt: new Date().toISOString() };
  const agentContext = { inventory: { lightEnergy: 100, waterDrops: 0, fertilizer: 1 }, phase: 'idle', locationSource: 'demo', options: [
    { id: 'smoke:direct', treeId: 'smoke-tree', treeName: '測試小樹', place: '測試公園', care: '需要澆水', distanceMeters: 500, durationSeconds: 400, station: null, weather },
    { id: 'smoke:water', treeId: 'smoke-tree', treeName: '測試小樹', place: '測試公園', care: '需要澆水', distanceMeters: 800, durationSeconds: 650, station: { id: 'smoke-water', name: '測試遊戲補給站', resource: 'water' }, weather },
  ] };
  const history = [];
  for (const [message, expected] of [['幫我安排20分鐘內的單程散步，照顧我的樹，必須順便領遊戲水資源。', 'smoke:water'], ['改成只有1分鐘，仍然一定要補水。', null]]) {
    const start = Date.now();
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json', Origin: 'http://localhost:4200' },
      body: JSON.stringify({ data: { scope: 'demo', message, history, agentContext } }), signal: AbortSignal.timeout(55_000) });
    const body = await response.json();
    const result = body.result;
    if (!response.ok || result?.source !== 'gemini' || !result.text?.trim()) throw Error(`Live agent failed (${response.status}, ${body.error?.status ?? 'invalid-output'})`);
    if ((result.proposal?.optionId ?? null) !== expected) {
      console.log(JSON.stringify({ syntheticContext: true, text: result.text, steps: result.steps ?? [], proposal: result.proposal ?? null }));
      throw Error(`Unexpected proposal: ${result.proposal?.optionId ?? 'none'}`);
    }
    if (!result.steps?.includes('已比較單程步行路線與天氣')) throw Error('Model did not invoke the route lookup');
    console.log(JSON.stringify({ liveGemini: true, syntheticContext: true, elapsedMs: Date.now() - start, proposal: result.proposal ?? null, steps: result.steps, text: result.text }));
    history.push({ role: 'user', text: message }, { role: 'model', text: result.text });
    await new Promise(resolve => setTimeout(resolve, 1600));
  }
} finally {
  if (idToken) {
    const response = await fetch(authUrl('delete'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }), signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw Error(`Created test identity cleanup failed (${response.status})`);
    console.log('Created test identity removed.');
  }
}
