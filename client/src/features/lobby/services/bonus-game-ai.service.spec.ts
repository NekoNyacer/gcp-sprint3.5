import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BONUS_GAME_AI_CALLER,
  BonusGameAiCaller,
  BonusGameAiService,
  NineUpperTopic,
} from './bonus-game-ai.service';

describe('BonusGameAiService', () => {
  const topic: NineUpperTopic = {
    question: '阿撒布魯',
    answer: '形容事情亂七八糟。',
    tips: ['形容詞', '入浴劑', '狗的品種'],
  };
  let caller: ReturnType<typeof vi.fn<BonusGameAiCaller>>;
  let service: BonusGameAiService;

  beforeEach(() => {
    caller = vi.fn<BonusGameAiCaller>();
    TestBed.configureTestingModule({
      providers: [BonusGameAiService, { provide: BONUS_GAME_AI_CALLER, useValue: caller }],
    });
    service = TestBed.inject(BonusGameAiService);
  });

  it('calls the configured generator with a trimmed prompt', async () => {
    caller.mockResolvedValue(topic);

    await expect(service.generateNineUpperTopic('  台灣流行語  ')).resolves.toEqual(topic);
    expect(caller).toHaveBeenCalledWith('generateGameTopic', { customPrompt: '台灣流行語' });
  });

  it('rejects malformed generated content', async () => {
    caller.mockResolvedValue({ question: '缺少解答', tips: ['只有一個'] });

    await expect(service.generateNineUpperTopic()).rejects.toThrow('AI 回傳的 9UPPER 題目格式錯誤');
  });
});
