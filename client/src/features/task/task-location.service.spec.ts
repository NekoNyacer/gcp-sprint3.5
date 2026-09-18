import { describe, expect, it } from 'vitest';
import { TaskLocationService, isLoopbackHostname } from './task-location.service';

describe('TaskLocationService local test location', () => {
  it('only recognizes loopback hostnames', () => {
    expect(isLoopbackHostname('localhost')).toBe(true);
    expect(isLoopbackHostname('127.0.0.1')).toBe(true);
    expect(isLoopbackHostname('cat-walk.example')).toBe(false);
  });

  it('uses the selected task destination with eligible accuracy', () => {
    const location = new TaskLocationService().localTestLocationFor({
      id: 'banqiao-station-demo',
      name: '板橋車站站前廣場（暫定）',
      address: '新北市板橋區縣民大道二段7號',
      latitude: 25.0142,
      longitude: 121.4639,
    });

    expect(location.latitude).toBe(25.0142);
    expect(location.longitude).toBe(121.4639);
    expect(location.accuracy).toBe(5);
  });
});
