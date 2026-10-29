import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionStore } from '../../../shared/stores/session-store';

import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  const sessionStore = {
    canAccessApp: signal(false),
    logInWithGoogle: vi.fn(),
    enterDemo: vi.fn(),
  };

  beforeEach(async () => {
    sessionStore.logInWithGoogle.mockReset();
    sessionStore.enterDemo.mockReset();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        {
          provide: SessionStore,
          useValue: sessionStore,
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the no-login entry for the local Demo mode', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('使用 Google 登入');
    expect(text).toContain('免登入進入 Demo');
    expect(text).not.toContain('匿名登入');
    expect(text).not.toContain('免登入進入遊戲');

    component.enterDemo();

    expect(sessionStore.enterDemo).toHaveBeenCalledWith('Demo五分鐘版');
  });
});
