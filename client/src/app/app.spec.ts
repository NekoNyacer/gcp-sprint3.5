import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { ProgressSyncService } from '../shared/services/progress-sync.service';
import { SessionStore } from '../shared/stores/session-store';

describe('App', () => {
  const progressSync = {
    loading: signal(false),
    error: signal<string | null>(null),
    demoMode: signal(true),
  };

  beforeEach(async () => {
    progressSync.loading.set(false);
    progressSync.error.set(null);
    progressSync.demoMode.set(true);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: ProgressSyncService, useValue: progressSync },
        { provide: SessionStore, useValue: { enterDemo: vi.fn(), logOut: vi.fn() } },
        { provide: Firestore, useValue: {} },
      ],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the Ionic application shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('ion-app')).toBeTruthy();
    const routerOutlet = compiled.querySelector<HTMLElement & { swipeGesture: boolean }>(
      'ion-router-outlet',
    );
    expect(routerOutlet).toBeTruthy();
    expect(routerOutlet?.swipeGesture).toBe(false);
  });

  it('keeps the app shell visible when cloud progress synchronization fails', async () => {
    progressSync.error.set('無法載入散步資料');
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.sync-error-banner')).toBeTruthy();
    expect(compiled.querySelector('.sync-loading-overlay')).toBeFalsy();
    expect(compiled.querySelector('ion-router-outlet')).toBeTruthy();
  });
});
