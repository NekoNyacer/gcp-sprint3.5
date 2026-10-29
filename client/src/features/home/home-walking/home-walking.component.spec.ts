import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LocationPoint, LocationStore } from '../../../shared/stores/location-store';
import { MapCameraController, MapCameraIntent } from '../home-map/map-camera.controller';
import { HomeWalkingComponent } from './home-walking.component';

describe('Home walking recenter button', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(position: LocationPoint | null = currentPosition()) {
    const current = signal<LocationPoint | null>(position);
    TestBed.configureTestingModule({
      imports: [HomeWalkingComponent],
      providers: [
        MapCameraController,
        { provide: LocationStore, useValue: { current } },
      ],
    });
    const fixture = TestBed.createComponent(HomeWalkingComponent);
    const camera = TestBed.inject(MapCameraController);
    const intents: MapCameraIntent[] = [];
    const adapter = { applyCameraIntent: (intent: MapCameraIntent) => intents.push(intent) };
    camera.attach(adapter);
    fixture.detectChanges();
    const click = () =>
      fixture.debugElement
        .query(By.css('ion-button[aria-label="回到目前位置"]'))
        .triggerEventHandler('click');
    return { fixture, camera, adapter, current, intents, click };
  }

  it('shows active following after clicking and clears it when following is cancelled', () => {
    const { fixture, camera, adapter, click } = setup();
    const button = fixture.debugElement.query(By.css('.recenter-button')).componentInstance;
    const icon = fixture.debugElement.query(By.css('.recenter-button ion-icon')).componentInstance;
    expect(button.color).toBe('light');
    expect(icon.name).toBe('locate-outline');

    click();
    fixture.detectChanges();
    expect(button.color).toBe('primary');
    expect(icon.name).toBe('compass-outline');
    expect(fixture.debugElement.query(By.css('.recenter-button')).attributes['aria-pressed']).toBe('true');

    camera.reportPlayerCenterOffset(adapter, 20);
    fixture.detectChanges();
    expect(button.color).toBe('primary');

    camera.stopFollowing(adapter);
    fixture.detectChanges();
    expect(button.color).toBe('light');
    expect(icon.name).toBe('locate-outline');
    expect(fixture.debugElement.query(By.css('.recenter-button')).attributes['aria-pressed']).toBe('false');

    camera.reportPlayerCenterOffset(adapter, 0);
    fixture.detectChanges();
    expect(button.color).toBe('light');
  });

  it('shows the uncentered appearance when the current location disappears', () => {
    const { fixture, camera, adapter, current } = setup();
    camera.request({ kind: 'follow-player', position: currentPosition() });
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('.recenter-button')).componentInstance;
    expect(button.color).toBe('primary');

    current.set(null);
    fixture.detectChanges();
    expect(button.color).toBe('light');
  });

  it('requests the player camera using the latest location without stopping the walk', () => {
    const { fixture, current, intents, click } = setup();
    const stop = vi.fn();
    fixture.componentInstance.stop.subscribe(stop);
    const latestPosition = { ...currentPosition(), longitude: 121.456, latitude: 25.002 };
    current.set(latestPosition);

    click();

    expect(intents).toEqual([{ kind: 'follow-player', position: latestPosition }]);
    expect(stop).not.toHaveBeenCalled();
    expect(fixture.componentInstance.locationError()).toBeNull();
  });

  it('shows a location error without moving the camera and allows retrying', () => {
    const { fixture, current, intents, click } = setup(null);

    click();
    fixture.detectChanges();

    expect(intents).toEqual([]);
    expect(fixture.debugElement.query(By.css('[role="alert"]')).nativeElement.textContent)
      .toContain('目前無法取得位置');

    current.set(currentPosition());
    click();
    fixture.detectChanges();

    expect(intents).toEqual([{ kind: 'follow-player', position: currentPosition() }]);
    expect(fixture.debugElement.query(By.css('[role="alert"]'))).toBeNull();
  });

  it('replays recentering once the map is ready', () => {
    const { camera, intents, click } = setup();
    const pendingIntents: MapCameraIntent[] = [];
    const pendingAdapter = { applyCameraIntent: (intent: MapCameraIntent) => pendingIntents.push(intent) };
    camera.attach(pendingAdapter);
    camera.detach(pendingAdapter);

    click();
    expect(pendingIntents).toEqual([]);

    camera.attach({ applyCameraIntent: (intent) => intents.push(intent) });

    expect(intents).toEqual([{ kind: 'follow-player', position: currentPosition() }]);
  });
});

function currentPosition(): LocationPoint {
  return {
    longitude: 121.454754,
    latitude: 25.001002,
    accuracy: 5,
    observedAt: new Date('2026-10-14T03:00:00Z'),
  };
}
