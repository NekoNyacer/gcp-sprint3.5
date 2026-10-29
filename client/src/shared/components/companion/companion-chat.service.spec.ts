import { TestBed } from '@angular/core/testing';
import { COMPANION_CHAT_TRANSPORT, CompanionChatService } from './companion-chat.service';

describe('CompanionChatService', () => {
  let identity: string;
  const send = vi.fn();
  beforeEach(() => {
    identity = 'demo:alice';
    send.mockReset().mockResolvedValue({ text: '我陪你一起走。', source: 'gemini' });
    TestBed.configureTestingModule({ providers: [{ provide: COMPANION_CHAT_TRANSPORT, useValue: { identity: () => identity, send } }] });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('keeps four recent exchanges and resets conversation after identity changes', async () => {
    const chat = TestBed.inject(CompanionChatService);
    for (let i = 0; i < 6; i++) await chat.reply(`第${i}句`);
    expect(send.mock.calls[5][0].history).toHaveLength(8);
    expect(send.mock.calls[5][0].history[0]).toEqual({ role: 'user', text: '第1句' });
    identity = 'normal:bob';
    await chat.reply('你好');
    expect(send.mock.calls.at(-1)![0].history).toEqual([]);
  });

  it('rejects responses arriving after account changes and never adds failed turns to history', async () => {
    let resolve!: (result: unknown) => void;
    send.mockImplementationOnce(() => new Promise(r => resolve = r));
    const chat = TestBed.inject(CompanionChatService);
    const pending = chat.reply('舊帳號訊息');
    identity = 'normal:bob';
    resolve({ text: '舊帳號回應', source: 'gemini' });
    await expect(pending).rejects.toThrow('對話已切換');
    await chat.reply('新帳號訊息');
    expect(send.mock.calls[1][0].history).toEqual([]);
  });

  it('requires an actual Gemini response instead of a fabricated fallback', async () => {
    send.mockResolvedValueOnce({ text: '假回應', source: 'rules' });
    await expect(TestBed.inject(CompanionChatService).reply('你好')).rejects.toThrow();
  });
});
