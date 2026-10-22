import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { IonChip, IonContent, IonModal } from '@ionic/angular';
import { RoutedWalkTaskPoint, supplyRewardLabel } from '../../../shared/models/walk-task.models';
import { LocationStore } from '../../../shared/stores/location-store';
import { ProgressStore } from '../../../shared/stores/progress-store';
import { WalkSessionStore } from '../../../shared/stores/walk-session-store';
import { TREE_CULTIVATION_RADIUS_METERS } from '../../../environments/environment-dev';
import {
  haversineDistanceMeters,
  isValidGeoPoint,
  isWithinGeoRadius,
} from '../../../shared/models/geo-distance';
import { SupplyStationSpin } from './supply-station-spin';

@Component({
  selector: 'home-supply-station',
  templateUrl: './home-supply-station.component.html',
  styleUrl: './home-supply-station.component.scss',
  imports: [IonChip, IonContent, IonModal],
})
export class HomeSupplyStationComponent implements OnDestroy {
  private readonly ls = inject(LocationStore);
  private readonly ps = inject(ProgressStore);
  private readonly ws = inject(WalkSessionStore);
  readonly station = input<RoutedWalkTaskPoint | null>(null);
  private readonly modal = viewChild(IonModal);
  private readonly spin = new SupplyStationSpin();
  private capture: { element: HTMLElement; id: number } | null = null;
  private frame = 0;
  private dismissing = false;
  private destroyed = false;
  readonly rotation = signal(0);
  readonly turnProgress = signal(0);
  readonly dragging = signal(false);
  readonly rotating = signal(false);
  readonly canCheckIn = computed(() => {
    const station = this.station();
    return (
      !!station &&
      this.ws.hasActiveRoute() &&
      (this.ws.isWalking() || this.ws.isArrived()) &&
      this.ws.taskPoints().some(point => point.id === station.id) &&
      !this.claimUnavailable() &&
      isWithinGeoRadius(this.ls.current(), station.position, TREE_CULTIVATION_RADIUS_METERS)
    );
  });
  readonly claimed = computed(() => {
    const station = this.station();
    return !!station && this.ws.checkedInTaskIds().includes(station.id);
  });
  readonly firstTime = computed(() => {
    const station = this.station();
    return !!station && !this.ps.hasClaimedDemoSupplyToday(station.id);
  });
  readonly claimUnavailable = computed(() => this.claimed() || !this.firstTime());
  readonly accessMessage = computed(() => {
    const station = this.station();
    if (!station || this.claimUnavailable() || this.canCheckIn()) return null;
    if (!this.ws.hasActiveRoute() || !this.ws.taskPoints().some(point => point.id === station.id)) {
      return '本次路線已結束或補給站已變更，請返回地圖。';
    }
    const position = this.ls.current();
    if (!isValidGeoPoint(position)) return '尚無有效定位，取得定位並靠近後即可打卡。';
    const distance = Math.ceil(haversineDistanceMeters(position, station.position));
    return `請靠近一點再進行打卡。`;
  });
  readonly error = computed(() => this.ws.checkInError());
  readonly checkIn = output();
  readonly feedbackRequested = output<string>();
  readonly closed = output();
  readonly closing = output();
  readonly rewardLabel = computed(() => {
    const station = this.station();
    return station ? supplyRewardLabel(station.supplyStation.supply) : '';
  });
  readonly feedbackMessage = computed(() => {
    const error = this.error();
    if (error) return error;
    if (this.claimed()) {
      return `打卡成功！已領取 ${this.rewardLabel()}，本次散步不可重複領取。`;
    }
    if (!this.firstTime()) return '本日已領取成功，不可重複領取。';
    return this.accessMessage();
  });
  constructor() {
    afterNextRender(() => {
      window.addEventListener('blur', this.interrupted);
      document.addEventListener('visibilitychange', this.visibilityChanged);
    });
    effect(() => {
      this.station();
      untracked(() => {
        this.stopMotion();
        this.spin.reset();
        this.rotation.set(0);
        this.turnProgress.set(0);
        this.dismissing = false;
      });
    });
    effect(() => {
      const station = this.station();
      const message = this.feedbackMessage();
      if (station && message) {
        untracked(() => this.feedbackRequested.emit(message));
      }
    });
  }

  beginSpin(event: PointerEvent): void {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      !this.canStart() ||
      !(event.currentTarget instanceof HTMLElement)
    )
      return;
    const element = event.currentTarget;
    const diameter = element.getBoundingClientRect().width;
    if (diameter <= 0) return;
    event.preventDefault();
    this.stopMotion();
    this.spin.begin(event.clientX, performance.now(), diameter);
    this.capture = { element, id: event.pointerId };
    element.setPointerCapture(event.pointerId);
    this.dragging.set(true);
    this.publish(false);
  }

  moveSpin(event: PointerEvent): void {
    if (this.capture?.id !== event.pointerId || !event.isPrimary) return;
    if (!this.canContinue()) {
      this.stopMotion();
      return;
    }
    event.preventDefault();
    this.publish(this.spin.move(event.clientX, performance.now()));
  }

  endSpin(event: PointerEvent): void {
    if (this.capture?.id !== event.pointerId || !event.isPrimary) return;
    if (!this.canContinue()) {
      this.stopMotion();
      return;
    }
    event.preventDefault();
    const now = performance.now();
    this.publish(this.spin.move(event.clientX, now));
    this.spin.release(now);
    this.releaseCapture();
    this.rotating.set(this.spin.spinning);
    if (this.spin.spinning) this.frame = requestAnimationFrame(this.animate);
  }

  cancelSpin(event: PointerEvent): void {
    if (this.capture?.id === event.pointerId) this.stopMotion();
  }

  keySpin(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (!this.canStart()) return;
    event.preventDefault();
    this.stopMotion();
    this.publish(this.spin.nudge(event.key === 'ArrowLeft' ? -1 : 1));
  }

  close(): void {
    void this.modal()?.dismiss(undefined, 'close');
  }

  onDidPresent(): void {
    this.dismissing = false;
  }

  onWillDismiss(): void {
    this.dismissing = true;
    this.stopMotion();
    this.closing.emit();
  }

  dismissed(): void {
    this.stopMotion();
    this.closed.emit();
  }

  private canContinue(): boolean {
    return !this.destroyed && !this.dismissing && !document.hidden && !!this.station();
  }

  private canStart(): boolean {
    return this.canContinue();
  }

  private publish(completed: boolean): void {
    this.rotation.set(this.spin.angle);
    this.turnProgress.set(Math.floor(this.spin.progress * 360));
    if (completed && this.canStart() && this.canCheckIn()) this.checkIn.emit();
    else if (completed && this.canStart() && !this.claimed() && !this.claimUnavailable()) {
      this.feedbackRequested.emit('請靠近一點再進行互動');
    }
  }

  private readonly animate = (now: number): void => {
    this.frame = 0;
    if (!this.canContinue()) {
      this.stopMotion();
      return;
    }
    this.publish(this.spin.advance(now));
    this.rotating.set(this.spin.spinning);
    if (this.spin.spinning && this.canContinue()) {
      this.frame = requestAnimationFrame(this.animate);
    }
  };

  private releaseCapture(): void {
    const capture = this.capture;
    this.capture = null;
    this.dragging.set(false);
    if (capture?.element.hasPointerCapture(capture.id)) {
      capture.element.releasePointerCapture(capture.id);
    }
  }

  private stopMotion(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.spin.stop();
    this.rotating.set(false);
    this.releaseCapture();
  }

  private readonly interrupted = (): void => this.stopMotion();
  private readonly visibilityChanged = (): void => {
    if (document.hidden) this.stopMotion();
  };

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopMotion();
    window.removeEventListener('blur', this.interrupted);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    void this.modal()?.dismiss(undefined, 'handler');
  }
}
