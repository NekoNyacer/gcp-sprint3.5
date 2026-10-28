import { Component, contentChild, EventEmitter, Input, Output, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IonModal } from '@ionic/angular';
import type { OverlayEventDetail } from '@ionic/core';

import { DialogComponent } from './dialog.component';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'ion-modal',
  imports: [NgTemplateOutlet],
  template: '<ng-container [ngTemplateOutlet]="content() ?? null" />',
  host: { '[class]': 'cssClass' },
})
class TestModalComponent {
  @Input() isOpen = false;
  @Input() cssClass = '';
  @Output() didDismiss = new EventEmitter<CustomEvent<OverlayEventDetail>>();
  readonly content = contentChild<TemplateRef<unknown>>(TemplateRef);

  dismiss(_data?: unknown, role?: string) {
    this.didDismiss.emit(new CustomEvent('didDismiss', { detail: { role } }));
    return Promise.resolve(true);
  }
}

describe('DialogComponent', () => {
  let fixture: ComponentFixture<DialogComponent>;
  let service: DialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DialogComponent] });
    TestBed.overrideComponent(DialogComponent, {
      remove: { imports: [IonModal] },
      add: { imports: [TestModalComponent] },
    });
    fixture = TestBed.createComponent(DialogComponent);
    service = TestBed.inject(DialogService);
    fixture.detectChanges();
  });

  function buttons(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('ion-button'));
  }

  function modal(): TestModalComponent {
    return fixture.debugElement.query(By.directive(TestModalComponent)).componentInstance;
  }

  it('renders the message, optional title, and custom confirmation buttons', () => {
    service.openDialog('Message\nSecond line', {
      title: 'Heading',
      mainBtnTxt: 'Proceed',
      subBtnTxt: 'Stay',
    });
    fixture.detectChanges();

    expect(modal().isOpen).toBe(true);
    expect(fixture.nativeElement.querySelector('h2').textContent).toBe('Heading');
    expect(fixture.nativeElement.querySelector('p').textContent).toBe('Message\nSecond line');
    expect(buttons().map((button) => button.textContent?.trim())).toEqual(['Stay', 'Proceed']);
    expect(fixture.nativeElement.querySelector('ion-modal').getAttribute('aria-labelledby'))
      .toBe('shared-dialog-title');
  });

  it('renders notifications with only the main button and no default heading', () => {
    service.openNotifyDialog('Notification', { mainBtnTxt: 'Done' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h2')).toBeNull();
    expect(buttons().map((button) => button.textContent?.trim())).toEqual(['Done']);
    expect(fixture.nativeElement.querySelector('.dialog-actions').classList.contains('notify-only'))
      .toBe(true);
    expect(fixture.nativeElement.querySelector('ion-modal').getAttribute('aria-labelledby'))
      .toBe('shared-dialog-content');
  });

  it('renders the endpoint settlement with actual statistics, balances and one orange action', () => {
    const actions: string[] = [];
    service.openWalkResultDialog({
      durationMinutes: 79, stationCount: 2, steps: 2184, distanceMeters: 1638,
      earnedLightEnergy: 2184, earnedWaterDrops: 50, earnedFertilizer: 0,
      lightEnergyBalance: 5946, waterDropsBalance: 777, fertilizerBalance: 5,
    }).subscribe((action) => actions.push(action));
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(modal().cssClass).toContain('walk-result-modal');
    expect(root.querySelector('h2')?.textContent).toBe('成功抵達');
    expect(root.querySelector('.walk-badges')?.textContent).toContain('1 小時 19 分鐘');
    expect(root.querySelector('.station-badge')?.textContent).toContain('2 個補給站');
    expect(root.querySelector('.walk-stats')?.textContent).toContain('2,184');
    expect(root.querySelector('.walk-stats')?.textContent).toContain('1.6 km');
    expect(Array.from(root.querySelectorAll('.resource-earned strong')).map((node) => node.textContent))
      .toEqual(['+2,184', '+50']);
    expect(Array.from(root.querySelectorAll('.resource-balance strong')).map((node) => node.textContent))
      .toEqual(['5,946', '777']);
    expect(buttons().map((button) => button.textContent?.trim())).toEqual(['太棒了!']);
    buttons()[0].click();
    expect(actions).toEqual(['confirm']);
    service.openNotifyDialog('Normal');
    fixture.detectChanges();
    expect(root.querySelector('.walk-stats')).toBeNull();
    expect(modal().cssClass).toBe('shared-dialog-modal');
  });

  it('shows zero earnings honestly and includes fertilizer only when earned', () => {
    service.openWalkResultDialog({
      durationMinutes: 0, stationCount: 1, steps: 0, distanceMeters: 0,
      earnedLightEnergy: 0, earnedWaterDrops: 0, earnedFertilizer: 2,
      lightEnergyBalance: 5946, waterDropsBalance: 777, fertilizerBalance: 7,
    });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(Array.from(root.querySelectorAll('.resource-earned strong')).map((node) => node.textContent))
      .toEqual(['+0', '+0', '+2']);
    expect(root.querySelector('.walk-stats')?.textContent).toContain('0.0 km');
    expect(root.querySelector('.walk-badges')?.textContent).toContain('0 小時 0 分鐘');
  });

  it('shows a discovered mystery seed and its balance without leaking its species', () => {
    service.openWalkResultDialog({
      durationMinutes: 5, stationCount: 0, steps: 100, distanceMeters: 75,
      earnedLightEnergy: 100, earnedWaterDrops: 0, earnedFertilizer: 0,
      lightEnergyBalance: 100, waterDropsBalance: 0, fertilizerBalance: 0,
      earnedSeeds: 1, seedsBalance: 2,
    });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.walk-rewards')?.textContent).toContain('神秘種子');
    expect(root.querySelector('.walk-rewards')?.textContent).toContain('長成小樹後揭曉品種');
    expect(root.querySelector('.walk-rewards')?.textContent).not.toMatch(/榕樹|銀杏|櫻花/);
    expect(Array.from(root.querySelectorAll('.resource-balance strong')).at(-1)?.textContent).toBe('2');
  });

  it('renders a harvest summary with formatted points and only a confirmation button', () => {
    const results: string[] = [];
    service.openTreePointResultDialog({
      earnedPoints: 120,
      balance: 2634,
      isDemo: true,
    }).subscribe((result) => results.push(result));
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(modal().cssClass).toContain('tree-point-result-modal');
    expect(getComputedStyle(root.querySelector('ion-modal')!).zIndex).toBe('70000');
    expect(root.querySelector('h2')?.textContent).toBe('收成完成');
    expect(root.querySelector('p')?.textContent).toBe('今天的你也辛苦了！');
    expect(Array.from(root.querySelectorAll('dt')).map((label) => label.textContent))
      .toEqual(['本次獲得', '更新後小樹點']);
    expect(root.querySelector('.earned-points')?.textContent).toBe('+120');
    expect(root.querySelector('.points-balance')?.textContent).toBe('2,634');
    expect(root.querySelector('.result-demo')?.textContent).toBe('Demo');
    expect(buttons().map((button) => button.textContent?.trim())).toEqual(['確認']);

    buttons()[0].click();

    expect(results).toEqual(['confirm']);
    expect(service.isDialogOpen()).toBe(false);
  });

  it('removes the harvest card and styling when a normal dialog opens', () => {
    service.openTreePointResultDialog({ earnedPoints: 50, balance: 50, isDemo: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.result-demo')).toBeNull();
    service.closeDialog('confirm');
    service.openDialog('Normal');
    fixture.detectChanges();

    expect(modal().cssClass).toBe('shared-dialog-modal');
    expect(fixture.nativeElement.querySelector('.point-summary')).toBeNull();
    expect(fixture.nativeElement.querySelector('.tree-point-result')).toBeNull();
    expect(buttons()).toHaveLength(2);
  });

  it('confirms only after the modal dismissal event', () => {
    const results: string[] = [];
    let completed = false;
    service.openDialog('Confirm?').subscribe({
      next: (result) => results.push(result),
      complete: () => { completed = true; },
    });
    fixture.detectChanges();
    const dismiss = vi.spyOn(modal(), 'dismiss').mockResolvedValue(true);

    buttons()[1].click();
    expect(dismiss).toHaveBeenCalledWith(undefined, 'confirm');
    expect(results).toEqual([]);
    expect(service.isDialogOpen()).toBe(true);

    modal().didDismiss.emit(new CustomEvent('didDismiss', { detail: { role: 'confirm' } }));

    expect(results).toEqual(['confirm']);
    expect(completed).toBe(true);
    expect(service.isDialogOpen()).toBe(false);
  });

  it('returns cancel when the secondary button is clicked', () => {
    const results: string[] = [];
    service.openDialog('Confirm?').subscribe((result) => results.push(result));
    fixture.detectChanges();

    buttons()[0].click();

    expect(results).toEqual(['cancel']);
    expect(service.isDialogOpen()).toBe(false);
  });

  it('treats backdrop, back, and unspecified dismissals as cancel', () => {
    for (const role of ['backdrop', 'cancel', undefined]) {
      const results: string[] = [];
      service.openNotifyDialog('Notification').subscribe((result) => results.push(result));
      fixture.detectChanges();

      modal().didDismiss.emit(new CustomEvent('didDismiss', { detail: { role } }));

      expect(results).toEqual(['cancel']);
      expect(service.isNotifyDialog()).toBe(false);
    }
  });

  it('does not cancel a follow-up dialog opened by a confirmation subscriber', () => {
    const nextResults: string[] = [];
    service.openDialog('First').subscribe(() => {
      service.openNotifyDialog('Second').subscribe((result) => nextResults.push(result));
    });
    fixture.detectChanges();

    buttons()[1].click();
    fixture.detectChanges();

    expect(service.isDialogOpen()).toBe(true);
    expect(service.isNotifyDialog()).toBe(true);
    expect(fixture.nativeElement.querySelector('p').textContent).toBe('Second');
    buttons()[0].click();

    expect(nextResults).toEqual(['confirm']);
  });

  it('does not emit a second result after the service closes the dialog', () => {
    const results: string[] = [];
    service.openDialog('Confirm?').subscribe((result) => results.push(result));
    service.closeDialog('confirm');

    modal().didDismiss.emit(new CustomEvent('didDismiss', { detail: { role: 'backdrop' } }));

    expect(results).toEqual(['confirm']);
  });
});
