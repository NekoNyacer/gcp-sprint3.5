import { Component, contentChild, EventEmitter, Input, Output, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IonModal } from '@ionic/angular';
import type { OverlayEventDetail } from '@ionic/core';
import { CubModalComponent } from './modal.component';
import { ModalContent, ModalService } from '../../services/modal.service';

@Component({
  selector: 'ion-modal',
  imports: [NgTemplateOutlet],
  template: '<ng-container [ngTemplateOutlet]="content() ?? null" />',
})
class TestSheetComponent {
  @Input() isOpen = false;
  @Input() breakpoints: number[] = [];
  @Input() initialBreakpoint = 0;
  @Input() handle = false;
  @Output() didDismiss = new EventEmitter<CustomEvent<OverlayEventDetail>>();
  readonly content = contentChild<TemplateRef<unknown>>(TemplateRef);

  dismiss(_data?: unknown, role?: string) {
    this.didDismiss.emit(new CustomEvent('didDismiss', { detail: { role } }));
    return Promise.resolve(true);
  }
}

describe('CubModalComponent', () => {
  function setup(content?: ModalContent, height: number | 'auto' = 0.35) {
    TestBed.configureTestingModule({ imports: [CubModalComponent] });
    TestBed.overrideComponent(CubModalComponent, {
      remove: { imports: [IonModal] },
      add: { imports: [TestSheetComponent] },
    });
    const fixture = TestBed.createComponent(CubModalComponent);
    const service = TestBed.inject(ModalService);
    const next = vi.fn();
    const complete = vi.fn();
    service.open(content ?? {
      title: '確定路線',
      description: '確定要挑戰本路線?',
      mainBtnText: '確認',
      subBtnText: '返回',
    }, height).subscribe({ next, complete });
    fixture.detectChanges();
    const sheet: TestSheetComponent =
      fixture.debugElement.query(By.directive(TestSheetComponent)).componentInstance;
    const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('ion-button'));
    return { fixture, service, sheet, buttons, next, complete };
  }

  it('renders a bottom sheet without unrelated badges or subtitles', () => {
    const { fixture, sheet, buttons } = setup();
    expect(sheet.isOpen).toBe(true);
    expect(sheet.breakpoints).toEqual([0, 0.35]);
    expect(sheet.initialBreakpoint).toBe(0.35);
    expect(sheet.handle).toBe(true);
    expect(fixture.nativeElement.querySelector('.modal-auto-content')).toBeNull();
    expect(fixture.nativeElement.querySelector('h1').textContent.trim()).toBe('確定路線');
    expect(fixture.nativeElement.querySelector('p').textContent).toBe('確定要挑戰本路線?');
    expect(fixture.nativeElement.querySelector('cub-badge')).toBeNull();
    expect(fixture.nativeElement.querySelector('h5')).toBeNull();
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['返回', '確認']);
  });

  it.each([
    { label: 'short content', description: '短優惠' },
    { label: 'long content', description: '優惠與使用條件。'.repeat(200) },
  ])(
    'uses natural content sizing with a capped scroll host for $label',
    ({ description }) => {
      const { fixture, sheet, buttons } = setup({
        appearance: 'supply-station',
        title: 'Demo 補給站',
        description,
        mainBtnText: '加入路線',
        subBtnText: '下次再來',
      }, 'auto');
      const modalElement = fixture.nativeElement.querySelector('ion-modal');
      const content = fixture.nativeElement.querySelector('.modal-auto-content');
      expect(sheet.breakpoints).toEqual([0, 1]);
      expect(sheet.initialBreakpoint).toBe(1);
      expect(fixture.nativeElement.querySelector('ion-content')).toBeNull();
      expect(content.classList.contains('ion-content-scroll-host')).toBe(true);
      expect(content.querySelector('p').textContent).toBe(description);
      expect(buttons.map((button) => button.textContent?.trim())).toEqual(['下次再來', '加入路線']);
      const modalStyle = getComputedStyle(modalElement);
      expect(modalStyle.getPropertyValue('--height').trim()).toBe('auto');
      expect(modalStyle.getPropertyValue('--sheet-max-height')).toContain('80dvh');
      expect(modalStyle.getPropertyValue('--sheet-max-height')).toContain('--ion-modal-offset-top');
      const contentStyle = getComputedStyle(content);
      expect(contentStyle.overflowY).toBe('auto');
      expect(contentStyle.maxHeight).toBe('var(--sheet-max-height)');
      expect(contentStyle.getPropertyValue('--ion-padding').trim()).toBe('20px');
      expect(contentStyle.paddingBottom).toContain('--ion-safe-area-bottom');
    },
  );

  it('preserves cancellation and confirmation for content-sized sheets', () => {
    const { buttons, next, service } = setup(undefined, 'auto');
    buttons[1].click();
    expect(next).toHaveBeenCalledExactlyOnceWith('confirm');
    expect(service.isOpen()).toBe(false);
  });

  it('renders the merchant, category, offer, terms and three badges in the station sheet', () => {
    const { fixture, buttons } = setup({
      appearance: 'supply-station',
      title: '台北咖啡工坊',
      stationBadges: { category: '美食', isCathayTwqrMerchant: true },
      subTitle: '買一送一 · 冰拿鐵 / 熱拿鐵',
      description: '單筆消費滿 NT$150 即可享；可與其他優惠併用。',
      otherBadges: ['有效期限 2026/10/31', '距離 0.2 km', '加入路線 約 +4 分鐘'],
      mainBtnText: '加入路線',
      subBtnText: '下次再來',
    });
    expect(fixture.nativeElement.querySelector('ion-modal').classList.contains('supply-station-sheet')).toBe(true);
    expect(fixture.nativeElement.querySelector('h1').textContent.trim()).toBe('台北咖啡工坊');
    const titleBadges = fixture.nativeElement.querySelector('.station-title-badges');
    expect(titleBadges.textContent).toContain('美食');
    expect(titleBadges.querySelector('.twqr-badge').getAttribute('aria-label')).toBe('國泰 TWQR 特店');
    expect(titleBadges.querySelector('img').getAttribute('src')).toBe('/images/assets/twqr-logo.svg');
    expect(titleBadges.querySelector('img').getAttribute('alt')).toBe('TWQR');
    const badgeContent: HTMLElement = titleBadges.querySelector('.twqr-badge-content');
    expect(badgeContent.children).toHaveLength(2);
    expect(badgeContent.children[0].tagName).toBe('IMG');
    expect(badgeContent.children[1].textContent).toBe('特店');
    const contentStyle = getComputedStyle(badgeContent);
    expect(contentStyle.display).toBe('inline-flex');
    expect(contentStyle.flexWrap).toBe('nowrap');
    expect(contentStyle.whiteSpace).toBe('nowrap');
    expect(getComputedStyle(badgeContent.children[0]).flexShrink).toBe('0');
    expect(fixture.nativeElement.querySelector('h5').textContent).toContain('買一送一');
    const badges = fixture.debugElement.queryAll(By.css('.badge-row cub-badge'));
    expect(badges.map((badge) => badge.nativeElement.textContent.trim())).toEqual([
      '有效期限 2026/10/31', '距離 0.2 km', '加入路線 約 +4 分鐘',
    ]);
    expect(badges.map((badge) => badge.componentInstance.color())).toEqual(['primary', 'light', 'light']);
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['下次再來', '加入路線']);
  });

  it('shows shopping in the title and omits the TWQR logo for a non-partner station', () => {
    const { fixture } = setup({
      appearance: 'supply-station',
      title: 'Demo 商店',
      stationBadges: { category: '購物', isCathayTwqrMerchant: false },
      description: 'Demo 示意優惠',
      mainBtnText: '加入路線',
      subBtnText: '下次再來',
    });
    expect(fixture.nativeElement.querySelector('.modal-title').textContent).toContain('購物');
    expect(fixture.nativeElement.querySelector('.twqr-badge')).toBeNull();
  });

  it.each([['confirm', 1], ['cancel', 0]] as const)(
    'dismisses with %s and emits only after dismissal',
    (action, index) => {
      const { sheet, buttons, service, next, complete } = setup();
      const dismiss = vi.spyOn(sheet, 'dismiss').mockResolvedValue(true);
      buttons[index].click();
      expect(dismiss).toHaveBeenCalledWith(undefined, action);
      expect(next).not.toHaveBeenCalled();
      expect(service.isOpen()).toBe(true);

      sheet.didDismiss.emit(new CustomEvent('didDismiss', { detail: { role: action } }));
      expect(next).toHaveBeenCalledExactlyOnceWith(action);
      expect(complete).toHaveBeenCalledTimes(1);
      expect(service.isOpen()).toBe(false);
      sheet.didDismiss.emit(new CustomEvent('didDismiss', { detail: { role: 'backdrop' } }));
      expect(next).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['backdrop', 'gesture', undefined])('cancels on %s dismissal', (role) => {
    const { sheet, next, service } = setup();
    sheet.didDismiss.emit(new CustomEvent('didDismiss', { detail: { role } }));
    expect(next).toHaveBeenCalledExactlyOnceWith('cancel');
    expect(service.isOpen()).toBe(false);
  });
});
