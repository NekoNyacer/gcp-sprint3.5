import { Component, inject } from '@angular/core';
import { TransferStorageService } from '../../services/transfer-storage.service';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss'],
  imports: [],
})
export class UploadComponent {
  private readonly transferStorage = inject(TransferStorageService);

  async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    console.log({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    try {
      await this.transferStorage.upload(file, 'from');
    } catch (error) {
      const e = error as any;
      console.error(e.code, e.message, e.serverResponse);
    }
  }
}
