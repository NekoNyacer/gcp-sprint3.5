import { TestBed } from '@angular/core/testing';
import { PresentationComponent } from './presentation.component';

describe('Angular presentation integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [PresentationComponent] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setup() {
    const fixture = TestBed.createComponent(PresentationComponent);
    fixture.detectChanges();
    const frame = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    const doc = document.implementation.createHTMLDocument();
    const location = { pathname: '/login' };
    const win = {
      location,
      history: {
        pushState: vi.fn((_state, _title, path) => {
          location.pathname = path;
        }),
      },
      dispatchEvent: vi.fn(),
    };
    Object.defineProperty(frame, 'contentDocument', { configurable: true, get: () => doc });
    Object.defineProperty(frame, 'contentWindow', { configurable: true, get: () => win });
    return { fixture, frame, doc, location, win, component: fixture.componentInstance };
  }

  it('queues a chapter before login, then switches without reloading the App frame', () => {
    const { fixture, frame, doc, location, component } = setup();
    const chapters = fixture.nativeElement.querySelectorAll('.rail-step');
    chapters[3].click();
    expect(component.note().title).toBe('先進入 App');
    expect(component.note().body).toContain('獎勵兌換');
    doc.body.innerHTML = '<app-shell><ion-tab-button tab="shop"></ion-tab-button></app-shell>';
    const button = doc.querySelector('ion-tab-button')!;
    const click = vi.spyOn(button as HTMLElement, 'click').mockImplementation(() => {
      location.pathname = '/shop';
    });
    location.pathname = '/home';
    component.syncApp();
    fixture.detectChanges();
    expect(click).toHaveBeenCalledOnce();
    expect(component.activeTab()).toBe('shop');
    expect(chapters[3].getAttribute('aria-current')).toBe('step');
    expect(frame.getAttribute('src')).toBe('/login');
    component.syncApp();
    expect(click).toHaveBeenCalledOnce();
  });

  it('follows App detail routes and uses history when a tab button is absent', () => {
    const { component, doc, location, win } = setup();
    doc.body.innerHTML = '<app-shell></app-shell>';
    location.pathname = '/task/demo-task';
    component.syncApp();
    expect(component.activeTab()).toBe('task');
    component.navigateApp('collection');
    expect(win.history.pushState).toHaveBeenCalledWith({}, '', '/collection');
    expect(win.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'popstate' }));
    expect(component.activeTab()).toBe('collection');
  });

  it('connects hover explanations and removes frame listeners and polling on destroy', () => {
    const { fixture, component, doc } = setup();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    doc.body.innerHTML = '<button>今日步數</button>';
    const remove = vi.spyOn(doc, 'removeEventListener');
    component.syncApp();
    doc.querySelector('button')!.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(component.note().title).toBe('今日步數');
    expect(component.note().label).toBe('功能說明');
    const sync = vi.spyOn(component, 'syncApp');
    fixture.destroy();
    for (const type of ['pointerover', 'focusin', 'click']) {
      expect(remove).toHaveBeenCalledWith(type, expect.any(Function), true);
    }
    vi.advanceTimersByTime(1000);
    expect(sync).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
