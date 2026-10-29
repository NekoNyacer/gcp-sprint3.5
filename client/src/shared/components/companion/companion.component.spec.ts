import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { CompanionComponent } from './companion.component';
import { PET_WIDTH } from './companion-roaming';
import { CompanionChatService } from './companion-chat.service';
import { CompanionAgentService } from './companion-agent.service';
import { signal } from '@angular/core';

describe('CompanionComponent', () => {
  let callbacks: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  let time = 100;
  let events: Subject<unknown>;
  const navigate = vi.fn();
  const chat = { reply: vi.fn(), reset: vi.fn() };
  const agent = { cancel: vi.fn(), reply: vi.fn(), apply: vi.fn(), proposal: signal<any>(null), steps: signal<string[]>([]), status: signal('') };

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
    navigate.mockReset().mockResolvedValue(true);
    chat.reply.mockReset().mockResolvedValue('慢慢走，我的尾巴也陪你晃一晃。');
    chat.reset.mockClear();
    agent.proposal.set(null); agent.reply.mockReset().mockResolvedValue('已提出方案，請確認。'); agent.apply.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [
      { provide: Router, useValue: { url: '/home', events, navigateByUrl: navigate } },
      { provide: CompanionChatService, useValue: chat },
      { provide: CompanionAgentService, useValue: agent },
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

  const dragPointer = (x: number, y = 260) => ({ button: 0, pointerId: 7, clientX: x, clientY: y, preventDefault: vi.fn() }) as unknown as PointerEvent;
  const completeNavigation = () => navigate.mockImplementation((url: string) => {
    events.next(new NavigationStart(1, url)); events.next(new NavigationEnd(1, url, url)); return Promise.resolve(true);
  });
  const settleNavigation = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

  it('carries the held pointer through adjacent tabs and requires leaving the edge to switch again', async () => {
    completeNavigation();
    const fixture = TestBed.createComponent(CompanionComponent); fixture.detectChanges();
    const pet = fixture.componentInstance;
    pet.beginDrag(dragPointer(40)); pet.moveDrag(dragPointer(window.innerWidth - 1));
    await settleNavigation();
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/task');
    expect(pet.viewedTab()).toBe('task'); expect(pet.petTab()).toBe('task');
    expect((pet as any).drag.tracking).toBe(true); expect((pet as any).dragPointer).toBe(7);
    const footY = (pet as any).drag.y;
    for (let i = 0; i < 10; i++) frame();
    expect(pet.renderedAction()).toBe('held'); expect((pet as any).drag.y).toBe(footY);
    pet.moveDrag(dragPointer(window.innerWidth - 2)); expect(navigate).toHaveBeenCalledTimes(1);
    pet.moveDrag(dragPointer(window.innerWidth / 2)); pet.moveDrag(dragPointer(window.innerWidth - 1));
    await settleNavigation(); expect(navigate).toHaveBeenLastCalledWith('/shop');
    pet.moveDrag(dragPointer(window.innerWidth / 2)); pet.moveDrag(dragPointer(1));
    await settleNavigation(); expect(navigate).toHaveBeenLastCalledWith('/task');
    fixture.destroy();
  });

  it('never wraps a dragged pet past the first or last tab', async () => {
    completeNavigation();
    const fixture = TestBed.createComponent(CompanionComponent); fixture.detectChanges();
    const pet = fixture.componentInstance;
    pet.beginDrag(dragPointer(40)); pet.moveDrag(dragPointer(0));
    expect(navigate).not.toHaveBeenCalled();
    pet.close(); events.next(new NavigationEnd(1, '/profile', '/profile')); pet.petTab.set('profile');
    pet.beginDrag(dragPointer(40)); pet.moveDrag(dragPointer(window.innerWidth));
    expect(navigate).not.toHaveBeenCalled(); expect(pet.petTab()).toBe('profile');
    fixture.destroy();
  });

  it('allows a release while navigation is pending and lands on the destination tab', async () => {
    let finish!: (value: boolean) => void;
    navigate.mockImplementation((url: string) => {
      events.next(new NavigationStart(1, url)); return new Promise<boolean>(resolve => finish = resolve);
    });
    const fixture = TestBed.createComponent(CompanionComponent); fixture.detectChanges();
    const pet = fixture.componentInstance;
    pet.beginDrag(dragPointer(40)); pet.moveDrag(dragPointer(window.innerWidth));
    pet.endDrag(dragPointer(window.innerWidth)); expect(pet.dragAction()).toBe('falling');
    events.next(new NavigationEnd(1, '/task', '/task')); finish(true); await settleNavigation();
    expect(pet.petTab()).toBe('task');
    for (let i = 0; i < 30; i++) frame();
    expect(pet.dragAction()).toBeNull(); expect(pet.engaged()).toBe(false);
    fixture.destroy();
  });

  it('keeps a failed edge navigation draggable and cancels on unrelated navigation', async () => {
    navigate.mockRejectedValueOnce(new Error('offline'));
    const fixture = TestBed.createComponent(CompanionComponent); fixture.detectChanges();
    const pet = fixture.componentInstance;
    pet.beginDrag(dragPointer(40)); pet.moveDrag(dragPointer(window.innerWidth));
    await settleNavigation(); expect(pet.petTab()).toBe('home'); expect((pet as any).drag.tracking).toBe(true);
    pet.moveDrag(dragPointer(window.innerWidth / 2));
    events.next(new NavigationStart(2, '/collection'));
    expect((pet as any).drag.tracking).toBe(false); expect(pet.dragAction()).toBeNull();
    fixture.destroy();
  });

  it('drags through pickup/held/drop without a click or tab change, then supports keyboard interaction', () => {
    const fixture = TestBed.createComponent(CompanionComponent); fixture.detectChanges();
    const pet = fixture.componentInstance;
    const pointer = (x: number, y: number) => ({ button: 0, pointerId: 7, clientX: x, clientY: y, preventDefault: vi.fn() }) as unknown as PointerEvent;
    pet.beginDrag(pointer(40, window.innerHeight - 35));
    pet.moveDrag(pointer(200, 260));
    expect(pet.renderedAction()).toBe('pickup');
    for (let i = 0; i < 10; i++) frame();
    expect(pet.renderedAction()).toBe('held');
    pet.endDrag(pointer(200, 260));
    pet.petClick({ detail: 1 } as MouseEvent);
    expect(pet.engaged()).toBe(false); expect(pet.renderedAction()).toBe('falling');
    for (let i = 0; i < 30; i++) frame();
    expect(pet.dragAction()).toBeNull(); expect(pet.petTab()).toBe('home');
    pet.petClick({ detail: 0 } as MouseEvent); expect(pet.engaged()).toBe(true);
    fixture.destroy();
  });

  it('keeps a small pointer movement as a normal tap and cancels held state on navigation', () => {
    const fixture = TestBed.createComponent(CompanionComponent); fixture.detectChanges();
    const pet = fixture.componentInstance;
    const pointer = (x: number) => ({ button: 0, pointerId: 7, clientX: x, clientY: 260, preventDefault: vi.fn() }) as unknown as PointerEvent;
    pet.beginDrag(pointer(40)); pet.moveDrag(pointer(43)); pet.endDrag(pointer(43));
    pet.petClick({ detail: 1 } as MouseEvent); expect(pet.engaged()).toBe(true);
    pet.close(); pet.beginDrag(pointer(40)); pet.moveDrag(pointer(140));
    pet.close(); expect(pet.dragAction()).toBeNull();
    fixture.destroy();
  });

  it('uses agent planning only after the explicit action, and applies only on confirmation', async () => {
    const fixture = TestBed.createComponent(CompanionComponent);
    fixture.detectChanges();
    const pet = fixture.componentInstance;
    pet.greet(); pet.planWalk();
    await pet.send('20分鐘，順便補水');
    expect(agent.reply).toHaveBeenCalledWith('20分鐘，順便補水');
    expect(chat.reply).not.toHaveBeenCalled();
    expect(agent.apply).not.toHaveBeenCalled();
    agent.proposal.set({ id: 'tree:water' });
    await pet.applyPlan();
    expect(agent.apply).toHaveBeenCalledTimes(1);
    expect(pet.engaged()).toBe(false);
    fixture.destroy();
  });

  it('leaves a failed application visible without claiming success', async () => {
    const fixture = TestBed.createComponent(CompanionComponent);
    fixture.detectChanges();
    const pet = fixture.componentInstance;
    pet.greet(); pet.planWalk();
    agent.proposal.set({ id: 'tree:water' });
    agent.apply.mockRejectedValueOnce(new Error('位置已更新，請重新安排。'));
    await pet.applyPlan();
    expect(pet.engaged()).toBe(true);
    expect(pet.message()).toContain('位置已更新');
    expect(pet.applying()).toBe(false);
    fixture.destroy();
  });

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

  it('uses the active platform position and pauses a jump while the pet is engaged', () => {
    const fixture = TestBed.createComponent(CompanionComponent);
    fixture.detectChanges();
    const pet = fixture.componentInstance;
    const platforms = (pet as any).platforms;
    const advance = vi.spyOn(platforms, 'advance').mockReturnValue({
      x: 55, y: 400, jumping: true, onLedge: false, exitAllowed: false,
    });
    frame();
    fixture.detectChanges();
    expect(pet.jumping()).toBe(true);
    expect(pet.renderedAction()).toBe('jumping-up');
    expect(pet.roaming.x).toBe(55);
    expect((fixture.nativeElement as HTMLElement).style.getPropertyValue('--pet-floor'))
      .toBe(`${window.innerHeight - 400}px`);
    pet.greet();
    frame();
    expect(advance).toHaveBeenLastCalledWith(0, expect.any(Number), expect.any(Number), window.innerWidth, true);
    fixture.destroy();
  });

  it('pauses roaming while petting is open and resumes after dismissal', () => {
    const fixture = TestBed.createComponent(CompanionComponent);
    fixture.detectChanges();
    const pet = fixture.componentInstance;
    pet.greet();
    fixture.detectChanges();
    const x = pet.roaming.x;
    for (let i = 0; i < 10; i++) frame();
    expect(pet.roaming.x).toBe(x);
    pet.petChipmunk();
    fixture.detectChanges();
    expect(pet.pettingOpen()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-companion-petting')).not.toBeNull();
    for (let i = 0; i < 10; i++) frame();
    expect(pet.roaming.x).toBe(x);
    pet.closePetting();
    fixture.detectChanges();
    expect(pet.pettingOpen()).toBe(false);
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
