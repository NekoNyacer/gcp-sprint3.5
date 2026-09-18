import { inject, Service } from '@angular/core';
import { getBytes, listAll, ref, Storage, uploadBytes } from '@angular/fire/storage';

@Service()
export class TransferStorageService {
  private readonly storage = inject(Storage);

  upload(file: File, direction: 'from' | 'to') {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `dev-transfer/${direction}/${Date.now()}-${safeName}`;
    const fileRef = ref(this.storage, path);

    return uploadBytes(fileRef, file, {
      contentType: file.type || 'application/octet-stream',
    });
  }

  list(direction: 'home-to-office' | 'office-to-home') {
    return listAll(ref(this.storage, `dev-transfer/${direction}`));
  }

  download(fileRef: Parameters<typeof getBytes>[0]) {
    return getBytes(fileRef, 200 * 1024 * 1024);
  }
}
