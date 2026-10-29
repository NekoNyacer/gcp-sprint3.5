import { TestBed } from '@angular/core/testing';
import { ModalContent, ModalService } from './modal.service';

describe('ModalService', () => {
  const content: ModalContent = {
    title: '確定路線',
    description: '確定要挑戰本路線?',
    mainBtnText: '確認',
    subBtnText: '返回',
  };

  it.each(['confirm', 'cancel'] as const)('emits %s once and completes', (action) => {
    const service = TestBed.inject(ModalService);
    const next = vi.fn();
    const complete = vi.fn();
    service.open(content, 0.35).subscribe({ next, complete });

    expect(service.isOpen()).toBe(true);
    expect(service.modalContent()).toEqual(content);
    expect(service.initialBreakpoint()).toBe(0.35);
    expect(service.autoHeight()).toBe(false);
    service.close(action);
    service.close();

    expect(next).toHaveBeenCalledExactlyOnceWith(action);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(service.isOpen()).toBe(false);
  });

  it('preserves default content and cancels an outstanding result when replaced', () => {
    const service = TestBed.inject(ModalService);
    const next = vi.fn();
    const complete = vi.fn();
    service.open(content).subscribe({ next, complete });
    service.open();

    expect(next).toHaveBeenCalledExactlyOnceWith('cancel');
    expect(complete).toHaveBeenCalledTimes(1);
    expect(service.isOpen()).toBe(true);
    expect(service.initialBreakpoint()).toBe(0.25);
    expect(service.modalContent()).toMatchObject({
      titleBadge: '+50 水',
      mainBtnText: '確定',
      subBtnText: '關閉',
    });
  });

  it('opens content-sized sheets fully and restores fixed sizing on the next open', () => {
    const service = TestBed.inject(ModalService);
    service.open(content, 'auto');
    expect(service.autoHeight()).toBe(true);
    expect(service.breakPoint()).toEqual([0, 1]);
    expect(service.initialBreakpoint()).toBe(1);

    service.open(content, 0.2);
    expect(service.autoHeight()).toBe(false);
    expect(service.breakPoint()).toEqual([0, 0.2]);
    service.open(content, 'auto');
    service.open();
    expect(service.autoHeight()).toBe(false);
    expect(service.initialBreakpoint()).toBe(0.25);
  });

  it('preserves a synchronously opened follow-up when closing', () => {
    const service = TestBed.inject(ModalService);
    const next = vi.fn();
    service.open(content).subscribe(() => {
      service.open(content).subscribe(next);
    });

    service.close('confirm');
    expect(service.isOpen()).toBe(true);
    service.close('cancel');
    expect(next).toHaveBeenCalledExactlyOnceWith('cancel');
  });

  it('cancels pending actions when opening a tree profile', () => {
    const service = TestBed.inject(ModalService);
    const next = vi.fn();
    service.open(content, 'auto').subscribe(next);
    service.openTreeInfo({
      seq: 1, name: 'Tree', treeType: '榕樹', img: '', status: '未發芽',
    });

    expect(next).toHaveBeenCalledExactlyOnceWith('cancel');
    expect(service.isOpen()).toBe(true);
    expect(service.initialBreakpoint()).toBe(0.5);
    expect(service.autoHeight()).toBe(false);
  });
});
