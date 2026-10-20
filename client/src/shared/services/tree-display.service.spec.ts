import { TreeDisplayService } from './tree-display.service';

describe('TreeDisplayService', () => {
  beforeEach(() => localStorage.removeItem('cat-walk.tree-display-mode'));
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem('cat-walk.tree-display-mode');
  });

  it('defaults to 3D and restores an explicit preference on the next session', () => {
    const settings = new TreeDisplayService();
    expect(settings.mode()).toBe('3d');
    settings.setMode('2d');
    expect(settings.mode()).toBe('2d');
    expect(new TreeDisplayService().mode()).toBe('2d');
    settings.setMode('3d');
    expect(new TreeDisplayService().mode()).toBe('3d');
  });

  it('ignores an invalid stored mode', () => {
    localStorage.setItem('cat-walk.tree-display-mode', 'auto');
    expect(new TreeDisplayService().mode()).toBe('3d');
  });

  it('still applies settings in memory when local storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const settings = new TreeDisplayService();
    expect(settings.mode()).toBe('3d');
    settings.setMode('2d');
    expect(settings.mode()).toBe('2d');
  });
});
