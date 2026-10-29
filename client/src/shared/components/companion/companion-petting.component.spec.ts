import { TestBed } from '@angular/core/testing';
import { CompanionPettingComponent } from './companion-petting.component';

describe('CompanionPettingComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); });

  it('offers accessible head and belly actions with different animated reactions', () => {
    const fixture = TestBed.createComponent(CompanionPettingComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const buttons = root.querySelectorAll<HTMLButtonElement>('.petting-actions button');
    buttons[0].click();
    expect(fixture.componentInstance.area()).toBe('head');
    vi.advanceTimersByTime(375);
    expect(fixture.componentInstance.frame()).toBe(3);
    buttons[1].click();
    expect(fixture.componentInstance.area()).toBe('belly');
    expect(fixture.componentInstance.frame()).toBe(0);
    vi.advanceTimersByTime(1125);
    expect(fixture.componentInstance.frame()).toBe(9);
    fixture.destroy();
  });

  it('reacts to touch in the correct body region and ignores the tail', () => {
    const fixture = TestBed.createComponent(CompanionPettingComponent);
    fixture.detectChanges();
    const art = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.petting-art')!;
    vi.spyOn(art, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}),
    });
    const pointer = (x: number, y: number) => ({ button: 0, pointerId: 1, currentTarget: art, clientX: x, clientY: y, preventDefault: vi.fn() }) as unknown as PointerEvent;
    fixture.componentInstance.pointerDown(pointer(65, 25));
    expect(fixture.componentInstance.area()).toBe('head');
    fixture.componentInstance.pointerMove(pointer(65, 70));
    expect(fixture.componentInstance.area()).toBe('belly');
    fixture.componentInstance.pointerMove(pointer(15, 40));
    expect(fixture.componentInstance.area()).toBe('belly');
    fixture.destroy();
  });

  it('honours reduced motion and closes on Escape without bubbling', () => {
    const fixture = TestBed.createComponent(CompanionPettingComponent);
    fixture.componentRef.setInput('reducedMotion', true);
    fixture.detectChanges();
    const pet = fixture.componentInstance;
    const close = vi.fn();
    pet.closed.subscribe(close);
    pet.react('belly');
    expect(pet.frame()).toBe(3);
    vi.advanceTimersByTime(2000);
    expect(pet.idle()).toBe(true);
    expect(pet.frame()).toBe(0);
    const key = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const stop = vi.spyOn(key, 'stopPropagation');
    pet.handleKey(key);
    expect(close).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    fixture.destroy();
  });

  it('keeps keyboard focus in the dialog and restores it after closing', () => {
    const origin = document.createElement('button');
    document.body.appendChild(origin);
    origin.focus();
    const fixture = TestBed.createComponent(CompanionPettingComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const close = root.querySelector<HTMLButtonElement>('.petting-close')!;
    const actions = root.querySelectorAll<HTMLButtonElement>('.petting-actions button');
    expect(document.activeElement).toBe(close);
    actions[1].focus();
    fixture.componentInstance.handleKey(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(close);
    close.focus();
    fixture.componentInstance.handleKey(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(actions[1]);
    fixture.destroy();
    expect(document.activeElement).toBe(origin);
    origin.remove();
  });

  it('plays a downward dismissal once and keeps the page locked until the modal is removed', () => {
    const previous = document.body.style.overflow;
    const fixture = TestBed.createComponent(CompanionPettingComponent);
    fixture.detectChanges();
    const pet = fixture.componentInstance, closed = vi.fn();
    pet.closed.subscribe(closed);
    expect(document.body.style.overflow).toBe('hidden');
    expect(fixture.nativeElement.querySelector('dialog').hasAttribute('open')).toBe(true);
    pet.requestClose(); pet.requestClose();
    expect(pet.closing()).toBe(true); expect(closed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(190);
    expect(closed).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(document.body.style.overflow).toBe(previous);
  });

  it('uses all unified clips and switches at the common neutral endpoints', () => {
    const fixture = TestBed.createComponent(CompanionPettingComponent);
    fixture.detectChanges();
    const pet = fixture.componentInstance;
    expect(pet.spritePath).toContain('petting-unified/idle');
    expect(pet.spriteSize).toBe('500% 200%');
    vi.advanceTimersByTime(5100);
    expect(pet.idleClip()).toBe('expression');
    expect(pet.spritePath).toContain('expression-master');
    vi.advanceTimersByTime(1700);
    expect(pet.idleClip()).toBe('breathing');
    pet.react('head'); expect(pet.idle()).toBe(false);
    vi.advanceTimersByTime(1600);
    expect(pet.idle()).toBe(true);
    expect(pet.spritePath).toContain('idle-atlas');
    expect(pet.previousSprite()).toBeNull();
    fixture.destroy();
  });

  it('hides speech after three seconds and renews it for the next touch', () => {
    const fixture = TestBed.createComponent(CompanionPettingComponent);
    fixture.detectChanges(); const pet = fixture.componentInstance;
    vi.advanceTimersByTime(3000); expect(pet.bubbleVisible()).toBe(false);
    pet.react('belly'); expect(pet.bubbleVisible()).toBe(true);
    vi.advanceTimersByTime(3000); expect(pet.bubbleVisible()).toBe(false);
    fixture.destroy();
  });

  it('keeps the old pose until the target atlas is decoded', async () => {
    const decode = new Map<string, () => void>();
    const original = globalThis.Image;
    vi.stubGlobal('Image', class { src = ''; decode() { return new Promise<void>(resolve => decode.set(this.src, resolve)); } });
    try {
      const fixture = TestBed.createComponent(CompanionPettingComponent);
      fixture.detectChanges(); const pet = fixture.componentInstance;
      expect(pet.spritePath).toContain('neutral.png');
      decode.get('/images/pet/animations/petting-unified/idle-atlas.png')!();
      for (let i = 0; i < 4; i++) await Promise.resolve();
      vi.advanceTimersByTime(400);
      pet.react('head'); expect(pet.idle()).toBe(true);
      decode.get('/images/pet/animations/petting-unified/head-atlas.png')!();
      for (let i = 0; i < 4; i++) await Promise.resolve();
      expect(pet.idle()).toBe(false);
      expect(pet.previousSprite()?.path).toContain('idle-atlas');
      vi.advanceTimersByTime(180); expect(pet.previousSprite()).toBeNull();
      fixture.destroy();
    } finally { vi.stubGlobal('Image', original); }
  });
});
