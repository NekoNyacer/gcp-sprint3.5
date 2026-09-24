import { effect, linkedSignal, Service, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Service()
export class DialogService {
  //追蹤點選了確認還是取消
  private dialogSubject: Subject<'confirm' | 'cancel'> | null = null;

  //追蹤彈窗是否開啟
  readonly isDialogOpen = signal(false);

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
  readonly config = signal<DialogConfig>({
    mainBtnTxt: '確認',
    subBtnTxt: '取消',
  });

  /**
   * 開啟彈窗的方法
   * @param content 彈窗內容，開啟時必須填入彈窗內容
   */
  openDialog(content: string, config?: DialogConfig) {
    this.config.update((v) => ({ ...v, ...config }));
    this.content.set(content);
    this.isDialogOpen.set(true);

    this.dialogSubject = new Subject<'confirm' | 'cancel'>();
    return this.dialogSubject.asObservable();
  }

  closeDialog(action: 'confirm' | 'cancel') {
    this.isDialogOpen.set(false);
    if (this.dialogSubject) {
      this.dialogSubject.next(action);
      this.dialogSubject.complete();
      this.dialogSubject = null;
    }
  }
}

type DialogConfig = {
  mainBtnTxt: string;
  subBtnTxt: string;
};
