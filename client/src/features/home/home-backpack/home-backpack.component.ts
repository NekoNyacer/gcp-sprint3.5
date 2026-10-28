import { Component, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { IonLabel, IonModal, IonSegment, IonSegmentButton } from '@ionic/angular';
import { SessionStore } from '../../../shared/stores/session-store';
import type { BackpackSeed } from '../../../shared/models/backpack-seed';
import { SeedArtComponent } from './seed-art.component';

@Component({
  selector: 'home-backpack',
  templateUrl: './home-backpack.component.html',
  styleUrl: './home-backpack.component.scss',
  imports: [
    FormsModule,
    DecimalPipe,
    IonLabel,
    IonModal,
    IonSegment,
    IonSegmentButton,
    SeedArtComponent,
  ],
})
export class HomeBackpackComponent {
  private readonly session = inject(SessionStore);
  private readonly sheet = viewChild<IonModal>('sheet');
  private readonly nameDialog = viewChild<IonModal>('nameDialog');
  readonly open = input(false);
  readonly seeds = input.required<BackpackSeed[]>();
  readonly fertilizer = input(0);
  readonly canPlant = input(false);
  readonly canFertilize = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly plant = output<{ id: string; name: string }>();
  readonly fertilize = output<void>();
  readonly segment = signal<'seeds' | 'items'>('seeds');
  readonly selectedSeed = signal<BackpackSeed | null>(null);
  readonly nameError = signal('');
  readonly submitting = signal(false);
  seedName = '';

  selectSeed(seed: BackpackSeed): void {
    if (!this.open() || !this.canPlant() || !this.seeds().some((s) => s.id === seed.id)) return;
    this.seedName = `${(this.session.displayName() || '健走旅人').slice(0, 38)}的樹`;
    this.nameError.set('');
    this.submitting.set(false);
    this.selectedSeed.set(seed);
  }

  confirmPlant(): void {
    const seed = this.selectedSeed();
    if (!seed || this.submitting() || !this.open()) return;
    const name = this.seedName.trim();
    if (!name || name.length > 40) {
      this.nameError.set('請輸入 1 至 40 字的名字。');
      return;
    }
    if (!this.canPlant() || !this.seeds().some((s) => s.id === seed.id)) {
      this.nameError.set('目前無法種植，請返回背包重新選擇。');
      return;
    }
    this.submitting.set(true);
    this.plant.emit({ id: seed.id, name });
    // The parent commits synchronously and closes the drawer only on success.
    this.submitting.set(false);
  }

  close(): void {
    void this.sheet()?.dismiss();
  }
  cancelName(): void {
    void this.nameDialog()?.dismiss();
  }
  onSheetDismiss(): void {
    this.selectedSeed.set(null);
    void this.nameDialog()?.dismiss();
    this.closed.emit();
  }
}
