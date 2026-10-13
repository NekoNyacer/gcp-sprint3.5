import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { LocationStore } from '../../../shared/stores/location-store';
import { ProgressStore } from '../../../shared/stores/progress-store';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-joy-stick',
  templateUrl: './joy-stick.component.html',
  styleUrls: ['./joy-stick.component.scss'],
  imports: [DecimalPipe],
})
export class JoyStickComponent {
  protected readonly ls = inject(LocationStore);
  protected readonly ps = inject(ProgressStore);
  private joystickElement = viewChild.required<ElementRef<HTMLDivElement>>('joystick');
  readonly joystickTransform = signal('translate3d(0, 0, 0)');
  readonly isJoystickActive = signal(false);
  readonly mapBearing = signal(0);
  private joystickPointerId: number | null = null;
  private joystickScreenDirection = { x: 0, y: 0 };
  private joystickDirection = { latitude: 0, longitude: 0 };
  private joystickFrame: number | null = null;
  private lastJoystickFrameAt: number | null = null;

  startJoystick(event: PointerEvent): void {
    this.joystickPointerId = event.pointerId;
    this.joystickElement().nativeElement.setPointerCapture(event.pointerId);
    this.isJoystickActive.set(true);
    this.updateJoystick(event);
    this.lastJoystickFrameAt = performance.now();
    this.startJoystickLoop();
    event.preventDefault();
  }

  moveJoystick(event: PointerEvent): void {
    if (event.pointerId !== this.joystickPointerId) {
      return;
    }

    this.updateJoystick(event);
    event.preventDefault();
  }

  endJoystick(event: PointerEvent): void {
    if (event.pointerId !== this.joystickPointerId) {
      return;
    }

    const joystick = this.joystickElement().nativeElement;
    if (joystick.hasPointerCapture(event.pointerId)) {
      joystick.releasePointerCapture(event.pointerId);
    }

    this.joystickPointerId = null;
    this.joystickScreenDirection = { x: 0, y: 0 };
    this.joystickDirection = { latitude: 0, longitude: 0 };
    this.joystickTransform.set('translate3d(0, 0, 0)');
    this.isJoystickActive.set(false);
    this.stopJoystickLoop();
    event.preventDefault();
  }

  ngOnDestroy(): void {
    this.stopJoystickLoop();
  }

  setMapBearing(bearing: number): void {
    this.mapBearing.set(bearing);
    this.updateGeographicDirection();
  }

  private updateJoystick(event: PointerEvent): void {
    const joystick = this.joystickElement().nativeElement;
    const bounds = joystick.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const maxOffset = Math.max(1, Math.min(bounds.width, bounds.height) / 2 - 27);
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > maxOffset ? maxOffset / distance : 1;
    const offsetX = rawX * scale;
    const offsetY = rawY * scale;

    this.joystickTransform.set(`translate3d(${offsetX}px, ${offsetY}px, 0)`);
    this.joystickScreenDirection = {
      x: offsetX / maxOffset,
      y: -offsetY / maxOffset,
    };
    this.updateGeographicDirection();
  }

  private updateGeographicDirection(): void {
    const bearingRadians = (this.mapBearing() * Math.PI) / 180;
    const screenEast = this.joystickScreenDirection.x;
    const screenNorth = this.joystickScreenDirection.y;

    this.joystickDirection = {
      longitude: screenEast * Math.cos(bearingRadians) + screenNorth * Math.sin(bearingRadians),
      latitude: screenNorth * Math.cos(bearingRadians) - screenEast * Math.sin(bearingRadians),
    };
  }

  private simulatedStepRemainder = 0;
  private startJoystickLoop(): void {
    if (this.joystickFrame !== null) {
      return;
    }

    const tick = (timestamp: number): void => {
      this.joystickFrame = null;
      if (!this.isJoystickActive()) {
        return;
      }

      const previousTimestamp = this.lastJoystickFrameAt ?? timestamp;
      const elapsedSeconds = (timestamp - previousTimestamp) / 1000;
      this.lastJoystickFrameAt = timestamp;
      this.ls.moveDemoBy(
        this.joystickDirection.latitude,
        this.joystickDirection.longitude,
        elapsedSeconds,
      );
      const directionStrength = Math.hypot(
        this.joystickDirection.latitude,
        this.joystickDirection.longitude,
      );
      this.simulatedStepRemainder += directionStrength * elapsedSeconds * 2;

      const steps = Math.floor(this.simulatedStepRemainder);
      if (steps > 0) {
        this.ps.addSteps(steps);
        this.simulatedStepRemainder -= steps;
      }

      this.joystickFrame = requestAnimationFrame(tick);
    };

    this.joystickFrame = requestAnimationFrame(tick);
  }

  private stopJoystickLoop(): void {
    if (this.joystickFrame !== null) {
      cancelAnimationFrame(this.joystickFrame);
      this.joystickFrame = null;
    }

    this.lastJoystickFrameAt = null;
  }
}
