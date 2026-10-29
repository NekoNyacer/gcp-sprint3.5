import {
  AfterViewInit, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild, computed, inject, signal,
} from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChipmunkAction, ChipmunkMotionComponent } from './chipmunk-motion.component';
import { AutonomousBehavior, CompanionRoaming, PET_WIDTH, adjacentTab, companionTab, CompanionTab } from './companion-roaming';
import { CompanionChatService } from './companion-chat.service';

@Component({
  selector: 'app-companion',
  templateUrl: './companion.component.html',
  styleUrl: './companion.component.scss',
  imports: [ChipmunkMotionComponent],
  host: { '[class.companion-away]': '!isHere()' },
})
export class CompanionComponent implements AfterViewInit, OnDestroy {
  @ViewChild('pet', { static: true }) private pet!: ElementRef<HTMLButtonElement>;
  @ViewChild('menu', { static: true }) private menu!: ElementRef<HTMLElement>;
  @ViewChild('feedback', { static: true }) private feedback!: ElementRef<HTMLElement>;
  @ViewChild('keyboardInput', { static: true }) private keyboardInput!: ElementRef<HTMLTextAreaElement>;
  @Input() set floor(element: HTMLElement | null) {
    this.floorElement = element;
    this.resizeObserver?.disconnect();
    if (element) this.resizeObserver?.observe(element);
    if (this.initialized) this.layout();
  }

  readonly engaged = signal(false);
  readonly talking = signal(false);
  readonly action = signal<ChipmunkAction>('walking');
  readonly behavior = signal<AutonomousBehavior>('walking');
  readonly renderedAction = computed<ChipmunkAction>(() => this.engaged() ? this.action() : this.reducedMotion() ? 'idle' : this.behavior());
  readonly actionSerial = signal(0);
  readonly message = signal('嗨！你找到我了。今天也一起散步吧！');
  readonly reply = signal('');
  readonly draft = signal('');
  readonly chatPending = signal(false);
  readonly chatError = signal(false);
  readonly reducedMotion = signal(false);
  readonly roaming = new CompanionRoaming();
  private readonly zone = inject(NgZone);
  private readonly chat = inject(CompanionChatService);
  private readonly router = inject(Router, { optional: true });
  readonly viewedTab = signal(companionTab(this.router?.url ?? '/home'));
  readonly petTab = signal<CompanionTab>(this.viewedTab() ?? 'home');
  readonly isHere = computed(() => this.petTab() === this.viewedTab());
  private readonly host = inject(ElementRef<HTMLElement>);
  private subscription?: Subscription;
  private floorElement: HTMLElement | null = null;
  private resizeObserver?: ResizeObserver;
  private preference?: MediaQueryList;
  private initialized = false;
  private frame = 0;
  private previousTime = 0;
  private focused = false;
  private actionTimer?: ReturnType<typeof setTimeout>;
  private composing = false;
  private chatSequence = 0;
  private lastMessage = '';
  private readonly resize = () => this.layout();
  private readonly visibility = () => this.restart();
  private readonly preferenceChanged = () => {
    this.reducedMotion.set(this.preference?.matches ?? false);
    this.roaming.keepVisible(window.innerWidth);
    this.restart();
  };
  private readonly outside = (event: PointerEvent) => {
    if (this.engaged() && event.target instanceof Node &&
      !this.pet.nativeElement.contains(event.target) && !this.menu.nativeElement.contains(event.target) &&
      !this.feedback.nativeElement.contains(event.target) &&
      event.target !== this.keyboardInput.nativeElement) {
      this.zone.run(() => this.close());
    }
  };
  private readonly keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.engaged() && !event.isComposing && !this.composing) {
      this.close();
      this.pet.nativeElement.focus();
    }
  };

  ngAfterViewInit(): void {
    this.initialized = true;
    if (typeof matchMedia === 'function') {
      this.preference = matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion.set(this.preference.matches);
      this.preference.addEventListener('change', this.preferenceChanged);
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.resize);
      if (this.floorElement) this.resizeObserver.observe(this.floorElement);
    }
    window.addEventListener('resize', this.resize);
    window.visualViewport?.addEventListener('resize', this.resize);
    window.visualViewport?.addEventListener('scroll', this.resize);
    document.addEventListener('visibilitychange', this.visibility);
    document.addEventListener('pointerdown', this.outside);
    document.addEventListener('keydown', this.keydown);
    this.subscription = this.router?.events.subscribe(event => {
      if (event instanceof NavigationStart) this.close();
      if (event instanceof NavigationEnd) {
        this.viewedTab.set(companionTab(event.urlAfterRedirects));
        this.restart();
      }
    });
    this.layout();
    this.restart();
  }

  greet(): void {
    this.cancelChat();
    this.engaged.set(true);
    this.stopTalking();
    this.reply.set('');
    this.roaming.keepVisible(window.innerWidth);
    this.perform('greeting', '嗨！你找到我了。今天也一起散步吧！');
    this.layout();
  }

  petChipmunk(): void {
    this.cancelChat();
    this.stopTalking();
    this.reply.set('');
    this.perform('petted', '嗯～好舒服，再摸摸我的頭！');
  }

  talk(): void {
    if (this.chatPending()) return;
    this.chatError.set(false);
    this.talking.set(true);
    this.reply.set('');
    this.perform('idle', '我在聽，直接輸入，按 Enter 傳送。');
    // Keep focus in the tap handler: mobile browsers require a direct gesture
    // to open the software keyboard. This editor has no visible input box.
    this.keyboardInput.nativeElement.focus({ preventScroll: true });
  }

  async send(text: string): Promise<void> {
    if (!text.trim() || this.chatPending()) return;
    this.lastMessage = text.trim().slice(0, 200);
    this.reply.set(this.lastMessage);
    this.stopTalking();
    this.chatPending.set(true);
    this.chatError.set(false);
    this.perform('idle', '嗯，讓我想想…');
    const sequence = ++this.chatSequence;
    try {
      const response = await this.chat.reply(this.lastMessage);
      if (sequence !== this.chatSequence || !this.engaged()) return;
      this.perform('greeting', response);
    } catch (error) {
      if (sequence !== this.chatSequence || !this.engaged()) return;
      this.chatError.set(true);
      const failure = error as { code?: string; message?: string };
      this.message.set(failure.code === 'functions/resource-exhausted' && failure.message
        ? failure.message : '暫時連不上對話服務，點「重試」再試一次。');
      this.action.set('idle');
    } finally {
      if (sequence === this.chatSequence) this.chatPending.set(false);
    }
  }

  retryChat(): void { if (this.lastMessage) void this.send(this.lastMessage); }

  updateDraft(): void {
    this.draft.set(this.keyboardInput.nativeElement.value);
  }

  compositionStart(): void { this.composing = true; }
  compositionEnd(): void { this.composing = false; this.updateDraft(); }

  inputKeydown(event: KeyboardEvent): void {
    // Enter selects a candidate during Chinese/Japanese composition; it must
    // never send an unfinished message. Some keyboards identify this as 229.
    if (event.key !== 'Enter' || event.isComposing || this.composing || event.keyCode === 229) return;
    event.preventDefault();
    void this.send(this.keyboardInput.nativeElement.value);
  }

  beforeInput(event: InputEvent): void {
    if (event.isComposing || this.composing || !['insertLineBreak', 'insertParagraph'].includes(event.inputType)) return;
    event.preventDefault();
    void this.send(this.keyboardInput.nativeElement.value);
  }

  close(): void {
    this.cancelChat();
    clearTimeout(this.actionTimer);
    this.engaged.set(false);
    this.stopTalking();
    this.reply.set('');
    this.focused = false;
    if (document.activeElement === this.pet?.nativeElement) this.pet.nativeElement.blur();
    this.action.set('walking');
  }

  focusPet(focused: boolean): void { this.focused = focused; }

  ngOnDestroy(): void {
    this.cancelChat();
    this.chat.reset();
    this.initialized = false;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.actionTimer);
    this.subscription?.unsubscribe();
    this.resizeObserver?.disconnect();
    this.preference?.removeEventListener('change', this.preferenceChanged);
    window.removeEventListener('resize', this.resize);
    window.visualViewport?.removeEventListener('resize', this.resize);
    window.visualViewport?.removeEventListener('scroll', this.resize);
    document.removeEventListener('visibilitychange', this.visibility);
    document.removeEventListener('pointerdown', this.outside);
    document.removeEventListener('keydown', this.keydown);
  }

  private cancelChat(): void {
    this.chatSequence++;
    this.chatPending.set(false);
    this.chatError.set(false);
  }

  private stopTalking(): void {
    this.talking.set(false);
    this.draft.set('');
    this.composing = false;
    if (this.keyboardInput) {
      this.keyboardInput.nativeElement.value = '';
      this.keyboardInput.nativeElement.blur();
    }
  }

  private perform(action: ChipmunkAction, message: string): void {
    clearTimeout(this.actionTimer);
    this.action.set(action);
    this.actionSerial.update(serial => serial + 1);
    this.message.set(message);
    this.actionTimer = setTimeout(() => this.action.set('idle'), 1800);
  }

  private restart(): void {
    cancelAnimationFrame(this.frame);
    this.previousTime = 0;
    if (!this.initialized || document.hidden) return;
    this.zone.runOutsideAngular(() => {
      this.frame = requestAnimationFrame(time => this.tick(time));
    });
  }

  private tick(time: number): void {
    if (!this.initialized || document.hidden) return;
    const elapsed = this.previousTime ? Math.min((time - this.previousTime) / 1000, .05) : 0;
    this.previousTime = time;
    if (!this.engaged() && !this.focused && !this.reducedMotion()) {
      const exit = this.roaming.advance(elapsed, window.innerWidth);
      if (this.behavior() !== this.roaming.behavior) {
        this.zone.run(() => this.behavior.set(this.roaming.behavior));
      }
      if (exit) {
        this.zone.run(() => {
          this.petTab.set(adjacentTab(this.petTab(), exit));
          this.roaming.enterFromEdge(exit, window.innerWidth);
        });
      }
    }
    this.layout();
    this.frame = requestAnimationFrame(next => this.tick(next));
  }

  private layout(): void {
    if (!this.initialized) return;
    const width = window.innerWidth;
    // Read the live tab edge, including its enter/leave transition and safe area.
    const floor = this.floorElement?.getBoundingClientRect();
    const viewport = window.visualViewport;
    const keyboardTop = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
    const keyboardInset = Math.max(0, window.innerHeight - keyboardTop);
    const tabBottom = floor && floor.height > 0 ? Math.max(0, window.innerHeight - floor.top) : 0;
    const bottom = Math.max(tabBottom, keyboardInset);
    this.host.nativeElement.style.setProperty('--pet-floor', `${bottom}px`);
    const pet = this.pet.nativeElement;
    pet.style.transform = `translateX(${this.roaming.x}px)`;
    pet.style.setProperty('--pet-facing', this.engaged() ? '1' : String(this.roaming.direction));
    const center = this.roaming.x + PET_WIDTH / 2;
    const menuWidth = Math.min(200, width - 24);
    const menuX = Math.max(12, Math.min(center - menuWidth / 2, width - menuWidth - 12));
    this.menu.nativeElement.style.left = `${menuX}px`;
    const feedbackWidth = Math.min(256, width - 24);
    const feedbackX = Math.max(12, Math.min(center - feedbackWidth / 2, width - feedbackWidth - 12));
    const feedback = this.feedback.nativeElement;
    feedback.style.left = `${feedbackX}px`;
    feedback.style.setProperty('--bubble-tip', `${Math.max(18, Math.min(center - feedbackX, feedbackWidth - 18))}px`);
    const visibleTop = viewport?.offsetTop ?? 0;
    const availableHeight = window.innerHeight - bottom - visibleTop;
    this.host.nativeElement.style.setProperty('--speech-max-height', `${Math.max(24, Math.min(140, availableHeight - 240))}px`);
    this.keyboardInput.nativeElement.style.top = `${visibleTop + 12}px`;
  }
}
