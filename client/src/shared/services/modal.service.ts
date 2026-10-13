import { computed, Service, signal } from '@angular/core';

const DEFAULT_MODAL_CONTENT: ModalContent = {
  title: '請輸入標題',
  description: '請輸入敘述',
  subBtnText: '關閉',
  mainBtnText: '確定',
  titleBadge: '+50 水',
  subTitle: '買一送一，冰拿鐵/熱拿鐵',
  otherBadges: ['有效期限 2026/10/31', '距離 0.2 km', '加入路線 +4 分鐘'],
};

@Service()
export class ModalService {
  readonly isOpen = signal(false);
  readonly breakPoint = signal([0, 0.25]);
  readonly initialBreakpoint = computed(() => this.breakPoint()[this.breakPoint().length - 1]);

  /**當下開啟modal的資料內容 */
  readonly modalContent = signal<ModalContent>(DEFAULT_MODAL_CONTENT);

  /**開啟底部視窗
   * @參數 content彈窗內容(請見型別定義)
   * @參數 breakPoint彈窗占畫面的高度比(0~1)
   */
  open(content: ModalContent = DEFAULT_MODAL_CONTENT, breakPoint?: number) {
    this.isOpen.set(true);
    this.breakPoint.set([0, breakPoint ?? 0.25]);
    this.modalContent.set(content);
  }

  close() {
    this.isOpen.set(false);
  }
}

export type ModalContent = {
  title: string;
  titleBadge: string;
  subTitle: string;
  description: string;
  otherBadges: string[];
  subBtnText: string;
  mainBtnText: string;
};
