import { Injectable, InjectionToken, inject } from '@angular/core';
import { CmsClientService } from '../../services/cms-client.service';
import type { CompanionTurn } from '../../../../../functions/src/companion-chat-domain';

export interface CompanionChatTransport {
  identity(): string;
  send(input: { message: string; history: CompanionTurn[] }): Promise<{ text: string; source: 'gemini' }>;
}
export const COMPANION_CHAT_TRANSPORT = new InjectionToken<CompanionChatTransport>('COMPANION_CHAT_TRANSPORT', {
  providedIn: 'root', factory: () => {
    const cms = inject(CmsClientService);
    return { identity: () => cms.identityKey(), send: input => cms.call('companionChat', input) };
  },
});

@Injectable({ providedIn: 'root' })
export class CompanionChatService {
  private readonly transport = inject(COMPANION_CHAT_TRANSPORT);
  private history: CompanionTurn[] = [];
  private identity = '';
  private sequence = 0;

  async reply(message: string): Promise<string> {
    const text = message.trim();
    if (!text || text.length > 200) throw new Error('請輸入 1 至 200 字');
    const identity = this.transport.identity();
    if (identity !== this.identity) { this.history = []; this.identity = identity; }
    const sequence = ++this.sequence;
    const previous = this.history.slice(-8);
    const result = await this.transport.send({ message: text, history: previous });
    if (identity !== this.transport.identity() || sequence !== this.sequence) throw new Error('對話已切換');
    if (result?.source !== 'gemini' || typeof result.text !== 'string' || !result.text.trim() || result.text.length > 600) {
      throw new Error('花栗鼠暫時沒有回應，請再試一次');
    }
    const next: CompanionTurn[] = [...previous, { role: 'user', text }, { role: 'model', text: result.text.trim() }];
    this.history = next.slice(-8);
    return result.text.trim();
  }

  reset(): void { this.sequence++; this.history = []; this.identity = ''; }
}
