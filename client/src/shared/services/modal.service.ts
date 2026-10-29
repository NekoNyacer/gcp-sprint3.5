import { computed, Service, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { SupplyStationInfo } from '../models/walk-task.models';

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
  private modalSubject: Subject<ModalAction> | null = null;
  readonly isOpen = signal(false);
  readonly autoHeight = signal(false);
  readonly breakPoint = signal([0, 0.25]);
  readonly initialBreakpoint = computed(() => this.breakPoint()[this.breakPoint().length - 1]);

  /**當下開啟modal的資料內容 */
  readonly modalContent = signal<ModalContent | TreeProfile>(DEFAULT_MODAL_CONTENT);

  /**開啟底部視窗
   * @參數 content彈窗內容(請見型別定義)
   * @參數 breakPoint彈窗占畫面的高度比(0~1)，或 auto 依內容自動決定高度
   */
  open(content: ModalContent = DEFAULT_MODAL_CONTENT, breakPoint?: number | 'auto') {
    this.close();
    this.modalSubject = new Subject<ModalAction>();
    this.autoHeight.set(breakPoint === 'auto');
    this.breakPoint.set([0, breakPoint === 'auto' ? 1 : (breakPoint ?? 0.25)]);
    this.modalContent.set(content);
    this.isOpen.set(true);
    return this.modalSubject.asObservable();
  }

  openTreeInfo(content: TreeProfile) {
    this.close();
    this.autoHeight.set(false);
    this.isOpen.set(true);
    this.breakPoint.set([0, 0.5]);
    this.modalContent.set(content);
  }

  close(action: ModalAction = 'cancel') {
    const subject = this.modalSubject;
    this.modalSubject = null;
    this.isOpen.set(false);
    subject?.next(action);
    subject?.complete();
  }
}

export type ModalAction = 'confirm' | 'cancel';

export type ModalContent = {
  title: string;
  appearance?: 'supply-station';
  stationBadges?: Pick<SupplyStationInfo, 'category' | 'isCathayTwqrMerchant'>;
  titleBadge?: string;
  subTitle?: string;
  description: string;
  otherBadges?: string[];
  subBtnText: string;
  mainBtnText: string;
};

export type TreeProfile = {
  seq: number;
  name: string;
  treeType: '櫻花' | '柿子' | '榕樹';
  img: string;
  status: '未發芽' | '茁壯中' | '可收成';
};
