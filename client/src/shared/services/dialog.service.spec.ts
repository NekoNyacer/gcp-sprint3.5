import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog.service';
import { WalkResult } from '../models/walk-result';

describe('DialogService', () => {
  let service: DialogService;

  beforeEach(() => {
    service = TestBed.inject(DialogService);
  });

  it('snapshots a walk settlement and clears it for closure and other dialog types', () => {
    const result: WalkResult = {
      durationMinutes: 79, stationCount: 2, steps: 2184, distanceMeters: 1638,
      earnedLightEnergy: 2184, earnedWaterDrops: 50, earnedFertilizer: 0,
      lightEnergyBalance: 5946, waterDropsBalance: 777, fertilizerBalance: 5,
    };
    const actions: string[] = [];
    service.openWalkResultDialog(result).subscribe((action) => actions.push(action));
    result.steps = 9999;
    expect(service.walkResult()?.steps).toBe(2184);
    expect(service.config().title).toBe('成功抵達');
    expect(service.config().mainBtnTxt).toBe('太棒了!');
    expect(service.isNotifyDialog()).toBe(true);
    service.closeDialog('confirm');
    expect(actions).toEqual(['confirm']);
    expect(service.walkResult()).toBeNull();
    for (const open of [
      () => service.openDialog('Normal'),
      () => service.openNotifyDialog('Notification'),
      () => service.openTreePointResultDialog({ earnedPoints: 50, balance: 50, isDemo: true }),
    ]) {
      service.openWalkResultDialog(result);
      open();
      expect(service.walkResult()).toBeNull();
      service.closeDialog('confirm');
    }
  });

  it('opens confirmation dialogs with existing default button labels', () => {
    service.openDialog('Message');

    expect(service.isDialogOpen()).toBe(true);
    expect(service.isNotifyDialog()).toBe(false);
    expect(service.content()).toBe('Message');
    expect(service.config()).toEqual({ mainBtnTxt: '確認', subBtnTxt: '取消' });
  });

  it('supports an optional title and resets overrides for the next dialog', () => {
    service.openDialog('Message', { title: 'Heading', mainBtnTxt: 'Proceed' });
    expect(service.config()).toEqual({
      title: 'Heading',
      mainBtnTxt: 'Proceed',
      subBtnTxt: '取消',
    });

    service.closeDialog('cancel');
    service.openNotifyDialog('Next');

    expect(service.config()).toEqual({ mainBtnTxt: '確認', subBtnTxt: '取消' });
    expect(service.isNotifyDialog()).toBe(true);
  });

  it('emits one result, completes, and resets closed state', () => {
    const results: string[] = [];
    let completed = false;
    service.openNotifyDialog('Message').subscribe({
      next: (result) => results.push(result),
      complete: () => { completed = true; },
    });

    service.closeDialog('confirm');
    service.closeDialog('cancel');

    expect(results).toEqual(['confirm']);
    expect(completed).toBe(true);
    expect(service.isDialogOpen()).toBe(false);
    expect(service.isNotifyDialog()).toBe(false);
    expect(service.content()).toBe('');
  });

  it('preserves the subject and notification mode of a synchronously opened follow-up', () => {
    const results: string[] = [];
    service.openDialog('First').subscribe(() => {
      service.openNotifyDialog('Second').subscribe((result) => results.push(result));
    });

    service.closeDialog('confirm');

    expect(service.isDialogOpen()).toBe(true);
    expect(service.isNotifyDialog()).toBe(true);
    expect(service.content()).toBe('Second');

    service.closeDialog('confirm');
    expect(results).toEqual(['confirm']);
  });

  it('opens a notification with an immutable harvest-result snapshot and default copy', () => {
    const result = { earnedPoints: 120, balance: 2634, isDemo: true };
    service.openTreePointResultDialog(result);
    result.balance = 9999;

    expect(service.treePointResult()).toEqual({
      earnedPoints: 120,
      balance: 2634,
      isDemo: true,
    });
    expect(service.content()).toBe('今天的你也辛苦了！');
    expect(service.config()).toEqual({
      title: '收成完成',
      mainBtnTxt: '確認',
      subBtnTxt: '取消',
    });
    expect(service.isNotifyDialog()).toBe(true);
    expect(service.isDialogOpen()).toBe(true);

    service.closeDialog('confirm');
    expect(service.treePointResult()).toBeNull();
  });

  it('clears harvest data when opening regular confirmation or notification dialogs', () => {
    for (const notifyOnly of [false, true]) {
      service.openTreePointResultDialog({ earnedPoints: 50, balance: 100, isDemo: true });
      service.closeDialog('confirm');
      if (notifyOnly) service.openNotifyDialog('Normal');
      else service.openDialog('Normal');

      expect(service.treePointResult()).toBeNull();
      expect(service.config().title).toBeUndefined();
      service.closeDialog('cancel');
    }
  });
});
