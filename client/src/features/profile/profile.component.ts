import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { IonContent } from '@ionic/angular';
import { UserProfileService } from '../../shared/services/user-profile.service';
import { map } from 'rxjs';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  imports: [IonContent],
})
export class ProfileComponent {
  private readonly profileRepository = inject(UserProfileService);

  readonly profileResource = rxResource({
    defaultValue: null,
    stream: () => this.profileRepository.currentProfile$.pipe(map((profile) => profile ?? null)),
  });

  saveProfile(): void {
    this.profileRepository
      .saveCurrentProfile({
        displayName: '測試使用者',
        photoUrl: '',
        dailyGoal: 5000,
        onboardingStatus: 'completed',
      })
      .subscribe({
        next: () => {
          console.log('Firestore 寫入成功');
        },
        error: (error: unknown) => {
          console.error('Firestore 寫入失敗', error);
        },
      });
  }
}
