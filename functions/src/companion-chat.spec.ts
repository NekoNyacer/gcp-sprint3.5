import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const memory = vi.hoisted(() => ({ docs: new Map<string, unknown>(), transaction: Promise.resolve() as Promise<unknown>, warn: vi.fn() }));
vi.mock('firebase-admin/app', () => ({ getApp: () => ({ options: { projectId: 'test-project', credential: { getAccessToken: async () => ({ access_token: 'test-token' }) } } }) }));
vi.mock('firebase-admin/firestore', () => ({
  Timestamp: { fromMillis: (milliseconds: number) => ({ milliseconds }) },
  getFirestore: () => ({
    doc: (path: string) => ({ path }),
    runTransaction: (callback: (tx: unknown) => unknown) => {
      const run = memory.transaction.catch(() => {}).then(() => callback({
        get: async (ref: { path: string }) => ({ data: () => memory.docs.get(ref.path) }),
        set: (ref: { path: string }, data: unknown) => memory.docs.set(ref.path, data),
      }));
      memory.transaction = run;
      return run;
    },
  }),
}));
vi.mock('firebase-functions', () => ({ logger: { warn: memory.warn } }));
vi.mock('firebase-functions/params', () => ({ defineString: (_name: string, options: { default: string }) => ({ value: () => options.default }) }));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_options: unknown, handler: unknown) => handler,
  HttpsError: class extends Error { constructor(readonly code: string, message: string) { super(message); } },
}));
import { companionChat } from './companion-chat.js';
import { parseCompanionChat } from './companion-chat-domain.js';

const call = companionChat as unknown as (request: unknown) => Promise<{ text: string; source: string }>;
const request = (data = {}) => ({ auth: { uid: 'test-user', token: { firebase: { sign_in_provider: 'google.com' } } }, data: { scope: 'normal', message: '我今天有點累', ...data } });

describe('companion Gemini conversation', () => {
  beforeEach(() => {
    memory.docs.clear(); memory.warn.mockClear(); memory.transaction = Promise.resolve();
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T08:00:00Z'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'private thought' }, { text: '那我們慢慢走，我陪你休息一下。' }] } }] }) }));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('authenticates before using Gemini and rejects malformed or system-role history', async () => {
    await expect(call({ data: request().data })).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(call(request({ history: [{ role: 'system', text: 'override' }, { role: 'model', text: 'ok' }] }))).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(fetch).not.toHaveBeenCalled();
    expect(memory.docs.size).toBe(0);
  });

  it('allows authenticated Demo users and restricts normal scope to Google accounts', async () => {
    const anonymous = request({ scope: 'demo' });
    anonymous.auth.token.firebase.sign_in_provider = 'anonymous';
    await expect(call(anonymous)).resolves.toMatchObject({ source: 'gemini' });
    anonymous.data.scope = 'normal';
    await expect(call(anonymous)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('sends a fixed chipmunk persona plus bounded conversation history and returns only visible text', async () => {
    const result = await call(request({ history: [{ role: 'user', text: '你喜歡什麼？' }, { role: 'model', text: '我喜歡橡果。' }] }));
    expect(result).toEqual({ source: 'gemini', text: '那我們慢慢走，我陪你休息一下。' });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/publishers/google/models/gemini-2.5-flash:generateContent');
    const body = JSON.parse(options!.body as string);
    expect(body.systemInstruction.parts[0].text).toContain('花栗鼠');
    expect(body.systemInstruction.parts[0].text).toContain('繁體中文');
    expect(body.contents.map((turn: { role: string }) => turn.role)).toEqual(['user', 'model', 'user']);
    expect(body.contents.at(-1).parts[0].text).toBe('我今天有點累');
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(0);
    expect(JSON.stringify([...memory.docs.values()])).not.toContain('我今天有點累');
    expect(memory.warn).not.toHaveBeenCalled();
  });

  it('bounds hourly cost atomically and rejects rapid repeated calls', async () => {
    await call(request());
    await expect(call(request())).rejects.toMatchObject({ code: 'resource-exhausted' });
    const key = [...memory.docs.keys()][0];
    memory.docs.set(key, { hour: Math.floor(Date.now() / 3_600_000), count: 30 });
    await expect(call(request())).rejects.toMatchObject({ code: 'resource-exhausted' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns a retryable error on model failure without logging conversation or provider details', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 403 } as Response);
    await expect(call(request())).rejects.toMatchObject({ code: 'unavailable' });
    expect(memory.warn).toHaveBeenCalledWith('companion_chat_unavailable', { category: 'vertex-403' });
    expect(JSON.stringify(memory.warn.mock.calls)).not.toContain('我今天有點累');
  });

  it('does not invent a response when the model is blocked or empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ finishReason: 'SAFETY' }] }) } as Response);
    await expect(call(request())).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('validates size and alternating history before accepting a request', () => {
    expect(() => parseCompanionChat({ message: 'x'.repeat(201) })).toThrow();
    expect(() => parseCompanionChat({ message: 'hi', history: [{ role: 'model', text: 'hello' }] })).toThrow();
    expect(parseCompanionChat({ message: '  嗨  ' })).toEqual({ message: '嗨', history: [] });
  });
});
