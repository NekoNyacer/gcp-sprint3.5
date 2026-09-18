import { DecimalPipe } from '@angular/common';
import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { IonContent, IonIcon, IonFabButton, IonFab } from '@ionic/angular';
import { HomeMapComponent } from './home-map/home-map.component';

interface CloudDragStart {
  pointerId: number;
  clientX: number;
  clientY: number;
  translateX: number;
  translateY: number;
  minDeltaX: number;
  maxDeltaX: number;
  minDeltaY: number;
  maxDeltaY: number;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  imports: [IonFab, IonFabButton, IonContent, IonIcon, HomeMapComponent, DecimalPipe],
})
export class HomeComponent {
  @ViewChild('scene', { static: true })
  private sceneElement!: ElementRef<HTMLElement>;

  @ViewChild('waterCloud', { static: true })
  private waterCloudElement!: ElementRef<HTMLButtonElement>;

  //是否開啟地面
  readonly isGroundExpanded = signal(false);
  readonly isDraggingWaterCloud = signal(false);
  readonly waterCloudTransform = signal('translate3d(0, 0, 0)');

  private waterCloudPosition = { x: 0, y: 0 };
  private cloudDragStart: CloudDragStart | null = null;

  addEnergy(): void {
    console.log('獲取能量 100');
  }

  toggleGround(): void {
    this.isGroundExpanded.update((isExpanded) => !isExpanded);
  }

  closeGround(): void {
    this.isGroundExpanded.set(false);
  }

  startWaterCloudDrag(event: PointerEvent): void {
    const cloud = this.waterCloudElement.nativeElement;
    const sceneRect = this.sceneElement.nativeElement.getBoundingClientRect();
    const cloudRect = cloud.getBoundingClientRect();

    this.cloudDragStart = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      translateX: this.waterCloudPosition.x,
      translateY: this.waterCloudPosition.y,
      minDeltaX: sceneRect.left - cloudRect.left,
      maxDeltaX: sceneRect.right - cloudRect.right,
      minDeltaY: sceneRect.top - cloudRect.top,
      maxDeltaY: sceneRect.bottom - cloudRect.bottom - 96,
    };

    cloud.setPointerCapture(event.pointerId);
    this.isDraggingWaterCloud.set(true);
    event.preventDefault();
  }

  moveWaterCloud(event: PointerEvent): void {
    const dragStart = this.cloudDragStart;
    if (!dragStart || dragStart.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = this.clamp(
      event.clientX - dragStart.clientX,
      dragStart.minDeltaX,
      dragStart.maxDeltaX,
    );
    const deltaY = this.clamp(
      event.clientY - dragStart.clientY,
      dragStart.minDeltaY,
      dragStart.maxDeltaY,
    );

    this.waterCloudPosition = {
      x: dragStart.translateX + deltaX,
      y: dragStart.translateY + deltaY,
    };
    this.waterCloudTransform.set(
      `translate3d(${this.waterCloudPosition.x}px, ${this.waterCloudPosition.y}px, 0)`,
    );
    event.preventDefault();
  }

  endWaterCloudDrag(event: PointerEvent): void {
    if (this.cloudDragStart?.pointerId !== event.pointerId) {
      return;
    }

    const cloud = this.waterCloudElement.nativeElement;
    if (cloud.hasPointerCapture(event.pointerId)) {
      cloud.releasePointerCapture(event.pointerId);
    }

    this.cloudDragStart = null;
    this.isDraggingWaterCloud.set(false);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
  }
}
