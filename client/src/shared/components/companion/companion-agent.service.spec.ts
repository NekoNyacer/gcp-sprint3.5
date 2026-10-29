import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { patchState } from '@ngrx/signals';
import { CompanionAgentService } from './companion-agent.service';
import { CompanionChatService } from './companion-chat.service';
import { CmsClientService } from '../../services/cms-client.service';
import { MapboxDirectionsService } from '../../services/mapbox-directions.service';
import { LiveEnvironmentService } from '../../services/live-environment.service';
import { WalkSessionStore } from '../../stores/walk-session-store';
import { LocationStore } from '../../stores/location-store';
import { ProgressStore } from '../../stores/progress-store';
import { cmsPublication, cmsRouteRoles } from '../../models/cms-publication';
import { unknownWeather } from '../../../../../functions/src/live-weather';

describe('CompanionAgentService', () => {
  let identity: string;
  const chat = { respond: vi.fn(), cancelPending: vi.fn() };
  const router = { navigateByUrl: vi.fn() };
  const directions = { walking: vi.fn() };
  beforeEach(() => {
    identity = 'demo:alice';
    cmsPublication.set({ managed: false, version: 0, config: null }); cmsRouteRoles.set(null);
    router.navigateByUrl.mockReset().mockResolvedValue(true);
    directions.walking.mockReset().mockImplementation(async (points: any[]) => ({ coordinates: points, waypoints: points, distanceMeters: 800, durationSeconds: 600 }));
    chat.respond.mockReset().mockImplementation(async (_message, context) => ({ source: 'gemini', text: '請確認建議',
      proposal: { optionId: context.options.find((o: any) => o.station?.resource === 'water').id }, steps: ['已比較單程步行路線與天氣'] }));
    TestBed.configureTestingModule({ providers: [
      { provide: CompanionChatService, useValue: chat }, { provide: Router, useValue: router },
      { provide: MapboxDirectionsService, useValue: directions },
      { provide: LiveEnvironmentService, useValue: { weatherAt: vi.fn().mockResolvedValue(unknownWeather()) } },
      { provide: CmsClientService, useValue: { identityKey: () => identity, merchantAvailable: () => true, clearRecommendations: vi.fn() } },
    ] });
  });
  afterEach(() => { TestBed.resetTestingModule(); cmsPublication.set({ managed: false, version: 0, config: null }); cmsRouteRoles.set(null); });

  it('looks up real tools, proposes without changing state, then applies an exact route through the existing store', async () => {
    const service = TestBed.inject(CompanionAgentService), walk = TestBed.inject(WalkSessionStore), progress = TestBed.inject(ProgressStore);
    const before = { ...progress.inventory() };
    await service.reply('20分鐘，順便補水');
    expect(walk.isIdle()).toBe(true); expect(service.proposal()?.station?.resource).toBe('water');
    expect(chat.respond.mock.calls[0][1].options.length).toBeLessThanOrEqual(6);
    const chosen = service.proposal()!;
    await service.apply();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
    expect(walk.destination()?.id).toBe(chosen.treeId);
    expect(walk.taskPoints().map(p => p.id)).toEqual([chosen.station!.id]);
    expect(walk.routeNeedsUpdate()).toBe(false);
    expect(walk.plannedDurationSeconds()).toBe(600);
    expect(walk.isPlanning()).toBe(true); expect(walk.hasActiveRoute()).toBe(false);
    expect(progress.inventory()).toEqual(before);
  });

  it('rejects moved players, changed identities and expired or changed publications before mutation', async () => {
    const service = TestBed.inject(CompanionAgentService), walk = TestBed.inject(WalkSessionStore), location = TestBed.inject(LocationStore);
    await service.reply('20分鐘，順便補水');
    const origin = location.current()!;
    patchState(location as never, { current: { ...origin, latitude: origin.latitude + .01 } });
    await expect(service.apply()).rejects.toThrow('已更新');
    patchState(location as never, { current: origin }); identity = 'normal:bob';
    await expect(service.apply()).rejects.toThrow('已更新');
    identity = 'demo:alice'; cmsPublication.set({ managed: false, version: 1, config: null });
    await expect(service.apply()).rejects.toThrow('已更新');
    expect(walk.isIdle()).toBe(true); expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('preserves the existing state when navigation fails, and rejects an active walk before lookup', async () => {
    const service = TestBed.inject(CompanionAgentService), walk = TestBed.inject(WalkSessionStore);
    await service.reply('20分鐘，順便補水');
    router.navigateByUrl.mockResolvedValueOnce(false);
    await expect(service.apply()).rejects.toThrow('無法開啟首頁');
    expect(walk.isIdle()).toBe(true);
    patchState(walk as never, { routeId: 'existing-walk', phase: 'walking' });
    directions.walking.mockClear();
    await expect(service.reply('10分鐘')).rejects.toThrow('請先結束');
    expect(directions.walking).not.toHaveBeenCalled();
  });

  it('discards a response after cancellation and handles unavailable weather without inventing data', async () => {
    let resolve!: (value: unknown) => void;
    chat.respond.mockImplementationOnce(() => new Promise(r => resolve = r));
    const service = TestBed.inject(CompanionAgentService);
    const pending = service.reply('20分鐘');
    await vi.waitFor(() => expect(chat.respond).toHaveBeenCalled());
    expect(chat.respond.mock.calls[0][1].options[0].weather.source).toBe('unavailable');
    service.cancel(); resolve({ source: 'gemini', text: 'late', proposal: { optionId: 'made-up' } });
    await expect(pending).rejects.toThrow('已取消');
    expect(service.proposal()).toBeNull();
  });
});
