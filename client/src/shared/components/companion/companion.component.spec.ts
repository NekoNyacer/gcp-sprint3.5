import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { CompanionComponent } from './companion.component';
import { PET_WIDTH } from './companion-roaming';
import { CompanionChatService } from './companion-chat.service';

describe('CompanionComponent', () => {
  let callbacks: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  let time = 100;
  let events: Subject<unknown>;
  const chat = { reply: vi.fn(), reset: vi.fn() };

  beforeEach(() => {
    vi.useFakeTimers();
    callbacks = new Map();
    nextFrame = 0;
    time = 100;
    vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => {
      callbacks.set(++nextFrame, next);
      return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
    events = new Subject();
    chat.reply.mockReset().mockResolvedValue('慢慢走，我的尾巴也陪你晃一晃。');
    chat.reset.mockClear();
    TestBed.configureTestingModule({ providers: [
      { provide: Router, useValue: { url: '/home', events } },
      { provide: CompanionChatService, useValue: chat },
    ] });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const frame = () => {
    time += 50;
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach(callback => callback(time));
  };

  it('continues moving on another tab and appears there at its current position', () => {
    const fixture = TestBed.createComponent(CompanionComponent);
    fixture.detectChanges();
    const pet = fixture.componentInstance;
    frame();
    pet.roaming.x = window.innerWidth + 7;
    frame();
    fixture.detectChanges();
    expect(pet.petTab()).toBe('task');
    expect(pet.isHere()).toBe(false);
    const enteredAt = pet.roaming.x;
    for (let i = 0; i < 30; i++) frame();
    expect(pet.roaming.x).toBeGreaterThan(enteredAt);
    events.next(new NavigationEnd(1, '/task', '/task'));
    fixture.detectChanges();
    expect(pet.isHere()).toBe(true);
    expect(fixture.nativeElement.classList.contains('companion-away')).toBe(false);
    fixture.destroy();
  });

  it('moves from Home to Profile on the left, without navigating the user', () => {
    const fixture = TestBed.createComponent(CompanionComponent);
    fixture.detectChanges();
    const pet = fixture.componentInstance;
    frame();
    pet.roaming.x = -PET_WIDTH - 7;
    pet.roaming.direction = -1;
    frame();
    expect(pet.petTab()).toBe('profile');
    expect(pet.viewedTab()).toBe('home');
    fixture.destroy();
  });

  it('pauses for interaction, replays petting, and resumes autonomous activity after dismissal', () => {
    const fixture = TestBed.createComponent(CompanionComponent);
    fixture.detectChanges();
    const pet = fixture.componentInstance;
    pet.greet();
    fixture.detectChanges();
    const x = pet.roaming.x;
    for (let i = 0; i < 10; i++) frame();
    expect(pet.roaming.x).toBe(x);
    pet.petChipmunk();
    const serial = pet.actionSerial();
    pet.petChipmunk();
    expect(pet.actionSerial()).toBe(serial + 1);
    expect(pet.action()).toBe('petted');
    pet.talk();
    pet.send('想去公園');
    expect(pet.reply()).toBe('想去公園');
    pet.close();
    frame();
    expect(pet.roaming.x).toBeGreaterThan(x);
    expect(pet.engaged()).toBe(false);
    fixture.destroy();
  });

  it('focuses the native keyboard editor from Talk, protects IME Enter and sends on the next Enter', async () => {
    const fixture = TestBed.createComponent(CompanionComponent);
    fixture.detectChanges();
    const pet = fixture.componentInstance;
    pet.greet();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.pet-fab')!.click();
    fixture.detectChanges();
    const editor = root.querySelector<HTMLTextAreaElement>('.pet-keyboard-input')!;
    expect(document.activeElement).toBe(editor);
    expect(root.querySelector('.pet-menu,.pet-chat,.chat-input')).toBeNull();
    editor.value = '你好';
    editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }));
    expect(chat.reply).not.toHaveBeenCalled();
    editor.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    expect(pet.draft()).toBe('你好');
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(chat.reply).toHaveBeenCalledExactlyOnceWith('你好');
    expect(editor.value).toBe('');
    expect(pet.talking()).toBe(false);
    await Promise.resolve();
    expect(pet.message()).toContain('尾巴');
    fixture.destroy();
  });

  it('ignores blank input and supports mobile line-break submission without a second send', () => {
    const fixture = TestBed.createComponent(CompanionComponent);
    fixture.detectChanges();
    const pet = fixture.componentInstance;
    pet.greet(); pet.talk();
    const editor = (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>('textarea')!;
    editor.value = '  ';
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(chat.reply).not.toHaveBeenCalled();
    editor.value = '一起散步';
    editor.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertLineBreak', bubbles: true, cancelable: true }));
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(chat.reply).toHaveBeenCalledExactlyOnceWith('一起散步');
    fixture.destroy();
  });

  it('discards late Gemini responses after dismissal and offers retry on failure', async () => {
    const fixture = TestBed.createComponent(CompanionComponent);
    fixture.detectChanges();
    const pet = fixture.componentInstance;
    let resolve!: (text: string) => void;
    chat.reply.mockImplementationOnce(() => new Promise<string>(r => resolve = r));
    pet.greet();
    const pending = pet.send('你好');
    expect(pet.chatPending()).toBe(true);
    pet.close();
    resolve('遲到的回應');
    await pending;
    expect(pet.engaged()).toBe(false);
    expect(pet.message()).not.toBe('遲到的回應');
    pet.greet();
    chat.reply.mockRejectedValueOnce(new Error('offline'));
    await pet.send('再問一次');
    expect(pet.chatError()).toBe(true);
    expect(pet.chatPending()).toBe(false);
    pet.retryChat();
    await Promise.resolve();
    expect(pet.chatError()).toBe(false);
    expect(chat.reply).toHaveBeenLastCalledWith('再問一次');
    fixture.destroy();
  });
});
