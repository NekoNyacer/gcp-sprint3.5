import { adjacentTab, companionTab, CompanionRoaming, PET_WIDTH } from './companion-roaming';

describe('companion roaming', () => {
  it('connects tab edges in both directions, including the circular boundaries', () => {
    expect(adjacentTab('home', 1)).toBe('task');
    expect(adjacentTab('home', -1)).toBe('profile');
    expect(adjacentTab('profile', 1)).toBe('home');
    expect(adjacentTab('shop', -1)).toBe('task');
    expect(companionTab('/task/event-1?source=map')).toBe('task');
    expect(companionTab('/shop/history')).toBe('shop');
    expect(companionTab('/login')).toBeNull();
  });

  it('fully exits before changing tab and enters the next tab from the matching edge', () => {
    const pet = new CompanionRoaming();
    pet.x = 397;
    expect(pet.advance(.05, 390)).toBe(1);
    pet.enterFromEdge(1, 390);
    expect(pet.x).toBe(-PET_WIDTH);
    expect(pet.advance(.05, 390)).toBeNull();
    expect(pet.x).toBeGreaterThan(-PET_WIDTH);
    pet.x = -PET_WIDTH - 7;
    pet.direction = -1;
    expect(pet.advance(.05, 390)).toBe(-1);
    pet.enterFromEdge(-1, 390);
    expect(pet.x).toBe(390);
  });

  it('autonomously eats and sleeps without spatial drift', () => {
    const eating = new CompanionRoaming(() => .7);
    eating.advance(10, 390);
    expect(eating.behavior).toBe('feeding');
    const x = eating.x;
    eating.advance(1, 390);
    expect(eating.x).toBe(x);
    const sleeping = new CompanionRoaming(() => .95);
    sleeping.advance(10, 390);
    expect(sleeping.behavior).toBe('sleeping');
    sleeping.advance(8, 390);
    expect(sleeping.behavior).toBe('sleeping');
    expect(sleeping.x).toBe(16);
  });
});
