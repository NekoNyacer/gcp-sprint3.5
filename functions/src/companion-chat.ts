import { createHash } from 'node:crypto';
import { getApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { CHIPMUNK_PERSONA, parseCompanionChat } from './companion-chat-domain.js';

const model = defineString('COMPANION_GEMINI_MODEL', { default: 'gemini-2.5-flash' });
const location = defineString('COMPANION_GEMINI_LOCATION', { default: 'global' });

export const companionChat = onCall({
  region: 'asia-east1', invoker: 'public', enforceAppCheck: false,
  maxInstances: 3, timeoutSeconds: 30,
}, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '請先登入再與花栗鼠對話');
  const scope = request.data?.scope;
  if (scope !== 'demo' && scope !== 'normal') throw new HttpsError('invalid-argument', '資料範圍錯誤');
  if (scope === 'normal' && request.auth.token.firebase?.sign_in_provider !== 'google.com') {
    throw new HttpsError('permission-denied', '請使用 Google 帳號登入');
  }
  let input;
  try { input = parseCompanionChat(request.data); }
  catch (error) { throw new HttpsError('invalid-argument', (error as Error).message); }

  // Store quota counters only; conversation text stays out of Firestore and logs.
  const now = Date.now();
  const hour = Math.floor(now / 3_600_000);
  const actor = createHash('sha256').update(`${scope}:${request.auth.uid}`).digest('hex');
  const db = getFirestore();
  await db.runTransaction(async tx => {
    const ref = db.doc(`companionChatLimits/${actor}`);
    const previous = (await tx.get(ref)).data();
    const used = previous?.hour === hour ? previous.count : 0;
    if (used >= 30) throw new HttpsError('resource-exhausted', '花栗鼠需要休息一下，請下一個小時再聊');
    if (typeof previous?.lastAt === 'number' && now - previous.lastAt < 1500) {
      throw new HttpsError('resource-exhausted', '慢慢說，我還在聽，請稍等一下再傳送');
    }
    tx.set(ref, { hour, count: used + 1, lastAt: now, expiresAt: Timestamp.fromMillis((hour + 2) * 3_600_000) });
  });

  try {
    const app = getApp();
    const project = app.options.projectId || process.env.GCLOUD_PROJECT;
    const region = location.value(), modelId = model.value();
    if (!project || !/^[a-zA-Z0-9._-]+$/.test(region) || !/^[a-zA-Z0-9._-]+$/.test(modelId) || !app.options.credential) {
      throw new Error('missing-ai-config');
    }
    const token = await app.options.credential.getAccessToken();
    const hostname = region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`;
    const localTime = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Taipei', dateStyle: 'short', timeStyle: 'short',
    }).format(new Date(now));
    const response = await fetch(`https://${hostname}/v1/projects/${project}/locations/${region}/publishers/google/models/${modelId}:generateContent`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CHIPMUNK_PERSONA }, { text: `現在的台北時間：${localTime}。沒有即時天氣或位置資料。` }] },
        contents: [
          ...input.history.map(turn => ({ role: turn.role, parts: [{ text: turn.text }] })),
          { role: 'user', parts: [{ text: input.message }] },
        ],
        generationConfig: { temperature: .8, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!response.ok) throw new Error(`vertex-${response.status}`);
    const result = await response.json() as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    };
    const candidate = result.candidates?.[0];
    if (!candidate || !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason ?? 'STOP')) throw new Error('blocked-output');
    const text = candidate.content?.parts?.filter(part => !part.thought && typeof part.text === 'string')
      .map(part => part.text).join('').trim();
    if (!text || text.length > 600) throw new Error('invalid-output');
    return { text, source: 'gemini' as const };
  } catch (error) {
    const category = error instanceof Error && /^(vertex-\d+|missing-ai-config|blocked-output|invalid-output)$/.test(error.message)
      ? error.message : error instanceof Error && error.name === 'TimeoutError' ? 'vertex-timeout' : 'unavailable';
    logger.warn('companion_chat_unavailable', { category });
    throw new HttpsError('unavailable', '花栗鼠剛剛沒聽清楚，請再試一次');
  }
});
