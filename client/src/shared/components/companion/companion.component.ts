import {
  AfterViewInit, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild, computed, inject, signal,
} from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChipmunkAction, ChipmunkMotionComponent } from './chipmunk-motion.component';
import { AutonomousBehavior, CompanionRoaming, PET_WIDTH, adjacentTab, adjacentDragTab, companionTab, CompanionTab } from './companion-roaming';
import { CompanionChatService } from './companion-chat.service';
import { CompanionAgentService } from './companion-agent.service';
import { CompanionPettingComponent } from './companion-petting.component';
import { CompanionPlatforms, visibleCompanionLedges } from './companion-platforms';
import { CompanionDrag, CompanionDragPosition } from './companion-drag';
import { CompanionTabTransitionService } from './companion-tab-transition.service';

@Component({
  selector: 'app-companion',
  templateUrl: './companion.component.html',
  styleUrl: './companion.component.scss',
  imports: [ChipmunkMotionComponent, CompanionPettingComponent],
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
  readonly pettingOpen = signal(false);
  readonly talking = signal(false);
  readonly action = signal<ChipmunkAction>('walking');
  readonly behavior = signal<AutonomousBehavior>('walking');
  readonly jumping = signal(false);
  readonly jumpDirection = signal<'up' | 'down'>('up');
  readonly dragAction = signal<ChipmunkAction | null>(null);
  readonly motionProgress = signal<number | null>(null);
  readonly renderedAction = computed<ChipmunkAction>(() => this.engaged() ? this.action() : this.dragAction() ?? (this.reducedMotion() ? 'idle' : this.jumping() ? this.jumpDirection() === 'up' ? 'jumping-up' : 'jumping-down' : this.behavior()));
  readonly actionSerial = signal(0);
  readonly message = signal('嗨！你找到我了。今天也一起散步吧！');
  readonly speechVisible = signal(true);
  readonly reply = signal('');
  readonly draft = signal('');
  readonly chatPending = signal(false);
  readonly chatError = signal(false);
  readonly planning = signal(false);
  readonly applying = signal(false);
  readonly agent = inject(CompanionAgentService);
  readonly reducedMotion = signal(false);
  readonly roaming = new CompanionRoaming();
  private readonly platforms = new CompanionPlatforms(document);
  private readonly drag = new CompanionDrag();
  private dragPointer: number | null = null;
  private ignorePetClick = false;
  private dragEdge: 1 | -1 | null = null;
  private edgeNavigation: { target: CompanionTab } | null = null;
  private readonly zone = inject(NgZone);
  private readonly chat = inject(CompanionChatService);
  private readonly router = inject(Router, { optional: true });
  private readonly tabTransition = inject(CompanionTabTransitionService, { optional: true });
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
  private platformY: number | null = null;
  private focused = false;
  private actionTimer?: ReturnType<typeof setTimeout>;
  private speechTimer?: ReturnType<typeof setTimeout>;
  private composing = false;
  private chatSequence = 0;
  private lastMessage = '';
  private readonly resize = () => this.layout();
  private readonly visibility = () => { if (document.hidden) this.resetDrag(); this.restart(); };
  private readonly preferenceChanged = () => {
    this.reducedMotion.set(this.preference?.matches ?? false);
    this.roaming.keepVisible(window.innerWidth);
    this.restart();
  };
  private readonly outside = (event: PointerEvent) => {
    if (this.pettingOpen()) return;
    if (this.engaged() && event.target instanceof Node &&
      !this.pet.nativeElement.contains(event.target) && !this.menu.nativeElement.contains(event.target) &&
      !this.feedback.nativeElement.contains(event.target) &&
      event.target !== this.keyboardInput.nativeElement) {
      this.zone.run(() => this.close());
    }
  };
  private readonly keydown = (event: KeyboardEvent) => {
    if (this.pettingOpen()) return;
    if (event.key === 'Escape' && (this.drag.active || this.drag.tracking)) { this.resetDrag(); return; }
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
      if (event instanceof NavigationStart && this.edgeNavigation?.target !== companionTab(event.url)) this.close();
      if (event instanceof NavigationEnd) {
        const tab = companionTab(event.urlAfterRedirects);
        const carried = this.edgeNavigation?.target === tab;
        this.viewedTab.set(tab);
        if (carried && tab) this.petTab.set(tab);
        this.platforms.reset();
        if (!carried || (!this.drag.active && !this.drag.tracking)) this.platformY = null;
        this.jumping.set(false);
        this.restart();
      }
    });
    this.layout();
    this.restart();
  }

  greet(): void {
    if (this.applying()) return;
    this.cancelChat();
    this.planning.set(false);
    this.engaged.set(true);
    this.stopTalking();
    this.reply.set('');
    this.roaming.keepVisible(window.innerWidth);
    this.perform('greeting', '嗨！你找到我了。今天也一起散步吧！');
    this.layout();
  }

  petClick(event: MouseEvent): void {
    if (event.detail === 0 && !this.drag.active) this.ignorePetClick = false;
    if (!this.ignorePetClick && !this.drag.active) this.greet();
  }

  beginDrag(event: PointerEvent): void {
    if (event.button !== 0 || this.dragPointer !== null || this.applying() || this.pettingOpen() || this.engaged()) return;
    this.ignorePetClick = false;
    this.dragEdge = null;
    this.dragPointer = event.pointerId;
    this.drag.begin(event.clientX, event.clientY, this.roaming.x, this.platformY ?? window.innerHeight - this.floorBottom());
    this.pet.nativeElement.setPointerCapture?.(event.pointerId);
  }

  moveDrag(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointer) return;
    const base = window.innerHeight - this.floorBottom();
    if (!this.drag.move(event.clientX, event.clientY, window.innerWidth, window.innerHeight, base)) return;
    event.preventDefault(); this.ignorePetClick = true; this.focused = false;
    this.platforms.reset(); this.jumping.set(false);
    this.syncDrag(this.drag.advance(0, [], base, window.innerWidth, window.innerHeight));
    this.navigateDragEdge(event.clientX);
  }

  private navigateDragEdge(pointerX: number): void {
    const width = window.innerWidth;
    // Hysteresis: after crossing an edge, return inside before another switch.
    if (pointerX > 32 && pointerX < width - 32) { this.dragEdge = null; return; }
    const direction = pointerX <= 16 ? -1 : pointerX >= width - 16 ? 1 : null;
    if (!direction || direction === this.dragEdge || this.edgeNavigation || !this.router) return;
    this.dragEdge = direction;
    const current = this.viewedTab();
    const target = current && adjacentDragTab(current, direction);
    if (!target) return;
    const navigation = this.edgeNavigation = { target };
    // Own route events must preserve the captured pointer, including release
    // while the route is still loading. Failed navigation leaves the drag here.
    const change = () => this.router!.navigateByUrl(`/${target}`);
    const result = this.tabTransition ? this.tabTransition.navigate(target, direction, change) : change();
    void result.catch(() => false).finally(() => {
      if (this.edgeNavigation === navigation) this.edgeNavigation = null;
    });
  }

  endDrag(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointer) return;
    this.dragPointer = null;
    const base = window.innerHeight - this.floorBottom();
    const ledges = visibleCompanionLedges(document, base, window.innerWidth);
    if (this.drag.release(ledges, base, window.innerWidth, window.innerHeight)) {
      this.ignorePetClick = true; this.focused = false;
      this.syncDrag(this.drag.advance(0, ledges, base, window.innerWidth, window.innerHeight));
    }
    if (this.pet.nativeElement.hasPointerCapture?.(event.pointerId)) this.pet.nativeElement.releasePointerCapture(event.pointerId);
  }

  private resetDrag(): void {
    this.edgeNavigation = null; this.dragEdge = null;
    this.tabTransition?.cancel();
    const pointer = this.dragPointer;
    this.dragPointer = null;
    if (pointer !== null && this.pet?.nativeElement.hasPointerCapture?.(pointer)) this.pet.nativeElement.releasePointerCapture(pointer);
    if (this.drag.active || this.drag.tracking) {
      this.platforms.reset(); this.platformY = null; this.roaming.keepVisible(window.innerWidth); this.roaming.observeFor();
    }
    this.drag.cancel(); this.dragAction.set(null); this.motionProgress.set(null);
  }

  private syncDrag(state: CompanionDragPosition): void {
    this.roaming.x = state.x; this.platformY = state.y;
    if (state.settled) {
      this.platforms.adopt(state.support, state.y); this.roaming.observeFor();
      if (!state.support) this.platformY = null;
    }
    const action: ChipmunkAction | null = state.phase === 'pickup' ? 'pickup' : state.phase === 'held' ? 'held' : state.phase === 'falling' || state.phase === 'landing' ? 'falling' : null;
    this.zone.run(() => {
      if (this.dragAction() !== action) { this.dragAction.set(action); this.actionSerial.update(serial => serial + 1); }
      this.motionProgress.set(state.phase === 'landing' ? .75 + .25 * (state.progress ?? 0) : state.phase === 'falling' ? .75 * (state.progress ?? 0) : state.progress ?? null);
      if (state.settled) { this.motionProgress.set(null); this.behavior.set('idle'); }
    });
    this.layout();
  }

  petChipmunk(): void {
    if (this.applying()) return;
    this.cancelChat();
    this.planning.set(false);
    this.stopTalking();
    this.reply.set('');
    clearTimeout(this.actionTimer);
    this.pettingOpen.set(true);
  }

  closePetting(): void {
    this.pettingOpen.set(false);
    this.perform('greeting', '謝謝你陪我玩！');
    this.pet.nativeElement.focus({ preventScroll: true });
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

  planWalk(): void {
    if (this.chatPending() || this.applying()) return;
    this.agent.cancel();
    this.planning.set(true);
    this.talk();
    this.message.set('想走幾分鐘？也可以說「20 分鐘，順便補水」。我會安排單程路線。');
  }

  async applyPlan(): Promise<void> {
    if (this.applying() || !this.agent.proposal()) return;
    this.applying.set(true);
    try {
      await this.agent.apply();
      this.applying.set(false);
      this.close();
    } catch (error) {
      // A failed navigation/validation keeps the proposal reviewable and retryable.
      this.message.set(error instanceof Error ? error.message : '路線未套用，請重新安排。');
    } finally { this.applying.set(false); }
  }

  async send(text: string): Promise<void> {
    if (!text.trim() || this.chatPending()) return;
    this.lastMessage = text.trim().slice(0, 200);
    this.reply.set(this.lastMessage);
    this.stopTalking();
    this.chatPending.set(true);
    this.chatError.set(false);
    this.perform('thinking', '嗯，讓我想想…');
    const sequence = ++this.chatSequence;
    try {
      const response = this.planning() ? await this.agent.reply(this.lastMessage) : await this.chat.reply(this.lastMessage);
      if (sequence !== this.chatSequence || !this.engaged()) return;
      this.perform(this.planning() && this.agent.proposal() ? 'success' : 'greeting', response);
    } catch (error) {
      if (sequence !== this.chatSequence || !this.engaged()) return;
      this.chatError.set(true);
      const failure = error as { code?: string; message?: string };
      this.message.set(this.planning() && failure.message && !failure.code ? failure.message : failure.code === 'functions/resource-exhausted' && failure.message
        ? failure.message : '暫時連不上對話服務，點「重試」再試一次。');
      this.action.set('confused');
      this.actionSerial.update(serial => serial + 1);
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
    if (this.applying()) return;
    this.resetDrag();
    this.cancelChat();
    this.pettingOpen.set(false);
    this.planning.set(false);
    clearTimeout(this.actionTimer);
    clearTimeout(this.speechTimer); this.speechVisible.set(false);
    this.engaged.set(false);
    this.stopTalking();
    this.reply.set('');
    this.focused = false;
    if (document.activeElement === this.pet?.nativeElement) this.pet.nativeElement.blur();
    this.action.set('walking');
  }

  focusPet(focused: boolean): void { this.focused = focused; }

  ngOnDestroy(): void {
    this.resetDrag();
    this.cancelChat();
    this.chat.reset();
    this.initialized = false;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.actionTimer);
    clearTimeout(this.speechTimer);
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
    if (!this.applying()) this.agent.cancel();
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
    clearTimeout(this.speechTimer); this.speechVisible.set(true);
    if (action !== 'thinking') this.speechTimer = setTimeout(() => this.speechVisible.set(false), 5000);
    if (action !== 'thinking') this.actionTimer = setTimeout(() => this.action.set('idle'), 1800);
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
    const baseY = window.innerHeight - this.floorBottom();
    if (this.drag.active || this.drag.tracking) {
      this.syncDrag(this.drag.advance(elapsed, visibleCompanionLedges(document, baseY, window.innerWidth), baseY, window.innerWidth, window.innerHeight));
      this.frame = requestAnimationFrame(next => this.tick(next));
      return;
    }
    const moving = !this.engaged() && !this.focused && !this.drag.tracking && !this.reducedMotion();
    let exit: 1 | -1 | null = null;
    if (moving) {
      exit = this.roaming.advance(elapsed, window.innerWidth);
      if (this.behavior() !== this.roaming.behavior) {
        this.zone.run(() => this.behavior.set(this.roaming.behavior));
      }
    }
    const platform = this.platforms.advance(moving && (this.roaming.behavior === 'walking' || this.jumping()) ? elapsed : 0,
      this.roaming.x, baseY, window.innerWidth, this.isHere() && !this.reducedMotion());
    this.roaming.x = platform.x;
    if (platform.direction) this.roaming.direction = platform.direction;
    this.platformY = platform.y;
    const nextProgress = platform.jumping ? platform.progress ?? null : null;
    if ((platform.jumpDirection && this.jumpDirection() !== platform.jumpDirection) || this.motionProgress() !== nextProgress) this.zone.run(() => {
      if (platform.jumpDirection && this.jumpDirection() !== platform.jumpDirection) this.jumpDirection.set(platform.jumpDirection);
      this.motionProgress.set(nextProgress);
    });
    if (this.jumping() !== platform.jumping) {
      this.zone.run(() => {
        this.jumping.set(platform.jumping);
        if (platform.jumping) this.actionSerial.update(serial => serial + 1);
      });
    }
    if (exit && platform.exitAllowed && (exit === 1 ? this.roaming.x >= window.innerWidth + 8 : this.roaming.x <= -PET_WIDTH - 8)) {
      this.zone.run(() => {
        this.petTab.set(adjacentTab(this.petTab(), exit!));
        this.roaming.enterFromEdge(exit!, window.innerWidth);
        this.platforms.reset();
        this.platformY = null;
        this.jumping.set(false);
      });
    }
    this.layout();
    this.frame = requestAnimationFrame(next => this.tick(next));
  }

  private layout(): void {
    if (!this.initialized) return;
    const width = window.innerWidth;
    // Read the live tab edge, including its enter/leave transition and safe area.
    const viewport = window.visualViewport;
    const keyboardTop = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
    const keyboardInset = Math.max(0, window.innerHeight - keyboardTop);
    const bottom = Math.max(this.platformY === null ? this.floorBottom() : window.innerHeight - this.platformY, keyboardInset);
    this.host.nativeElement.style.setProperty('--pet-floor', `${bottom}px`);
    const pet = this.pet.nativeElement;
    pet.style.transform = `translateX(${this.roaming.x}px)`;
    pet.style.setProperty('--pet-facing', this.engaged() ? '1' : String(this.roaming.direction));
    const center = this.roaming.x + PET_WIDTH / 2;
    const menuWidth = Math.min(264, width - 24);
    const menuX = Math.max(12, Math.min(center - menuWidth / 2, width - menuWidth - 12));
    this.menu.nativeElement.style.left = `${menuX}px`;
    const feedbackWidth = Math.min(256, width - 24);
    const feedbackX = Math.max(12, Math.min(center - feedbackWidth / 2, width - feedbackWidth - 12));
    const feedback = this.feedback.nativeElement;
    feedback.style.left = `${feedbackX}px`;
    feedback.style.setProperty('--bubble-tip', `${Math.max(18, Math.min(center - feedbackX, feedbackWidth - 18))}px`);
    const visibleTop = viewport?.offsetTop ?? 0;
    this.host.nativeElement.style.setProperty('--menu-floor', `${Math.min(bottom + 110, window.innerHeight - visibleTop - 86)}px`);
    this.host.nativeElement.style.setProperty('--feedback-floor', `${Math.min(bottom + 204, window.innerHeight - visibleTop - 56)}px`);
    const availableHeight = window.innerHeight - bottom - visibleTop;
    this.host.nativeElement.style.setProperty('--speech-max-height', `${Math.max(40, Math.min(360, availableHeight - 240))}px`);
    this.keyboardInput.nativeElement.style.top = `${visibleTop + 12}px`;
  }

  private floorBottom(): number {
    const floor = this.floorElement?.getBoundingClientRect();
    return floor && floor.height > 0 ? Math.max(0, window.innerHeight - floor.top) : 0;
  }
}
