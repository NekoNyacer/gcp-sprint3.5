import { adjacentTab, adjacentDragTab, companionTab, CompanionRoaming, PET_WIDTH } from './companion-roaming';

describe('companion roaming', () => {
  it('bounds player-dragged tab changes without changing autonomous circular order', () => {
    expect(adjacentDragTab('home', -1)).toBeNull();
    expect(adjacentDragTab('profile', 1)).toBeNull();
    expect(adjacentDragTab('home', 1)).toBe('task');
    expect(adjacentDragTab('profile', -1)).toBe('collection');
    expect(adjacentDragTab('shop', -1)).toBe('task');
  });
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
    const eating = new CompanionRoaming(() => .85);
    eating.advance(.48, 390);
    expect(eating.behavior).toBe('feeding');
    const x = eating.x;
    eating.advance(1, 390);
    expect(eating.x).toBe(x);
    const sleeping = new CompanionRoaming(() => .99);
    sleeping.advance(.48, 390);
    expect(sleeping.behavior).toBe('sleeping');
    const sleepingX = sleeping.x;
    sleeping.advance(8, 390);
    expect(sleeping.behavior).toBe('sleeping');
    expect(sleeping.x).toBe(sleepingX);
  });

  it('darts quickly, comes to a complete stop, then starts another short burst', () => {
    const pet = new CompanionRoaming(() => .5);
    const start = pet.x;
    pet.advance(.2, 1024);
    expect(pet.x - start).toBeGreaterThan(50);
    pet.advance(.28, 1024);
    expect(pet.behavior).toBe('idle');
    const stopped = pet.x;
    pet.advance(.6, 1024);
    expect(pet.x).toBe(stopped);
    pet.advance(.3, 1024);
    expect(pet.behavior).toBe('walking');
    expect(pet.x).toBeGreaterThan(stopped);
  });

  it('keeps burst distances and pauses consistent across render frame rates', () => {
    const fast = new CompanionRoaming(() => .5), slow = new CompanionRoaming(() => .5);
    for (let i = 0; i < 300; i++) fast.advance(.01, 10000);
    for (let i = 0; i < 60; i++) slow.advance(.05, 10000);
    expect(fast.x).toBeCloseTo(slow.x, 6);
    expect(fast.behavior).toBe(slow.behavior);
  });
});
