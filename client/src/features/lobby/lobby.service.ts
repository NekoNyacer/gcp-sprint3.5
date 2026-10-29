import { Service, signal } from '@angular/core';

@Service()
export class LobbyService {
  customPrompt = signal('');
}
