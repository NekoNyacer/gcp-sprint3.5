import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { LocationStore } from '../../../shared/stores/location-store';
import { ProgressStore } from '../../../shared/stores/progress-store';
import { DecimalPipe } from '@angular/common';
import { MapCameraController } from '../home-map/map-camera.controller';
import {
  DEMO_JOYSTICK_DEAD_ZONE_RATIO,
  DEMO_JOYSTICK_TURN_SPEED_DEGREES_PER_SECOND,
} from '../../../environments/environment-dev';

const TURN_DAMPING_SECONDS = 0.25;

@Component({
  selector: 'app-joy-stick',
  templateUrl: './joy-stick.component.html',
  styleUrls: ['./joy-stick.component.scss'],
  imports: [DecimalPipe],
})
export class JoyStickComponent {
  protected readonly ls = inject(LocationStore);
  protected readonly ps = inject(ProgressStore);
  private readonly camera = inject(MapCameraController);
  private joystickElement = viewChild.required<ElementRef<HTMLDivElement>>('joystick');
  readonly joystickTransform = signal('translate3d(0, 0, 0)');
  readonly isJoystickActive = signal(false);
  readonly mapBearing = signal(0);
  private joystickPointerId: number | null = null;
  private joystickScreenDirection = { x: 0, y: 0 };
  private joystickHeading = 0;
  private joystickTurnRate = 0;
  private joystickFollowsPlayer = false;
  private joystickReferenceBearing = 0;
  private joystickFrame: number | null = null;
  private lastJoystickFrameAt: number | null = null;

  startJoystick(event: PointerEvent): void {
    this.joystickPointerId = event.pointerId;
    this.joystickFollowsPlayer = this.camera.isFollowingPlayer();
    this.joystickReferenceBearing = this.mapBearing();
    const heading = this.ls.current()?.heading;
    this.joystickHeading =
      typeof heading === 'number' && Number.isFinite(heading) ? heading : this.mapBearing();
    this.joystickTurnRate = 0;
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
    this.joystickTurnRate = 0;
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
    const radius = Math.min(distance / maxOffset, 1);
    const strength = Math.max(
      0,
      (radius - DEMO_JOYSTICK_DEAD_ZONE_RATIO) / (1 - DEMO_JOYSTICK_DEAD_ZONE_RATIO),
    );
    const directionScale = radius > 0 ? strength / radius : 0;

    this.joystickTransform.set(`translate3d(${offsetX}px, ${offsetY}px, 0)`);
    const direction = {
      x: (offsetX / maxOffset) * directionScale,
      y: (-offsetY / maxOffset) * directionScale,
    };
    if (Math.abs(direction.x) < 1e-6) direction.x = 0;
    if (Math.abs(direction.y) < 1e-6) direction.y = 0;
    if (
      Math.abs(direction.x - this.joystickScreenDirection.x) < 1e-6 &&
      Math.abs(direction.y - this.joystickScreenDirection.y) < 1e-6
    )
      return;
    this.joystickScreenDirection = direction;
    if (direction.x === 0) this.joystickTurnRate = 0;
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
      const elapsedSeconds = Math.min(Math.max((timestamp - previousTimestamp) / 1000, 0), 0.1);
      this.lastJoystickFrameAt = timestamp;
      const { x: steering, y: forward } = this.joystickScreenDirection;
      if (this.joystickFollowsPlayer) {
        const targetRate = steering * DEMO_JOYSTICK_TURN_SPEED_DEGREES_PER_SECOND;
        const blend = -Math.expm1(-elapsedSeconds / TURN_DAMPING_SECONDS);
        // Integrate the damped angular velocity exactly so turning is independent of frame rate.
        const turn =
          targetRate * elapsedSeconds +
          (this.joystickTurnRate - targetRate) * TURN_DAMPING_SECONDS * blend;
        this.joystickTurnRate += (targetRate - this.joystickTurnRate) * blend;
        this.joystickHeading = (((this.joystickHeading + turn) % 360) + 360) % 360;
        if (this.ls.current() && (forward !== 0 || turn !== 0)) {
          const radians = (this.joystickHeading * Math.PI) / 180;
          this.ls.moveDemoBy(
            forward * Math.cos(radians),
            forward * Math.sin(radians),
            elapsedSeconds,
            this.joystickHeading,
          );
          this.simulatedStepRemainder += Math.abs(forward) * elapsedSeconds * 2;
        }
      } else if (this.ls.current() && (forward !== 0 || steering !== 0)) {
        // Keep the gesture's reference fixed even if recenter enables camera rotation mid-gesture.
        const radians = (this.joystickReferenceBearing * Math.PI) / 180;
        this.ls.moveDemoBy(
          forward * Math.cos(radians) - steering * Math.sin(radians),
          forward * Math.sin(radians) + steering * Math.cos(radians),
          elapsedSeconds,
        );
        this.simulatedStepRemainder += Math.hypot(forward, steering) * elapsedSeconds * 2;
      }

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
