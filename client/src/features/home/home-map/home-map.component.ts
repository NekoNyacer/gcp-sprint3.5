import {
  afterRenderEffect,
  Component,
  ElementRef,
  EmbeddedViewRef,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  TemplateRef,
  untracked,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import mapboxgl from 'mapbox-gl';
import { GeoPoint } from '../../../shared/models/geo.models';
import { WalkTaskPoint, supplyRewardLabel } from '../../../shared/models/walk-task.models';
import { haversineDistanceMeters, isValidGeoPoint } from '../../../shared/models/geo-distance';
import { CubBadgeComponent } from '../../../shared/components/badge/badge.component';
import { LocationPoint, LocationStore } from '../../../shared/stores/location-store';
import { WalkSessionStore } from '../../../shared/stores/walk-session-store';
import { ProgressStore } from '../../../shared/stores/progress-store';
import { settings } from '../../../environments/environment-dev';
import {
  currentHomeTrees,
  homeTreesWithProgress,
  RecommendedHomeTree,
} from '../home-tree-recommendations';
import {
  layoutTreePopups,
  PopupBounds,
  TreePopupAnchor,
  TREE_POPUP_OFFSET,
  TREE_POPUP_WIDTH,
} from './tree-popup-layout';
import { getMapboxAccessToken } from '../../../mapbox-runtime-config';
import {
  getRouteCameraPadding,
  MapCameraAdapter,
  MapCameraController,
  MapCameraIntent,
} from './map-camera.controller';
import { IonButton } from '@ionic/angular';
import {
  CMS_CONNECTION,
  cmsPublication,
  cmsRouteRoles,
} from '../../../shared/models/cms-publication';

export const PLANNING_MARKER_LONG_PRESS_MS = 500;

@Component({
  selector: 'app-home-map',
  templateUrl: './home-map.component.html',
  styleUrls: ['./home-map.component.scss'],
  imports: [CubBadgeComponent, DecimalPipe, IonButton],
})
export class HomeMapComponent implements OnDestroy, MapCameraAdapter {
  private readonly cms = inject(CMS_CONNECTION, { optional: true });
  readonly recommendedTrees = input<readonly RecommendedHomeTree[]>([]);
  readonly showRecommendations = input(true);
  readonly visibleMapArea = input<() => { top: number; bottom: number } | undefined>(
    () => undefined,
  );
  readonly bearingChange = output<number>();
  readonly destinationSelect = output<string>();
  readonly cultivationSelect = output<string>();
  readonly taskToggle = output<string>();
  readonly stationDetails = output<string>();
  readonly treeStopToggle = output<string>();
  readonly stationCheckIn = output<string>();
  readonly settings = settings;
  readonly mapError = signal<string | null>(null);
  private readonly ls = inject(LocationStore);
  private readonly walkSession = inject(WalkSessionStore);
  private readonly progress = inject(ProgressStore);
  readonly taskPoints = computed<readonly WalkTaskPoint[]>(() => {
    if (this.walkSession.isPlanning() && this.walkSession.destinationConfirmed())
      return this.walkSession.availableTaskPoints();
    return [];
  });
  private readonly camera = inject(MapCameraController);
  private readonly mapElement = viewChild<ElementRef<HTMLDivElement>>('map');
  private readonly playerHeadingElement = viewChild<ElementRef<HTMLDivElement>>('playerHeading');
  private playerHeadingMarker?: mapboxgl.Marker;
  private map?: mapboxgl.Map;
  private resizeObserver?: ResizeObserver;
  private readonly views = inject(ViewContainerRef);
  private readonly treePopupTemplate =
    viewChild<TemplateRef<{ $implicit: RecommendedHomeTree }>>('treePopupTemplate');
  private readonly treeMarkers = new Map<
    string,
    { marker: mapboxgl.Marker; button: HTMLButtonElement }
  >();
  private treeMarkerGestureCleanups: (() => void)[] = [];
  private readonly clusterMarkers = new Map<number, mapboxgl.Marker>();
  private stationClusterPoints: { id: string; button: HTMLButtonElement; position: GeoPoint }[] =
    [];
  private clusterRevision = 0;
  private treePopups: {
    tree: RecommendedHomeTree;
    view: EmbeddedViewRef<{ $implicit: RecommendedHomeTree }>;
    content: HTMLElement;
    popup: mapboxgl.Popup;
    anchor: TreePopupAnchor;
  }[] = [];
  readonly selectedTreeId = computed(() => this.walkSession.destination()?.id);
  private readonly mapReady = signal(false);
  private renderedTreeSignature = '';
  private readonly publishedTreesEffect = effect(() => {
    const ready = this.mapReady();
    const sites = currentHomeTrees();
    if (!ready || !this.map || this.renderedTreeSignature === JSON.stringify(sites)) return;
    untracked(() => {
      for (const cleanup of this.treeMarkerGestureCleanups) cleanup();
      this.treeMarkerGestureCleanups = [];
      for (const entry of this.treeMarkers.values()) entry.marker.remove();
      this.treeMarkers.clear();
      this.drawDestination();
    });
  });
  private taskMarkers: mapboxgl.Marker[] = [];
  private taskMarkerGestureCleanups: (() => void)[] = [];
  private stationPopup?: mapboxgl.Popup;
  private popupResizeObserver?: ResizeObserver;
  private popupFrame = 0;
  private readonly popupContent = viewChild<ElementRef<HTMLElement>>('stationPopupContent');
  readonly popupTask = signal<WalkTaskPoint | null>(null);
  private readonly popupTreeId = signal<string | null>(null);
  readonly popupTree = computed(
    () =>
      homeTreesWithProgress(this.progress.demoTrees(), this.progress.demoDay()).find(
        (tree) => tree.id === this.popupTreeId(),
      ) ?? null,
  );
  readonly popupTreeSelected = computed(() =>
    this.walkSession.treeStops().some((point) => point.id === this.popupTreeId()),
  );
  readonly popupSelected = computed(() =>
    this.walkSession.taskPoints().some((point) => point.id === this.popupTask()?.id),
  );
  readonly popupDistance = computed(() => {
    const origin = this.ls.current();
    const task = this.popupTask() ?? this.popupTree();
    return task && isValidGeoPoint(origin)
      ? `距離 ${(haversineDistanceMeters(origin, task.position) / 1000).toFixed(1)} km`
      : '距離：尚無有效定位';
  });
  readonly supplyRewardLabel = supplyRewardLabel;

  private readonly treeSelectionEffect = effect(() => {
    this.mapReady();
    const selected = this.selectedTreeId();
    const stops = this.walkSession.treeStops();
    const activeRoute = this.walkSession.hasActiveRoute();
    const planning = this.walkSession.isPlanning();
    const destinationConfirmed = this.walkSession.destinationConfirmed();
    const unavailable = this.progress.unavailableDemoTreeIds();
    const trees = this.progress.demoTrees();
    for (const [id, { button }] of this.treeMarkers) {
      const isSelected = id === selected || stops.some((stop) => stop.id === id);
      const empty = !trees[id]?.planted;
      const harvested = (trees[id]?.harvestCount ?? 0) > 0;
      const cannotVisit = unavailable.includes(id);
      const canOpenRouteOptions =
        planning &&
        destinationConfirmed &&
        id !== selected &&
        (this.progress.canVisitDemoTree(id) || stops.some((stop) => stop.id === id));
      const interactionHint = canOpenRouteOptions
        ? '長按查看路線選項'
        : planning
          ? '長按查看詳情'
          : '點擊查看';
      button.classList.toggle('tree-marker--harvested', harvested);
      button.classList.toggle('tree-marker--empty', empty);
      button.classList.toggle('tree-marker--unavailable', cannotVisit);
      if (harvested) {
        button.querySelector('img')?.remove();
        if (!button.querySelector('.tree-marker__harvested-icon')) {
          const icon = document.createElement('ion-icon');
          icon.setAttribute('name', 'arrow-redo');
          icon.setAttribute('color', 'light');
          icon.setAttribute('aria-hidden', 'true');
          icon.className = 'tree-marker__harvested-icon';
          button.prepend(icon);
        }
      } else {
        button.querySelector('.tree-marker__harvested-icon')?.remove();
        let icon = button.querySelector<HTMLImageElement>('img');
        if (!icon) {
          icon = document.createElement('img');
          icon.alt = '';
          button.prepend(icon);
        }
        icon.src = empty
          ? '/images/assets/planting-spot-icon.svg'
          : '/images/assets/cathay-tree-icon.svg';
      }
      const tree = currentHomeTrees().find((tree) => tree.id === id);
      if (!tree) continue;
      const status = harvested
        ? ` · 已收成，等待種植地復原中 · ${interactionHint}`
        : cannotVisit
          ? ` · 今日已造訪 · ${interactionHint}`
          : ` · ${interactionHint}`;
      button.title = `${empty ? '空的種植點' : tree.nickName} · ${tree.poiName}${status}`;
      button.setAttribute('aria-label', button.title);
      button.hidden = activeRoute && !isSelected;
      button.setAttribute('aria-pressed', String(isSelected));
      button.querySelector('.tree-marker__check')?.remove();
      if (isSelected) {
        const check = document.createElement('span');
        check.className = 'tree-marker__check';
        check.setAttribute('aria-hidden', 'true');
        button.append(check);
      }
    }
    this.syncClusterSource();
  });

  private readonly treePopupEffect = afterRenderEffect(() => {
    const ready = this.mapReady();
    const planning = this.walkSession.isPlanning();
    const visible = this.showRecommendations();
    const selected = this.selectedTreeId();
    const trees = this.recommendedTrees();
    const template = this.treePopupTemplate();
    untracked(() => {
      this.clearTreePopups();
      if (!ready || !planning || !visible || selected || !this.map || !template) return;
      for (const tree of trees.slice(0, 3)) {
        const view = this.views.createEmbeddedView(template, { $implicit: tree });
        view.detectChanges();
        const content = view.rootNodes.find(
          (node): node is HTMLElement => node instanceof HTMLElement,
        );
        if (!content) throw new Error('Tree recommendation popup has no content element.');
        const anchor = 'bottom';
        const popup = this.createTreePopup(tree, content, anchor);
        this.treePopups.push({ tree, view, content, popup, anchor });
      }
      this.schedulePopupFit();
    });
  });

  private createTreePopup(
    tree: RecommendedHomeTree,
    content: HTMLElement,
    anchor: TreePopupAnchor,
  ): mapboxgl.Popup {
    return new mapboxgl.Popup({
      className: 'tree-recommendation-popup',
      maxWidth: `${TREE_POPUP_WIDTH}px`,
      anchor,
      offset: TREE_POPUP_OFFSET,
      closeButton: false,
      closeOnClick: false,
      focusAfterOpen: false,
    })
      .setLngLat([tree.position.longitude, tree.position.latitude])
      .setDOMContent(content)
      .addTo(this.map!);
  }

  private clearTreePopups(): void {
    for (const { popup, view } of this.treePopups) {
      popup.remove();
      view.destroy();
    }
    this.treePopups = [];
  }

  private layoutRecommendations(): void {
    const viewport = this.popupViewport();
    if (!this.map || !viewport || this.treePopups.length === 0) return;
    const mapBounds = this.map.getContainer().getBoundingClientRect();
    const points = this.treePopups.map(({ tree, content }) => {
      const point = this.map!.project([tree.position.longitude, tree.position.latitude]);
      content.style.width = `${Math.min(TREE_POPUP_WIDTH, viewport.right - viewport.left)}px`;
      content.style.maxHeight = `${Math.max(44, viewport.bottom - viewport.top - 36)}px`;
      return {
        x: point.x + mapBounds.left,
        y: point.y + mapBounds.top,
        width: content.offsetWidth || TREE_POPUP_WIDTH,
        height: (content.offsetHeight || 112) + 10,
      };
    });
    const anchors = layoutTreePopups(points, viewport);
    this.treePopups.forEach((entry, index) => {
      const anchor = anchors[index];
      if (entry.anchor === anchor) return;
      entry.popup.remove();
      entry.popup = this.createTreePopup(entry.tree, entry.content, anchor);
      entry.anchor = anchor;
    });
  }

  private readonly popupLayoutEffect = afterRenderEffect(() => {
    this.popupTask();
    this.popupTree();
    this.popupTreeSelected();
    this.popupDistance();
    this.popupSelected();
    untracked(() => this.schedulePopupFit());
  });

  private schedulePopupFit(): void {
    if ((!this.stationPopup && this.treePopups.length === 0) || this.popupFrame) return;
    this.popupFrame = requestAnimationFrame(() => {
      this.popupFrame = 0;
      this.fitStationPopup();
      this.layoutRecommendations();
    });
  }

  private fitStationPopup(): void {
    const map = this.map;
    const popup = this.stationPopup;
    const content = this.popupContent()?.nativeElement;
    const element = popup?.getElement();
    if (!map || !element || !content) return;
    const viewport = this.popupViewport();
    if (!viewport) return;
    const { left, right, top, bottom } = viewport;
    content.style.width = `${Math.min(260, right - left)}px`;
    content.style.maxHeight = `${Math.min(300, Math.max(0, bottom - top - 36))}px`;
    const bounds = element.getBoundingClientRect();
    const x = bounds.left < left ? bounds.left - left : Math.max(0, bounds.right - right);
    const y = bounds.top < top ? bounds.top - top : Math.max(0, bounds.bottom - bottom);
    if (Math.abs(x) > 1 || Math.abs(y) > 1) {
      map.panBy([x, y], { duration: 250 });
    }
  }

  private popupViewport(): PopupBounds | null {
    if (!this.map) return null;
    const mapBounds = this.map.getContainer().getBoundingClientRect();
    const area = this.visibleMapArea()();
    const bounds = {
      left: Math.max(0, mapBounds.left) + 12,
      right: Math.min(window.innerWidth, mapBounds.right) - 12,
      top: Math.max(0, mapBounds.top, area?.top ?? 0) + 12,
      bottom:
        Math.min(window.innerHeight, mapBounds.bottom, area?.bottom ?? window.innerHeight) - 12,
    };
    return bounds.right > bounds.left && bounds.bottom > bounds.top ? bounds : null;
  }

  extraMinutes(task: WalkTaskPoint): number {
    return Math.max(1, Math.ceil(task.estimatedExtraSteps / 100));
  }

  private readonly popupValidityEffect = effect(() => {
    const task = this.popupTask();
    const tree = this.popupTree();
    const planning = this.walkSession.isPlanning() && this.walkSession.destinationConfirmed();
    if (
      (task || tree) &&
      (!this.mapReady() ||
        !planning ||
        (task &&
          !(cmsPublication().managed
            ? this.walkSession
                .availableTaskPoints()
                .some(
                  (point) =>
                    point.id === task.id &&
                    point.supplyStation.offer === task.supplyStation.offer &&
                    point.supplyStation.supply.amount === task.supplyStation.supply.amount,
                )
            : this.walkSession.taskRoutes().some((point) => point === task))) ||
        (tree &&
          (tree.id === this.selectedTreeId() ||
            (!this.popupTreeSelected() && !this.progress.canVisitDemoTree(tree.id)))))
    ) {
      untracked(() => this.closeStationPopup());
    }
  });

  private openStationPopup(task: WalkTaskPoint): void {
    const content = this.popupContent()?.nativeElement;
    if (!this.map || !content) return;
    this.closeStationPopup();
    this.popupTask.set(task);
    this.cms?.track('offer_view', task.id);
    this.openPlanningPopup(task.position, content);
  }

  private openTreeStopPopup(treeId: string): void {
    const content = this.popupContent()?.nativeElement;
    const tree = currentHomeTrees().find((tree) => tree.id === treeId);
    if (!this.map || !content || !tree) return;
    this.closeStationPopup();
    this.popupTreeId.set(treeId);
    this.openPlanningPopup(tree.position, content);
  }

  private openPlanningPopup(position: GeoPoint, content: HTMLElement): void {
    if (!this.map) return;
    const popup = new mapboxgl.Popup({
      className: 'supply-station-popup',
      maxWidth: 'min(260px, calc(100vw - 24px))',
      anchor: 'bottom',
      offset: 26,
      closeButton: false,
      closeOnClick: true,
      focusAfterOpen: true,
    })
      .setLngLat([position.longitude, position.latitude])
      .setDOMContent(content);
    this.stationPopup = popup;
    popup.on('close', () => {
      if (this.stationPopup === popup) {
        this.stationPopup = undefined;
        this.popupTask.set(null);
        this.popupTreeId.set(null);
        this.clearPopupLayout();
      }
    });
    popup.addTo(this.map);
    this.popupResizeObserver = new ResizeObserver(() => this.schedulePopupFit());
    this.popupResizeObserver.observe(content);
    this.schedulePopupFit();
  }

  private clearPopupLayout(): void {
    cancelAnimationFrame(this.popupFrame);
    this.popupFrame = 0;
    this.popupResizeObserver?.disconnect();
    this.popupResizeObserver = undefined;
  }

  closeStationPopup(): void {
    this.clearPopupLayout();
    this.stationPopup?.remove();
    this.stationPopup = undefined;
    this.popupTask.set(null);
    this.popupTreeId.set(null);
  }

  confirmStation(): void {
    const task = this.popupTask();
    if (!task) return;
    if (
      !this.walkSession.isPlanning() ||
      !this.walkSession.destinationConfirmed() ||
      !(cmsPublication().managed
        ? this.walkSession.availableTaskPoints().some((point) => point.id === task.id)
        : this.walkSession.taskRoutes().some((point) => point === task))
    ) {
      this.walkSession.setPlanningError('路線或補給站已變更，請重新選擇補給站。');
      this.closeStationPopup();
      return;
    }
    this.closeStationPopup();
    this.taskToggle.emit(task.id);
  }

  confirmTreeStop(): void {
    const tree = this.popupTree();
    if (!tree) return;
    if (
      !this.walkSession.isPlanning() ||
      !this.walkSession.destinationConfirmed() ||
      tree.id === this.selectedTreeId() ||
      (!this.popupTreeSelected() && !this.progress.canVisitDemoTree(tree.id))
    ) {
      this.walkSession.setPlanningError('路線或種植點已變更，請重新選擇沿途種植點。');
      this.closeStationPopup();
      return;
    }
    this.closeStationPopup();
    this.treeStopToggle.emit(tree.id);
  }

  private readonly taskMarkerEffect = effect(() => {
    const ready = this.mapReady();
    const points = this.taskPoints();
    const selected = this.walkSession.taskPoints();
    const planning = this.walkSession.isPlanning();
    const taskRoutes = this.walkSession.taskRoutes();
    const activeRoute = this.walkSession.hasActiveRoute();
    const checkedInTaskIds = this.walkSession.checkedInTaskIds();
    this.clearTaskMarkers();
    if (!ready || !this.map) return;
    for (const task of planning ? points : activeRoute ? selected : points) {
      const isSelected = selected.some((point) => point.id === task.id);
      const canToggle =
        planning &&
        this.walkSession.destinationConfirmed() &&
        (cmsPublication().managed || taskRoutes.some((point) => point.id === task.id));
      const canCheckIn = !planning && activeRoute;
      const canBrowse = !planning && !activeRoute && cmsPublication().managed;
      const claimed = checkedInTaskIds.includes(task.id);
      const interactionHint = canToggle
        ? `${isSelected ? '已加入，' : ''}點擊開啟路線選項，長按查看優惠詳情`
        : '補給站載入後可加入';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'supply-station-marker';
      button.title = canCheckIn
        ? `${task.name} · 補給站（${claimed ? '本次散步已領取' : '查看並打卡領取資源'}）`
        : `${task.name} · 補給站 · 約增加 ${task.estimatedExtraSteps} 步（${interactionHint}）`;
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(isSelected));
      const icon = document.createElement('img');
      icon.src = '/images/assets/supply-station-icon.svg';
      icon.alt = '';
      button.append(icon);
      if (isSelected) {
        const check = document.createElement('span');
        check.className = 'supply-station-marker__check';
        check.setAttribute('aria-hidden', 'true');
        button.append(check);
      }
      button.disabled = !canToggle && !canCheckIn && !canBrowse;
      this.taskMarkerGestureCleanups.push(
        this.bindPlanningMarkerActions(
          button,
          () => {
            if (canToggle) this.openStationPopup(task);
            else if (canCheckIn) this.stationCheckIn.emit(task.id);
            else if (canBrowse) this.stationDetails.emit(task.id);
          },
          () => {
            if (canToggle) {
              this.closeStationPopup();
              this.stationDetails.emit(task.id);
            }
          },
        ),
      );
      this.taskMarkers.push(
        new mapboxgl.Marker({ element: button, anchor: 'center' })
          .setLngLat([task.position.longitude, task.position.latitude])
          .addTo(this.map),
      );
      this.stationClusterPoints.push({ id: task.id, button, position: task.position });
    }
    this.syncClusterSource();
  });
  private readonly locationEffect = effect(() => {
    const position = this.ls.current();
    untracked(() => this.syncCurrentPosition(position));
  });
  private readonly routeEffect = effect(() => {
    const isReady = this.mapReady();
    const route = this.walkSession.route();
    if (!isReady) return;

    if (route.length > 0) {
      this.drawRoute(route);
    } else {
      this.clearRoute();
    }
  });

  ngAfterViewInit(): void {
    if (settings.mockMap) {
      return;
    }

    const mapboxAccessToken = getMapboxAccessToken();
    if (!mapboxAccessToken) {
      this.mapError.set('地圖服務尚未設定，請提供有效的 Mapbox public token。');
      return;
    }

    mapboxgl.accessToken = mapboxAccessToken;
    // Keep the prebuilt worker out of Angular's optimizer. Re-minifying the
    // embedded blob worker breaks its shared variable references in production.
    if (typeof Worker !== 'undefined') {
      mapboxgl.workerClass = class extends Worker {
        constructor() {
          super(new URL('assets/mapbox/3.32.0/mapbox-gl-csp-worker.js', document.baseURI));
        }
      };
    }
    const mapContainer = this.mapElement()!.nativeElement;
    const initialPosition = this.ls.current() ?? {
      longitude: 121.567,
      latitude: 25.082,
    };
    try {
      this.map = new mapboxgl.Map({
        attributionControl: false,
        container: mapContainer,
        style: 'mapbox://styles/mapbox/standard',
        center: [initialPosition.longitude, initialPosition.latitude + 0.001],
        zoom: 17,
        pitch: 50,
        language: 'zh-Hant',
        config: {
          basemap: {
            theme: 'faded',
            showPlaceLabels: false,
            showPointOfInterestLabels: false,
            show3dObjects: true,
            show3dTrees: true,
          },
        },
      });
    } catch {
      this.reportMapError();
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.map?.resize();
      this.schedulePopupFit();
    });
    this.resizeObserver.observe(mapContainer);
    requestAnimationFrame(() => {
      this.map?.resize();
    });
    this.map.on('error', (event) => {
      // Standard may request HD roads that are unavailable to this account.
      // That optional source must not tear down the remaining usable basemap.
      const error = event.error as Error & { url?: string };
      const resource = error?.url ?? error?.message ?? '';
      if (/\bmapbox\.hd-road-v1-bounded(?:\.json)?\b/.test(resource)) return;
      this.reportMapError();
    });
    this.map.on('load', async () => {
      try {
        this.map?.resize();
        this.map?.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'right');
        this.bearingChange.emit(this.map?.getBearing() ?? 0);
        await this.drawDestination();

        this.map?.addSource('user-position', {
          type: 'geojson',
          data: userPositionFeature(this.ls.current()),
        });
        this.map?.addLayer({
          id: 'user-position-point',
          type: 'circle',
          source: 'user-position',
          slot: 'top',
          paint: {
            'circle-radius': 9,
            'circle-color': '#176bff',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 3,
          },
        });
        const headingElement = this.playerHeadingElement()!.nativeElement;
        this.playerHeadingMarker = new mapboxgl.Marker({
          element: headingElement,
          anchor: 'center',
          rotationAlignment: 'map',
          pitchAlignment: 'map',
        })
          .setLngLat([initialPosition.longitude, initialPosition.latitude])
          .addTo(this.map!);
        this.mapReady.set(true);
        this.syncCurrentPosition(this.ls.current());
        this.camera.attach(this);
      } catch {
        this.reportMapError();
      }
    });
    this.map.on('rotate', () => {
      this.bearingChange.emit(this.map?.getBearing() ?? 0);
    });
    this.map.on('move', () => this.reportPlayerCenterOffset(this.ls.current()));
    this.map.on('moveend', () => this.schedulePopupFit());
    this.map.on('render', () => this.renderClusters());
    for (const interaction of ['dragstart', 'rotatestart', 'pitchstart'] as const) {
      this.map.on(interaction, (event) => {
        if ('originalEvent' in event && event.originalEvent) {
          this.camera.stopFollowing(this);
        }
      });
    }
  }

  private reportMapError(): void {
    this.mapReady.set(false);
    this.camera.detach(this);
    this.mapError.set('地圖目前無法載入，請檢查 Mapbox token 與部署網域限制。');
  }

  ngOnDestroy(): void {
    this.closeStationPopup();
    this.mapReady.set(false);
    this.camera.detach(this);
    this.resizeObserver?.disconnect();
    this.clearTaskMarkers();
    this.clearTreePopups();
    for (const cleanup of this.treeMarkerGestureCleanups) cleanup();
    this.treeMarkerGestureCleanups = [];
    for (const { marker } of this.treeMarkers.values()) marker.remove();
    this.treeMarkers.clear();
    for (const marker of this.clusterMarkers.values()) marker.remove();
    this.clusterMarkers.clear();
    this.clusterRevision++;
    this.playerHeadingMarker?.remove();
    this.map?.remove();
  }

  private clearTaskMarkers(): void {
    for (const cleanup of this.taskMarkerGestureCleanups) cleanup();
    this.taskMarkerGestureCleanups = [];
    for (const marker of this.taskMarkers) marker.remove();
    this.taskMarkers = [];
    this.stationClusterPoints = [];
  }

  /**Dispatches marker taps and long presses without letting a long press trigger a tap. */
  clickIcon(treeId: string): void {
    const planning = this.walkSession.isPlanning();
    if (!planning) {
      this.cultivationSelect.emit(treeId);
      return;
    }
    if (!this.walkSession.destinationConfirmed() && this.progress.canVisitDemoTree(treeId)) {
      this.destinationSelect.emit(treeId);
    }
  }

  longPressIcon(treeId: string): void {
    if (!this.walkSession.isPlanning()) return;
    const eligible = this.progress.canVisitDemoTree(treeId);
    const selectedStop = this.walkSession.treeStops().some((point) => point.id === treeId);
    if (
      this.walkSession.destinationConfirmed() &&
      treeId !== this.selectedTreeId() &&
      (eligible || selectedStop)
    ) {
      this.openTreeStopPopup(treeId);
      return;
    }
    this.cultivationSelect.emit(treeId);
  }

  private bindPlanningMarkerActions(
    button: HTMLButtonElement,
    onTap: () => void,
    onLongPress: () => void,
  ): () => void {
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let clickResetTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressTriggered = false;
    let suppressClick = false;
    const clearPressTimer = () => {
      if (pressTimer === null) return;
      clearTimeout(pressTimer);
      pressTimer = null;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!this.walkSession.isPlanning() || event.button !== 0 || button.disabled) return;
      event.stopPropagation();
      clearPressTimer();
      if (clickResetTimer !== null) {
        clearTimeout(clickResetTimer);
        clickResetTimer = null;
      }
      suppressClick = false;
      longPressTriggered = false;
      pressTimer = setTimeout(() => {
        pressTimer = null;
        if (!this.walkSession.isPlanning()) return;
        longPressTriggered = true;
        onLongPress();
      }, PLANNING_MARKER_LONG_PRESS_MS);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (this.walkSession.isPlanning()) event.stopPropagation();
      clearPressTimer();
      if (!longPressTriggered) return;
      longPressTriggered = false;
      suppressClick = true;
      clickResetTimer = setTimeout(() => {
        suppressClick = false;
        clickResetTimer = null;
      }, 0);
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (this.walkSession.isPlanning()) event.stopPropagation();
      clearPressTimer();
      longPressTriggered = false;
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (this.walkSession.isPlanning()) event.stopPropagation();
      clearPressTimer();
      if (longPressTriggered) {
        longPressTriggered = false;
        suppressClick = true;
      }
    };
    const onClick = (event: MouseEvent) => {
      event.stopPropagation();
      if (suppressClick) {
        event.preventDefault();
        suppressClick = false;
        if (clickResetTimer !== null) {
          clearTimeout(clickResetTimer);
          clickResetTimer = null;
        }
        return;
      }
      onTap();
    };
    const onContextMenu = (event: MouseEvent) => {
      if (!this.walkSession.isPlanning()) return;
      event.preventDefault();
      event.stopPropagation();
    };
    button.addEventListener('pointerdown', onPointerDown);
    button.addEventListener('pointerup', onPointerUp);
    button.addEventListener('pointercancel', onPointerCancel);
    button.addEventListener('pointerleave', onPointerLeave);
    button.addEventListener('click', onClick);
    button.addEventListener('contextmenu', onContextMenu);
    return () => {
      clearPressTimer();
      if (clickResetTimer !== null) clearTimeout(clickResetTimer);
      button.removeEventListener('pointerdown', onPointerDown);
      button.removeEventListener('pointerup', onPointerUp);
      button.removeEventListener('pointercancel', onPointerCancel);
      button.removeEventListener('pointerleave', onPointerLeave);
      button.removeEventListener('click', onClick);
      button.removeEventListener('contextmenu', onContextMenu);
    };
  }

  applyCameraIntent(intent: MapCameraIntent): void {
    const map = this.map;
    if (!map || !this.mapReady()) return;

    if (intent.kind === 'player' || intent.kind === 'follow-player') {
      map.easeTo({
        center: [intent.position.longitude, intent.position.latitude],
        zoom: 17,
        bearing:
          intent.kind === 'follow-player' && Number.isFinite(intent.position.heading)
            ? intent.position.heading
            : 0,
        pitch: intent.kind === 'follow-player' ? 50 : 0,
        duration: 500,
      });
      return;
    }

    if (intent.kind === 'planning-overview') {
      map.easeTo({
        center: [intent.position.longitude, intent.position.latitude],
        zoom: 14,
        duration: 500,
      });
      return;
    }

    if (intent.kind === 'recommendations-overview') {
      this.focusRecommendedTrees(intent);
      return;
    }

    this.focusWalkRoute(intent);
  }

  private focusRecommendedTrees(
    intent: Extract<MapCameraIntent, { kind: 'recommendations-overview' }>,
  ): void {
    const map = this.map;
    if (!map) return;
    const bounds = new mapboxgl.LngLatBounds().extend([
      intent.player.longitude,
      intent.player.latitude,
    ]);
    for (const tree of intent.trees) bounds.extend([tree.longitude, tree.latitude]);
    const container = map.getContainer();
    const rect = container.getBoundingClientRect();
    const top = Math.max(0, (intent.visibleArea?.top ?? rect.top) - rect.top) + 12;
    const bottom = Math.max(0, rect.bottom - (intent.visibleArea?.bottom ?? rect.bottom)) + 12;
    const clearance = Math.min(150, Math.max(0, (container.clientHeight - top - bottom) / 3));
    const horizontal = Math.min(100, container.clientWidth / 3);
    const padding = {
      top: top + clearance,
      bottom: bottom + clearance,
      left: horizontal,
      right: horizontal,
    };
    if (padding.top + padding.bottom >= container.clientHeight) return;
    const fitted = map.cameraForBounds(bounds, { padding, maxZoom: 16, bearing: 0, pitch: 0 });
    if (!fitted || typeof fitted.zoom !== 'number') {
      this.mapError.set('目前無法顯示推薦小樹，請重新開始規劃。');
      return;
    }
    map.easeTo({
      ...fitted,
      padding,
      bearing: 0,
      pitch: 0,
      duration: 700,
      retainPadding: false,
    });
  }

  private focusWalkRoute(intent: Extract<MapCameraIntent, { kind: 'route-overview' }>): void {
    const map = this.map;
    if (!map || !this.mapReady()) return;

    const player = new mapboxgl.LngLat(intent.player.longitude, intent.player.latitude);
    const target = new mapboxgl.LngLat(intent.destination.longitude, intent.destination.latitude);
    const bounds = new mapboxgl.LngLatBounds().extend(player).extend(target);
    for (const coordinate of intent.route) {
      bounds.extend([coordinate.longitude, coordinate.latitude]);
    }
    const container = map.getContainer();
    const padding = getRouteCameraPadding(
      container.clientHeight,
      container.getBoundingClientRect().top,
      intent.visibleArea,
    );
    if (!padding) return;

    const bearing = this.bearingBetween(player, target);
    const maxZoom = intent.visibleArea ? 19 : 15.5;
    const fittedCamera = map.cameraForBounds(bounds, {
      bearing,
      pitch: 55,
      padding,
      maxZoom,
    });
    if (!fittedCamera || typeof fittedCamera.zoom !== 'number') {
      this.mapError.set('目前無法計算路線視角，請重新選擇目的地。');
      return;
    }

    map.easeTo({
      ...fittedCamera,
      zoom: Math.min(maxZoom, fittedCamera.zoom + (intent.visibleArea ? 0.5 : 0)),
      bearing,
      pitch: 0,
      padding,
      duration: 1000,
      retainPadding: false,
    });
  }

  /**繪製行動路線 */
  private drawRoute(coordinates: readonly GeoPoint[]): void {
    const geoJsonCoordinates = coordinates.map((coordinate) => [
      coordinate.longitude,
      coordinate.latitude,
    ]);
    const data = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: geoJsonCoordinates },
    };

    const source = this.map?.getSource('task-route') as mapboxgl.GeoJSONSource | undefined;

    if (source) {
      source.setData(data);
      return;
    }

    this.map?.addSource('task-route', { type: 'geojson', data });
    this.map?.addLayer({
      id: 'task-route-line',
      type: 'line',
      source: 'task-route',
      slot: 'middle',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#EE6A17',
        'line-width': 6,
        'line-opacity': 0.85,
      },
    });
  }

  private clearRoute(): void {
    if (this.map?.getLayer('task-route-line')) {
      this.map.removeLayer('task-route-line');
    }
    if (this.map?.getSource('task-route')) {
      this.map.removeSource('task-route');
    }
  }

  /**繪製目標地點 */
  drawDestination(): void {
    if (!this.map) return;
    this.renderedTreeSignature = JSON.stringify(currentHomeTrees());
    for (const tree of currentHomeTrees()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tree-marker';
      button.title = `${tree.nickName} · ${tree.species} · ${tree.poiName}`;
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(tree.id === this.selectedTreeId()));
      const icon = document.createElement('img');
      icon.src = '/images/assets/cathay-tree-icon.svg';
      icon.alt = '';
      button.append(icon);
      this.treeMarkerGestureCleanups.push(
        this.bindPlanningMarkerActions(
          button,
          () => this.clickIcon(tree.id),
          () => this.longPressIcon(tree.id),
        ),
      );
      const marker = new mapboxgl.Marker({ element: button, anchor: 'center' })
        .setLngLat([tree.position.longitude, tree.position.latitude])
        .addTo(this.map);
      this.treeMarkers.set(tree.id, { marker, button });
    }
    if (this.map.getSource('home-marker-clusters')) {
      this.syncClusterSource();
      return;
    }
    this.map.addSource('home-marker-clusters', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterRadius: 55,
      clusterMaxZoom: 18,
    });
    this.map.addLayer({
      id: 'home-marker-cluster-data',
      type: 'circle',
      source: 'home-marker-clusters',
      slot: 'top',
      paint: { 'circle-radius': 0, 'circle-opacity': 0 },
    });
    this.syncClusterSource();
  }

  private clusterPoints() {
    const recommendedSupplies = new Set(
      (cmsRouteRoles() ?? [])
        .filter((selection) => selection.role === 'supply')
        .map((selection) => selection.merchantId),
    );
    return [
      ...currentHomeTrees().flatMap((tree) => {
        const entry = this.treeMarkers.get(tree.id);
        return entry && !entry.button.hidden
          ? [{ id: `tree:${tree.id}`, button: entry.button, position: tree.position }]
          : [];
      }),
      ...this.stationClusterPoints
        .filter((point) => !recommendedSupplies.has(point.id))
        .map((point) => ({ ...point, id: `station:${point.id}` })),
    ];
  }

  private syncClusterSource(): void {
    const source = this.map?.getSource('home-marker-clusters') as
      mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    this.clusterRevision++;
    for (const marker of this.clusterMarkers.values()) marker.remove();
    this.clusterMarkers.clear();
    for (const { button } of this.treeMarkers.values()) button.style.visibility = '';
    for (const { button } of this.stationClusterPoints) button.style.visibility = '';
    source.setData({
      type: 'FeatureCollection',
      features: this.clusterPoints().map((point) => ({
        type: 'Feature',
        properties: { id: point.id },
        geometry: {
          type: 'Point',
          coordinates: [point.position.longitude, point.position.latitude],
        },
      })),
    });
  }

  private renderClusters(): void {
    const map = this.map;
    if (
      !map ||
      !this.mapReady() ||
      !map.getSource('home-marker-clusters') ||
      !map.isSourceLoaded('home-marker-clusters')
    )
      return;
    // Mapbox's package lacks GeoJSON declarations in this repo; use the point shape read here.
    const features = map.querySourceFeatures('home-marker-clusters') as unknown as {
      geometry: { type: string; coordinates: [number, number] };
      properties: { id?: string; cluster_id?: number; point_count?: number };
    }[];
    const singles = new Set(
      features
        .filter((feature) => !feature.properties.point_count)
        .map((feature) => feature.properties.id),
    );
    for (const point of this.clusterPoints())
      point.button.style.visibility = singles.has(point.id) ? '' : 'hidden';
    const visible = new Set<number>();
    for (const feature of features) {
      const { cluster_id: id, point_count: count } = feature.properties;
      if (id === undefined || !count || feature.geometry.type !== 'Point' || visible.has(id))
        continue;
      visible.add(id);
      if (this.clusterMarkers.has(id)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'home-map-cluster';
      button.textContent = String(count);
      button.setAttribute('aria-label', `${count} 個地點，點擊放大展開`);
      Object.assign(button.style, {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: '3px solid white',
        background: '#e77732',
        color: 'white',
        fontSize: '16px',
        fontWeight: '700',
        cursor: 'pointer',
        boxShadow: '0 2px 6px #0003',
      });
      const coordinates = feature.geometry.coordinates;
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const revision = this.clusterRevision;
        const source = map.getSource('home-marker-clusters') as mapboxgl.GeoJSONSource;
        source.getClusterExpansionZoom(id, (error, zoom) => {
          if (
            error ||
            zoom == null ||
            !this.mapReady() ||
            this.map !== map ||
            revision !== this.clusterRevision
          )
            return;
          this.camera.stopFollowing(this);
          this.closeStationPopup();
          map.easeTo({ center: coordinates, zoom, duration: 500 });
        });
      });
      this.clusterMarkers.set(
        id,
        new mapboxgl.Marker({ element: button, anchor: 'center' })
          .setLngLat(coordinates)
          .addTo(map),
      );
    }
    for (const [id, marker] of this.clusterMarkers) {
      if (!visible.has(id)) {
        marker.remove();
        this.clusterMarkers.delete(id);
      }
    }
  }

  private syncCurrentPosition(position: LocationPoint | null): void {
    const headingElement = this.playerHeadingElement()?.nativeElement;
    const heading = position?.heading;
    const hasHeading = typeof heading === 'number' && Number.isFinite(heading);
    if (headingElement) headingElement.hidden = !this.mapReady() || !position || !hasHeading;
    if (!this.map || !this.mapReady() || !position) {
      this.reportPlayerCenterOffset(position);
      return;
    }
    const source = this.map.getSource('user-position') as mapboxgl.GeoJSONSource | undefined;
    source?.setData(userPositionFeature(position));
    this.playerHeadingMarker?.setLngLat([position.longitude, position.latitude]);
    if (hasHeading) this.playerHeadingMarker?.setRotation(heading);
    if (this.camera.isFollowingPlayer()) {
      this.map.jumpTo({
        center: [position.longitude, position.latitude],
        ...(hasHeading ? { bearing: heading } : {}),
      });
    }
    this.reportPlayerCenterOffset(position);
  }

  private reportPlayerCenterOffset(position: LocationPoint | null): void {
    const map = this.map;
    if (!map || !this.mapReady() || !position) {
      this.camera.reportPlayerCenterOffset(this, null);
      return;
    }
    const container = map.getContainer();
    if (container.clientWidth <= 0 || container.clientHeight <= 0) {
      this.camera.reportPlayerCenterOffset(this, null);
      return;
    }
    const player = map.project([position.longitude, position.latitude]);
    this.camera.reportPlayerCenterOffset(
      this,
      Math.hypot(player.x - container.clientWidth / 2, player.y - container.clientHeight / 2),
    );
  }

  private normalizeBearing(bearing: number): number {
    return ((bearing % 360) + 360) % 360;
  }

  private bearingBetween(start: mapboxgl.LngLat, end: mapboxgl.LngLat): number {
    const startLatitude = (start.lat * Math.PI) / 180;
    const endLatitude = (end.lat * Math.PI) / 180;
    const longitudeDifference = ((((end.lng - start.lng + 540) % 360) - 180) * Math.PI) / 180;
    const yComponent = Math.sin(longitudeDifference) * Math.cos(endLatitude);
    const xComponent =
      Math.cos(startLatitude) * Math.sin(endLatitude) -
      Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDifference);

    return this.normalizeBearing((Math.atan2(yComponent, xComponent) * 180) / Math.PI);
  }
}

function userPositionFeature(position: LocationPoint | null) {
  const longitude = position?.longitude ?? 121.567;
  const latitude = position?.latitude ?? 25.082;

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
  };
}
