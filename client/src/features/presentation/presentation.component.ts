import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import {
  INTERACTION_DESCRIPTIONS,
  PRESENTATION_TABS,
  PRESENTATION_TOPICS,
  PresentationTab,
} from './presentation.data';

@Component({
  selector: 'app-presentation',
  templateUrl: './presentation.component.html',
  styleUrl: './presentation.component.scss',
})
export class PresentationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('liveApp', { static: true }) private frame!: ElementRef<HTMLIFrameElement>;
  readonly tabs = PRESENTATION_TABS;
  readonly topics = PRESENTATION_TOPICS;
  readonly activeTab = signal<PresentationTab>('home');
  readonly topic = computed(() => this.topics[this.activeTab()]);
  readonly headline = computed(() =>
    this.topic()
      .headline.replace(/[，。]/g, '')
      .split('<br>'),
  );
  readonly note = signal({
    title: '進入 App',
    body: '在右側選擇「免登入進入 Demo」即可開始體驗，或使用 Google 登入。',
    label: '開始體驗',
  });
  private lastPath = '';
  private pendingTab: PresentationTab | null = null;
  private connectedDocument: Document | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private readonly interactionEvents = ['pointerover', 'focusin', 'click'] as const;

  ngAfterViewInit(): void {
    this.timer = setInterval(() => {
      if (!document.hidden) this.syncApp();
    }, 250);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    this.disconnectDocument();
  }

  navigateApp(tab: PresentationTab): void {
    const frame = this.frame.nativeElement;
    try {
      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      if (!win || !doc || win.location.pathname === '/login' || !doc.querySelector('app-shell')) {
        this.pendingTab = tab;
        this.setNote(
          '先進入 App',
          `在右側選擇「免登入進入 Demo」或使用 Google 登入，接著會帶你前往${this.topics[tab].title}。`,
          '開始體驗',
        );
        frame.focus();
        return;
      }
      this.pendingTab = null;
      const tabButton = doc.querySelector<HTMLElement>(`ion-tab-button[tab="${tab}"]`);
      if (tabButton) tabButton.click();
      else {
        win.history.pushState({}, '', '/' + tab);
        win.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      }
      this.syncApp();
    } catch {
      // Authentication can temporarily navigate the frame to another origin.
    }
  }

  syncApp(): void {
    try {
      const frame = this.frame.nativeElement;
      const doc = frame.contentDocument;
      if (!doc || !frame.contentWindow) return;
      if (this.connectedDocument !== doc) {
        this.disconnectDocument();
        this.connectedDocument = doc;
        for (const name of this.interactionEvents)
          doc.addEventListener(name, this.describeInteraction, true);
      }
      const pathname = frame.contentWindow.location.pathname;
      if (pathname === '/login') {
        if (this.lastPath !== pathname)
          this.setNote(
            '進入 App',
            '在右側選擇「免登入進入 Demo」即可開始體驗，或使用 Google 登入。',
            '開始體驗',
          );
      } else {
        const tab = pathname.split('/').filter(Boolean)[0];
        if (this.isTab(tab)) {
          if (this.lastPath !== pathname) {
            this.activeTab.set(tab);
            this.setNote(this.topics[tab].title, this.topics[tab].body);
          }
          this.lastPath = pathname;
          if (this.pendingTab && doc.querySelector('app-shell')) this.navigateApp(this.pendingTab);
          return;
        }
      }
      this.lastPath = pathname;
    } catch {
      // Resume synchronization when authentication returns to the same origin.
    }
  }

  private readonly describeInteraction = (event: Event): void => {
    if (!window.matchMedia('(min-width:901px)').matches) return;
    // Nodes come from the iframe realm; parent-window instanceof Element would fail.
    const element = event
      .composedPath()
      .find(
        (item): item is Element =>
          'nodeType' in item &&
          item.nodeType === 1 &&
          (item as Element).matches('ion-tab-button,ion-card,ion-button,button,[data-topic]'),
      );
    if (!element) return;
    const tab = element.closest('ion-tab-button')?.getAttribute('tab');
    if (this.isTab(tab)) {
      this.setNote(this.topics[tab].title, this.topics[tab].body, '功能說明');
      return;
    }
    const label = (
      element.getAttribute('aria-label') ||
      (element as HTMLElement).innerText ||
      element.textContent ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();
    const match = INTERACTION_DESCRIPTIONS.find(([pattern]) => pattern.test(label));
    if (match) this.setNote(match[1], match[2], '功能說明');
    else if (label && label.length <= 45) this.setNote(label, this.topic().body, '畫面說明');
  };

  private disconnectDocument(): void {
    for (const name of this.interactionEvents)
      this.connectedDocument?.removeEventListener(name, this.describeInteraction, true);
    this.connectedDocument = null;
  }

  private isTab(value: string | null | undefined): value is PresentationTab {
    return this.tabs.some((tab) => tab === value);
  }

  private setNote(title: string, body: string, label = '目前畫面'): void {
    this.note.set({ title, body, label });
  }
}
