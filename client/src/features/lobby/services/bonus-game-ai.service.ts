import { inject, InjectionToken, Service } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

export type NineUpperTopic = {
  question: string;
  tips: string[];
  answer: string;
};

export type BonusGameAiCaller = (functionName: string, payload: unknown) => Promise<unknown>;

export const BONUS_GAME_AI_CALLER = new InjectionToken<BonusGameAiCaller>('BONUS_GAME_AI_CALLER', {
  providedIn: 'root',
  factory: () => {
    const functions = inject(Functions);
    return async (functionName, payload) => {
      const callable = httpsCallable<unknown, unknown>(functions, functionName);
      return (await callable(payload)).data;
    };
  },
});

@Service()
export class BonusGameAiService {
  private readonly call = inject(BONUS_GAME_AI_CALLER);

  async generateNineUpperTopic(customPrompt = ''): Promise<NineUpperTopic> {
    const result = await this.call('generateGameTopic', { customPrompt: customPrompt.trim() });

    if (!this.isNineUpperTopic(result)) {
      throw new Error('AI 回傳的 9UPPER 題目格式錯誤');
    }

    return result;
  }

  private isNineUpperTopic(data: unknown): data is NineUpperTopic {
    if (!data || typeof data !== 'object') return false;
    const topic = data as Partial<NineUpperTopic>;

    return (
      typeof topic.question === 'string' &&
      topic.question.trim().length > 0 &&
      typeof topic.answer === 'string' &&
      topic.answer.trim().length > 0 &&
      Array.isArray(topic.tips) &&
      topic.tips.length === 3 &&
      topic.tips.every((tip) => typeof tip === 'string' && tip.trim().length > 0)
    );
  }
}
