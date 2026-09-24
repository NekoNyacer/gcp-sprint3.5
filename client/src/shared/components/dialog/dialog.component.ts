import { Component, computed, inject, input, signal } from '@angular/core';
import { IonAlert } from '@ionic/angular';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.scss'],
  imports: [IonAlert],
})

/**共用的確認彈窗元件 */
export class DialogComponent {
  protected readonly dialogService = inject(DialogService);
  isDialogOpen = computed(() => this.dialogService.isDialogOpen());

  /**彈窗說明內容 */
  content = computed(() => this.dialogService.content());

  buttonHandler = computed(() => [
    /**副按鈕*/
    {
      text: computed(() => this.dialogService.config().subBtnTxt)(),
      role: 'cancel',
      handler: () => {
        this.dialogService.closeDialog('cancel');
      },
    },
    /**主按鈕 */
    {
      text: computed(() => this.dialogService.config().mainBtnTxt)(),
      role: 'confirm',
      handler: () => {
        this.dialogService.closeDialog('confirm');
      },
    },
  ]);

  onDialogDismiss() {
    this.dialogService.closeDialog('cancel');
  }
}
