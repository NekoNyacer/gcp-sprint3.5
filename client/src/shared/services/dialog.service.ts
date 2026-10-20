import { linkedSignal, Service, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { WalkResult } from '../models/walk-result';

const DEFAULT_DIALOG_CONFIG: DialogConfig = {
  mainBtnTxt: '確認',
  subBtnTxt: '取消',
};

@Service()
export class DialogService {
  //追蹤點選了確認還是取消
  private dialogSubject: Subject<'confirm' | 'cancel'> | null = null;
  //追蹤彈窗是否開啟
  readonly isDialogOpen = signal(false);
  //追蹤彈窗是否僅通知
  readonly isNotifyDialog = signal(false);
  readonly treePointResult = signal<TreePointResult | null>(null);
  readonly walkResult = signal<WalkResult | null>(null);

  //彈窗文字的內容
  readonly content = linkedSignal({
    source: this.isDialogOpen,
    computation: (source, previous) => {
      if (!source) {
        return '';
      }
      return previous?.value ?? '';
    },
  });

  //呼叫openDialog時，可客製彈窗的設定
  readonly config = signal<DialogConfig>(DEFAULT_DIALOG_CONFIG);

  /**
   * 開啟彈窗的方法
   * @param content 彈窗內容，開啟時必須填入彈窗內容
   */
  openDialog(content: string, config?: Partial<DialogConfig>) {
    this.walkResult.set(null);
    this.treePointResult.set(null);
    this.config.set({ ...DEFAULT_DIALOG_CONFIG, ...config });
    this.content.set(content);
    this.isNotifyDialog.set(false);
    this.isDialogOpen.set(true);

    this.dialogSubject = new Subject<'confirm' | 'cancel'>();
    return this.dialogSubject.asObservable();
  }

  closeDialog(action: 'confirm' | 'cancel') {
    const subject = this.dialogSubject;
    this.dialogSubject = null;
    this.isDialogOpen.set(false);
    this.isNotifyDialog.set(false);
    this.treePointResult.set(null);
    this.walkResult.set(null);
    subject?.next(action);
    subject?.complete();
  }

  /**僅通知的dialog，不讓用戶做選擇 */
  openNotifyDialog(content: string, config?: Partial<DialogConfig>) {
    this.walkResult.set(null);
    this.treePointResult.set(null);
    this.config.set({ ...DEFAULT_DIALOG_CONFIG, ...config });
    this.content.set(content);
    this.isNotifyDialog.set(true);
    this.isDialogOpen.set(true);
    this.dialogSubject = new Subject<'confirm' | 'cancel'>();
    return this.dialogSubject.asObservable();
  }

  /**僅通知的小樹點結算結果，不讓用戶做選擇 */
  openTreePointResultDialog(result: TreePointResult, config?: Partial<DialogConfig>) {
    const response = this.openNotifyDialog('今天的你也辛苦了！', {
      title: '收成完成',
      ...config,
    });
    this.treePointResult.set({ ...result });
    return response;
  }

  openWalkResultDialog(result: WalkResult) {
    const response = this.openNotifyDialog('今天的你也辛苦了！', {
      title: '成功抵達',
      mainBtnTxt: '太棒了!',
    });
    this.walkResult.set({ ...result });
    return response;
  }
}

export type DialogConfig = {
  title?: string;
  mainBtnTxt: string;
  subBtnTxt: string;
};

export type TreePointResult = {
  earnedPoints: number;
  balance: number;
  isDemo: boolean;
};
