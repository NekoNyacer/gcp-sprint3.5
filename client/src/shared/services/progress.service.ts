import { inject, Service } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';

/**使用者進入app時向firebase取得資訊 */
@Service()
export class ProgressService {
  private readonly fs = inject(Firestore);

  /**監聽本日運動紀錄 */
  watchDailyActivity(localDate: string = 'Asia/Taipei'): Observable<DailyActivity> {
    //if(!fs...) 沒取到本日紀錄...
    return of({
      localDate: '2026-09-08',
      sourceTotals: {},
      effectiveSteps: 0,
      earnedLightEnergy: 0,
      isDemo: false,
    });
  }

  /**監聽目前資源庫存 */
  watchInventory(): Observable<Inventory> {
    return of();
  }

  /**監聽小樹點餘額 LTP = Little Tree Point */
  watchLtp(): Observable<LittleTreePoint> {
    return of();
  }
}

type DailyActivity = {
  localDate: string; // Asia/Taipei，例如 2026-09-08
  sourceTotals: Record<string, number>; // 各步數來源的累計值
  effectiveSteps: number; // 多來源取最大值
  earnedLightEnergy: number; // 今日已取得的光能
  isDemo: boolean;
  updatedAt?: Date;
};

type Inventory = {};
type LittleTreePoint = {};
