import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { CompanionAgentContext, CompanionWalkingOption } from '../../../../../functions/src/companion-agent-domain';
import { homeTreesWithProgress, HomeTree, findHomeTree } from '../../../features/home/home-tree-recommendations';
import { LocationStore } from '../../stores/location-store';
import { ProgressStore } from '../../stores/progress-store';
import { WalkSessionStore } from '../../stores/walk-session-store';
import { MapboxDirectionsService, WalkingDirections } from '../../services/mapbox-directions.service';
import { LiveEnvironmentService } from '../../services/live-environment.service';
import { CmsClientService } from '../../services/cms-client.service';
import { cmsPublication, cmsRouteRoles } from '../../models/cms-publication';
import { haversineDistanceMeters } from '../../models/geo-distance';
import { projectPointOnRoute } from '../../models/walk-route';
import { createDemoWalkTasks } from '../../models/demo-walk-tasks';
import { RoutedWalkTaskPoint, WalkTaskPoint } from '../../models/walk-task.models';
import type { GeoPoint } from '../../models/geo.models';
import { treeWaterState } from '../../models/tree-cultivation';
import { CompanionChatService } from './companion-chat.service';

type LocalOption = { summary: CompanionWalkingOption; tree: HomeTree; base: WalkingDirections; route: WalkingDirections; station: RoutedWalkTaskPoint | null };
export type WalkingProposal = CompanionWalkingOption & { minutes: number; meters: number; locationLabel: string };

@Injectable({ providedIn: 'root' })
export class CompanionAgentService {
  private readonly location = inject(LocationStore);
  private readonly progress = inject(ProgressStore);
  private readonly walk = inject(WalkSessionStore);
  private readonly directions = inject(MapboxDirectionsService);
  private readonly environment = inject(LiveEnvironmentService);
  private readonly cms = inject(CmsClientService);
  private readonly chat = inject(CompanionChatService);
  private readonly router = inject(Router);
  readonly proposal = signal<WalkingProposal | null>(null);
  readonly status = signal('');
  readonly steps = signal<string[]>([]);
  private options = new Map<string, LocalOption>();
  private request?: AbortController;
  private snapshot?: { identity: string; version: number; origin: GeoPoint; at: number };
  private sequence = 0;

  cancel(): void {
    this.sequence++;
    if (this.request) this.chat.cancelPending();
    this.request?.abort();
    this.request = undefined;
    this.proposal.set(null);
    this.options.clear();
    this.steps.set([]);
    this.status.set('');
  }

  async reply(message: string): Promise<string> {
    this.cancel();
    if (!this.canPlan()) throw new Error('請先結束目前路線或返回空白的規劃頁，再讓我安排。');
    const sequence = this.sequence;
    const request = this.request = new AbortController();
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(24_000)]);
    const origin = this.location.current();
    if (!origin) throw new Error('目前沒有位置，請先回首頁確認定位。');
    const snapshot = { identity: this.cms.identityKey(), version: cmsPublication().version, origin: { latitude: origin.latitude, longitude: origin.longitude }, at: Date.now() };
    const current = () => sequence === this.sequence && snapshot.identity === this.cms.identityKey() && snapshot.version === cmsPublication().version;
    this.status.set('正在查詢樹木、步行路線與天氣…');
    const trees = homeTreesWithProgress(this.progress.demoTrees(), this.progress.demoDay())
      .filter(t => !t.empty && !t.unavailable && this.progress.canVisitDemoTree(t.id))
      .sort((a, b) => haversineDistanceMeters(origin, a.position) - haversineDistanceMeters(origin, b.position)).slice(0, 3);
    const results = await Promise.allSettled(trees.map(async tree => {
      const [base, weather] = await Promise.all([
        this.directions.walking([origin, tree.position], signal),
        this.environment.weatherAt(tree.position, signal),
      ]);
      const summary: CompanionWalkingOption = {
        id: `${tree.id}:direct`, treeId: tree.id, treeName: tree.nickName.slice(0, 100), place: tree.poiName.slice(0, 100),
        care: `${treeWaterState(tree.lastWateredAt, tree.plantedAt) === 'dry' ? '需要澆水' : '水分充足'}，雜草 ${tree.weedCount} 株`,
        distanceMeters: base.distanceMeters, durationSeconds: base.durationSeconds ?? base.distanceMeters / 1.25,
        station: null, weather,
      };
      const direct: LocalOption = { summary, tree, base, route: base, station: null };
      const station = this.waterStation(base.coordinates);
      if (!station) return [direct];
      try {
        const route = await this.directions.walking([origin, station.position, tree.position], signal);
        return [direct, { tree, base, route,
          station: { ...station, routeGeometry: [], routeDistanceMeters: Math.max(0, route.distanceMeters - base.distanceMeters) },
          summary: { ...summary, id: `${tree.id}:water`, distanceMeters: route.distanceMeters,
            durationSeconds: route.durationSeconds ?? route.distanceMeters / 1.25,
            station: { id: station.id, name: station.name.slice(0, 100), resource: 'water' as const } },
        } satisfies LocalOption];
      } catch { return [direct]; }
    }));
    if (!current() || signal.aborted) throw new Error('規劃已取消或資料已更新，請再試一次。');
    const options = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    if (!options.length) throw new Error(trees.length ? '目前無法取得步行路線，請稍後重試。' : '附近候選中沒有今日可造訪的已種植樹木。');
    this.options = new Map(options.map(o => [o.summary.id, o]));
    this.snapshot = snapshot;
    this.status.set('正在比較時間與補給需求…');
    const context: CompanionAgentContext = {
      inventory: this.progress.inventory(), phase: this.walk.phase(), locationSource: this.location.source() ?? 'demo-default',
      options: options.map(o => o.summary),
    };
    const response = await this.chat.respond(message, context);
    if (!current()) throw new Error('規劃已取消或帳號已切換。');
    this.steps.set(Array.isArray(response.steps) ? response.steps.filter(s => typeof s === 'string').slice(0, 3) : []);
    const chosen = response.proposal && this.options.get(response.proposal.optionId);
    if (response.proposal && !chosen) throw new Error('建議路線已失效，請重新規劃。');
    if (chosen) this.proposal.set({ ...chosen.summary, minutes: Math.ceil(chosen.summary.durationSeconds / 60), meters: Math.round(chosen.summary.distanceMeters),
      locationLabel: this.location.source() === 'gps' ? '目前定位' : 'Demo 位置' });
    this.status.set('');
    return response.text;
  }

  async apply(): Promise<void> {
    const proposal = this.proposal();
    const option = proposal && this.options.get(proposal.id);
    const snapshot = this.snapshot;
    const validate = () => {
      const current = this.location.current();
      const tree = option && findHomeTree(option.tree.id);
      if (!option || !snapshot || !current || snapshot.identity !== this.cms.identityKey() || snapshot.version !== cmsPublication().version ||
          Date.now() - snapshot.at > 5 * 60_000 || haversineDistanceMeters(snapshot.origin, current) > 50 || !this.canPlan() ||
          !tree || tree.unavailable || !this.progress.canVisitDemoTree(tree.id) ||
          (option.station && !this.cms.merchantAvailable(option.station.id))) throw new Error('位置、路線或站點已更新，請重新安排。');
    };
    validate();
    // Navigation must succeed before changing any planning state.
    if (this.router.url !== '/home' && !await this.router.navigateByUrl('/home')) throw new Error('無法開啟首頁，請再試一次。');
    validate();
    this.cms.clearRecommendations();
    cmsRouteRoles.set(option!.station ? [{ merchantId: option!.station.id, role: 'supply', reason: '花栗鼠健走方案' }] : []);
    this.walk.startPlanning();
    this.walk.selectDestination({ id: option!.tree.id, position: option!.tree.position }, option!.base.coordinates);
    this.walk.setBaseRoute(option!.base.coordinates, option!.base.distanceMeters, option!.base.durationSeconds);
    if (!this.walk.confirmDestination()) throw new Error(this.walk.planningError() ?? '無法套用目的地。');
    this.walk.setTaskRoutes(option!.station ? [option!.station] : []);
    if (option!.station) this.walk.toggleTaskPoint(option!.station.id);
    this.walk.setPlannedRoute(option!.route.coordinates, option!.route.distanceMeters, option!.station ? [option!.station.id] : [], [], option!.route.durationSeconds);
    this.cancel();
  }

  private canPlan(): boolean {
    return !this.walk.hasActiveRoute() && !this.walk.routeLoading() && !this.walk.hasDestination() && (this.walk.isIdle() || this.walk.isPlanning());
  }

  private waterStation(route: readonly GeoPoint[]): WalkTaskPoint | undefined {
    const publication = cmsPublication();
    if (!publication.managed) return createDemoWalkTasks(route).find(s => s.kind === 'water');
    const candidates = (publication.config?.merchants ?? []).filter(m => m.roles.includes('supply') && m.resource === 'water' && this.cms.merchantAvailable(m.id))
      .map(m => ({ m, projection: projectPointOnRoute({ latitude: m.latitude, longitude: m.longitude }, route) }))
      .filter(c => c.projection !== null && c.projection.distanceMeters <= 1000)
      .sort((a, b) => a.projection!.distanceMeters - b.projection!.distanceMeters);
    const candidate = candidates[0];
    if (!candidate) return undefined;
    const m = candidate.m;
    return { id: m.id, name: m.name, kind: 'water', position: { latitude: m.latitude, longitude: m.longitude },
      routeStop: candidate.projection!, isDemo: true, estimatedExtraSteps: 0, description: '花栗鼠安排的遊戲水資源補給站',
      supplyStation: { category: m.category, isCathayTwqrMerchant: m.twqr, offer: m.offer, terms: m.terms, validUntil: m.validUntil, supply: { resource: m.resource, amount: m.amount } } };
  }
}
