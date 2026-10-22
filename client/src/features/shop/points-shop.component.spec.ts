import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PointsShopComponent } from './points-shop.component';
import { CMS_CONNECTION } from '../../shared/models/cms-publication';
import { SessionStore } from '../../shared/stores/session-store';
import { ShopStore } from './shop-store';
import type { ShopSnapshot } from './shop.models';
const reward = {
  id: 'drink',
  name: '飲品券',
  kind: 'PRODUCT' as const,
  requiredPoints: 30,
  costNtd: 30,
  enabled: true,
};
const snapshot = (balance = 50): ShopSnapshot => ({
  treePointsBalance: balance,
  lifetimeMatureTrees: 1,
  entitlements: [],
  transactions: [],
});
describe('Points shop command boundaries', () => {
  afterEach(() => TestBed.resetTestingModule());
  async function setup() {
    const api = {
      identityKey: signal('demo:a'),
      walletRevision: signal(0),
      managed: signal(true),
      config: signal({ rewards: [reward] }),
      release: signal({ version: 1 }),
      wallet: vi.fn(async () => snapshot()),
      call: vi.fn(),
      track: vi.fn(),
    };
    const session = { isDemoMode: signal(true) };
    const receiveSnapshot = vi.fn();
    TestBed.configureTestingModule({
      imports: [PointsShopComponent],
      providers: [
        { provide: CMS_CONNECTION, useValue: api },
        { provide: SessionStore, useValue: session },
        { provide: ShopStore, useValue: { receiveSnapshot } },
      ],
    });
    TestBed.overrideComponent(PointsShopComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(PointsShopComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { component: fixture.componentInstance, fixture, api, session, receiveSnapshot };
  }
  it('blocks insufficient funds without sending a command', async () => {
    const { component, api } = await setup();
    component.snapshot.set(snapshot(20));
    component.select(reward);
    await component.redeem();
    expect(api.call).not.toHaveBeenCalled();
    expect(component.balance()).toBe(20);
  });
  it('requires renewed confirmation when the published price version changes', async () => {
    const { component, api } = await setup();
    component.select(reward);
    api.release.set({ version: 2 });
    await component.redeem();
    expect(api.call).not.toHaveBeenCalled();
    expect(component.error()).toContain('重新確認');
  });
  it('retains the same request ID when a failed response is retried', async () => {
    const { component, api, receiveSnapshot } = await setup();
    component.select(reward);
    api.call
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce({ snapshot: snapshot(20) });
    await component.redeem();
    await component.redeem();
    expect(api.call).toHaveBeenCalledTimes(2);
    expect(api.call.mock.calls[0][1]).toEqual(api.call.mock.calls[1][1]);
    expect(component.balance()).toBe(20);
    expect(receiveSnapshot).toHaveBeenCalledWith(snapshot(20));
  });
  it('does not apply a late redemption response after switching identity', async () => {
    const { component, api, fixture } = await setup();
    component.select(reward);
    let resolve!: (value: unknown) => void;
    api.call.mockImplementation(() => new Promise((r) => (resolve = r)));
    const pending = component.redeem();
    api.identityKey.set('demo:b');
    fixture.detectChanges();
    await fixture.whenStable();
    resolve({ snapshot: snapshot(1) });
    await pending;
    expect(component.balance()).toBe(50);
  });
  it('does not expose offline seeded points or products to normal accounts', async () => {
    const { component, api, session, fixture } = await setup();
    session.isDemoMode.set(false);
    api.managed.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.balance()).toBeNull();
    expect(component.rewards()).toEqual([]);
  });
});
