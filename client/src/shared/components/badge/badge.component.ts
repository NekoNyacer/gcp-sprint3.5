import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

/**客製Badge
 * @圖標 name屬性請輸入ionic icon的name，若不填則不顯示圖標
 * @顏色 預設light，可加入primary使其顯示主色
 * */
@Component({
  selector: 'cub-badge',
  templateUrl: './badge.component.html',
  styleUrls: ['./badge.component.scss'],
  imports: [IonIcon],
})
export class CubBadgeComponent {
  name = input();
  color = input<'primary' | 'light'>('light');
}
