import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog.service';

describe('DialogService', () => {
  let service: DialogService;

  beforeEach(() => {
    service = TestBed.inject(DialogService);
  });

  it('restores the default buttons after a customized dialog', () => {
    service.openDialog('確定要離開目前房間嗎？', {
      mainBtnTxt: '離開房間',
      subBtnTxt: '繼續遊戲',
    });
    service.closeDialog('cancel');

    service.openDialog('確認是否換下一位玩家發言?');

    expect(service.config()).toEqual({
      mainBtnTxt: '確認',
      subBtnTxt: '取消',
    });
  });
});
