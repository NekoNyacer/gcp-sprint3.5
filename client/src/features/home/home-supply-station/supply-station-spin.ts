export class SupplyStationSpin {
  angle = 0;
  private velocity = 0;
  private origin = 0;
  private attempted = false;
  private previousX = 0;
  private degreesPerPixel = 1;
  private lastMoved = 0;
  private lastFrame = 0;
  private samples: { at: number; angle: number }[] = [];

  get progress(): number {
    return Math.min(1, Math.abs(this.angle - this.origin) / 360);
  }

  get spinning(): boolean {
    return Math.abs(this.velocity) >= 12;
  }

  begin(x: number, now: number, diameter: number): void {
    this.stop();
    this.prepareAttempt();
    this.previousX = x;
    this.degreesPerPixel = 360 / diameter;
    this.lastMoved = this.lastFrame = now;
    this.samples = [{ at: now, angle: this.angle }];
  }

  move(x: number, now: number): boolean {
    const delta = (x - this.previousX) * this.degreesPerPixel;
    this.previousX = x;
    if (delta !== 0) {
      this.angle += delta;
      this.lastMoved = now;
      this.samples.push({ at: now, angle: this.angle });
      while (this.samples.length > 2 && this.samples[0].at < now - 80) {
        this.samples.shift();
      }
      const first = this.samples[0];
      const elapsed = (now - first.at) / 1000;
      if (elapsed > 0) {
        this.velocity = Math.max(-2880, Math.min(2880, (this.angle - first.angle) / elapsed));
      }
    }
    return this.takeCompletedTurn();
  }

  release(now: number): void {
    const idle = Math.max(0, now - this.lastMoved);
    this.velocity = idle >= 120 ? 0 : this.velocity * Math.exp(-idle / 80);
    this.lastFrame = now;
  }

  advance(now: number): boolean {
    const elapsed = Math.max(0, (now - this.lastFrame) / 1000);
    const decay = Math.exp(-3 * elapsed);
    this.angle += this.velocity * (1 - decay) / 3;
    this.velocity *= decay;
    this.lastFrame = now;
    if (!this.spinning) this.velocity = 0;
    return this.takeCompletedTurn();
  }

  nudge(direction: -1 | 1): boolean {
    this.stop();
    this.prepareAttempt();
    this.angle += direction * 45;
    return this.takeCompletedTurn();
  }

  stop(): void {
    this.velocity = 0;
  }

  reset(): void {
    this.stop();
    this.angle = this.origin = 0;
    this.attempted = false;
    this.samples = [];
  }

  private prepareAttempt(): void {
    if (!this.attempted) return;
    this.origin = this.angle;
    this.attempted = false;
  }

  private takeCompletedTurn(): boolean {
    if (this.attempted || this.progress < 1) return false;
    this.attempted = true;
    return true;
  }
}
