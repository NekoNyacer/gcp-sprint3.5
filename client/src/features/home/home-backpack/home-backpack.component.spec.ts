import { TestBed } from '@angular/core/testing';
import { HomeBackpackComponent } from './home-backpack.component';
import { SessionStore } from '../../../shared/stores/session-store';
import { backpackSeeds } from '../../../shared/models/backpack-seed';

describe('backpack seed naming', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [{ provide: SessionStore, useValue: { displayName: () => '阿發' } }],
    });
    const fixture = TestBed.createComponent(HomeBackpackComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('canPlant', true);
    const seeds = backpackSeeds(
      [
        {
          id: 'route-seed',
          species: '櫻花',
          seedTypeId: 'mystery',
          version: 1,
          origin: { routeId: 'walk-1', place: '板橋車站', acquiredAt: 1 },
        },
      ],
      1,
    );
    fixture.componentRef.setInput('seeds', seeds);
    const plant = vi.fn();
    fixture.componentInstance.plant.subscribe(plant);
    return { fixture, component: fixture.componentInstance, seeds, plant };
  }
  afterEach(() => TestBed.resetTestingModule());

  it('defaults to the username and emits the chosen seed only after explicit confirmation', () => {
    const { component, seeds, plant } = setup();
    component.selectSeed(seeds[0]);
    expect(component.seedName).toBe('阿發的樹');
    expect(plant).not.toHaveBeenCalled();
    component.seedName = '  散步的回憶  ';
    component.confirmPlant();
    expect(plant).toHaveBeenCalledExactlyOnceWith({ id: 'route-seed', name: '散步的回憶' });
  });
  it('closing or cancelling does not request planting', () => {
    const { component, seeds, plant } = setup();
    component.selectSeed(seeds[0]);
    component.cancelName();
    component.onSheetDismiss();
    component.confirmPlant();
    expect(plant).not.toHaveBeenCalled();
    expect(component.selectedSeed()).toBeNull();
  });
  it('rejects blank names and rechecks a changed planting location or missing seed', () => {
    const { fixture, component, seeds, plant } = setup();
    component.selectSeed(seeds[0]);
    component.seedName = '   ';
    component.confirmPlant();
    expect(component.nameError()).toContain('1 至 40');
    component.seedName = '旅行樹';
    fixture.componentRef.setInput('canPlant', false);
    component.confirmPlant();
    expect(plant).not.toHaveBeenCalled();
    fixture.componentRef.setInput('canPlant', true);
    fixture.componentRef.setInput('seeds', []);
    component.confirmPlant();
    expect(plant).not.toHaveBeenCalled();
  });
});
