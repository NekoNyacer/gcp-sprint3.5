import {
  afterNextRender,
  Component,
  computed,
  output,
  effect,
  ElementRef,
  input,
  OnDestroy,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import mapboxgl from 'mapbox-gl';
import { getMapboxAccessToken } from '../../mapbox-runtime-config';
import { IonButton } from '@ionic/angular';
import { Tree, TreeCardComponent } from './tree-card/tree-card.component';
import { GeoPoint } from '../../shared/models/geo.models';

export type CollectionMapTree = Tree & { position: GeoPoint };

type CollectionPointFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Record<string, string | number>;
};
type CollectionClickEvent = {
  features?: readonly {
    geometry: { type: string; coordinates: number[] };
    properties?: Record<string, unknown>;
  }[];
};

export function collectionMapData(trees: readonly CollectionMapTree[]): {
  type: 'FeatureCollection';
  features: CollectionPointFeature[];
} {
  return {
    type: 'FeatureCollection',
    features: trees.map((tree) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [tree.position.longitude, tree.position.latitude] },
      properties: {
        id: tree.id,
        name: tree.name,
        location: tree.location,
        species: tree.species,
        status: tree.harvested ? '已收成' : tree.canHarvest ? '可收成' : tree.stage,
      },
    })),
  };
}

@Component({
  selector: 'app-collection-map',
  imports: [TreeCardComponent, IonButton],
  template: `
    <div #container class="map" aria-label="收藏樹木地圖"></div>
    <div hidden>
      <section #cardContent class="tree-popup-card">
        @if (selectedTree(); as tree) {
          <app-tree-card [tree]="tree" />
          <ion-button color="secondary" expand="block" (click)="viewTree(tree.id)"
            >查看詳細</ion-button
          >
        }
      </section>
    </div>
    @if (error()) {
      <p class="message" role="status">{{ error() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 0;
    }
    .tree-popup-card {
      width: min(240px, 65vw);
    }
    .map {
      position: absolute;
      inset: 0;
    }
    .message {
      position: absolute;
      top: 12px;
      left: 16px;
      right: 56px;
      margin: 0;
      padding: 12px;
      border-radius: 12px;
      background: white;
      color: #315347;
      z-index: 1;
    }
  `,
})
export class CollectionMapComponent implements OnDestroy {
  readonly trees = input.required<readonly CollectionMapTree[]>();
  readonly cultivationSelect = output<string>();
  readonly selectedId = signal<string | null>(null);
  readonly selectedTree = computed(
    () => this.trees().find((tree) => tree.id === this.selectedId()) ?? null,
  );
  private readonly cardContent = viewChild.required<ElementRef<HTMLElement>>('cardContent');
  private readonly markers = new Map<string, { marker: mapboxgl.Marker; cleanup: () => void }>();
  private fittedIds = '';
  readonly error = signal<string | null>(null);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly ready = signal(false);
  private map?: mapboxgl.Map;
  private observer?: ResizeObserver;
  private popup?: mapboxgl.Popup;
  private revision = 0;

  constructor() {
    afterNextRender(() => this.initialize());
    effect(() => {
      const trees = this.trees();
      if (!this.ready()) return;
      this.revision++;
      const selectedId = untracked(this.selectedId);
      if (!trees.some((tree) => tree.id === selectedId)) this.popup?.remove();
      this.clearMarkers();
      (this.map?.getSource('collection-trees') as mapboxgl.GeoJSONSource)?.setData(
        collectionMapData(trees),
      );
      const ids = trees.map((tree) => tree.id).join('|');
      if (ids !== this.fittedIds) {
        this.fittedIds = ids;
        this.fitTrees(trees);
      }
    });
  }

  private initialize(): void {
    const token = getMapboxAccessToken();
    if (!token) {
      this.error.set('尚未設定地圖存取權杖');
      return;
    }
    if (typeof Worker !== 'undefined') {
      mapboxgl.workerClass = class extends Worker {
        constructor() {
          super(new URL('assets/mapbox/3.32.0/mapbox-gl-csp-worker.js', document.baseURI));
        }
      };
    }
    try {
      const map = (this.map = new mapboxgl.Map({
        container: this.container().nativeElement,
        accessToken: token,
        style: 'mapbox://styles/mapbox/standard',
        center: [121.52, 25.05],
        zoom: 11,
        language: 'zh-Hant',
      }));
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
      this.observer = new ResizeObserver(() => map.resize());
      this.observer.observe(this.container().nativeElement);
      map.on('error', (event) => {
        const error = event.error as Error & { url?: string };
        if (/\bmapbox\.hd-road-v1-bounded(?:\.json)?\b/.test(error?.url ?? error?.message ?? ''))
          return;
        this.error.set('地圖暫時無法顯示，請切換清單或稍後再試');
      });
      map.on('load', () => {
        try {
          map.addSource('collection-trees', {
            type: 'geojson',
            data: collectionMapData(this.trees()),
            cluster: true,
            clusterRadius: 55,
            clusterMaxZoom: 18,
          });
          map.addLayer({
            id: 'collection-clusters',
            type: 'circle',
            source: 'collection-trees',
            slot: 'top',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': '#e77732',
              'circle-radius': 24,
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 3,
              'circle-emissive-strength': 1,
            },
          });
          map.addLayer({
            id: 'collection-count',
            type: 'symbol',
            source: 'collection-trees',
            slot: 'top',
            filter: ['has', 'point_count'],
            layout: {
              'text-field': ['to-string', ['get', 'point_count']],
              'text-size': 15,
              'text-allow-overlap': true,
            },
            paint: { 'text-color': '#fff' },
          });
          map.addLayer({
            id: 'collection-points',
            type: 'circle',
            source: 'collection-trees',
            slot: 'top',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': '#008566',
              'circle-opacity': 0,
              'circle-stroke-opacity': 0,
              'circle-radius': 18,
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 3,
              'circle-emissive-strength': 1,
            },
          });
          map.on('click', 'collection-clusters', (event) =>
            this.expandCluster(event as unknown as CollectionClickEvent),
          );
          map.on('render', () => this.renderTreeMarkers());
          this.ready.set(true);
        } catch {
          this.error.set('地圖暫時無法顯示，請切換清單或稍後再試');
        }
      });
    } catch {
      this.error.set('地圖暫時無法顯示，請切換清單或稍後再試');
    }
  }

  private fitTrees(trees: readonly CollectionMapTree[]): void {
    if (!trees.length || !this.map) return;
    const bounds = new mapboxgl.LngLatBounds();
    for (const tree of trees) bounds.extend([tree.position.longitude, tree.position.latitude]);
    this.map.fitBounds(bounds, { padding: 64, maxZoom: 16, duration: 0 });
  }

  private expandCluster(event: CollectionClickEvent): void {
    const map = this.map;
    const feature = event.features?.[0];
    if (!map || feature?.geometry.type !== 'Point') return;
    const revision = this.revision;
    const coordinates = feature.geometry.coordinates as [number, number];
    const source = map.getSource('collection-trees') as mapboxgl.GeoJSONSource;
    source.getClusterExpansionZoom(Number(feature.properties?.['cluster_id']), (error, zoom) => {
      if (error || zoom == null || this.map !== map || revision !== this.revision) return;
      map.easeTo({ center: coordinates, zoom, duration: 500 });
    });
  }

  private showTree(event: CollectionClickEvent): void {
    const feature = event.features?.[0];
    if (!this.map || feature?.geometry.type !== 'Point') return;
    const tree = this.trees().find((tree) => tree.id === feature.properties?.['id']);
    if (!tree) return;
    this.map.easeTo({
      center: [tree.position.longitude, tree.position.latitude],
      offset: [0, Math.round(this.container().nativeElement.clientHeight * 0.3)],
      duration: 500,
    });
    this.selectedId.set(tree.id);
    this.popup?.remove();
    this.popup = new mapboxgl.Popup({
      anchor: 'bottom',
      offset: 26,
      maxWidth: '280px',
      closeButton: false,
    })
      .setLngLat([tree.position.longitude, tree.position.latitude])
      .setDOMContent(this.cardContent().nativeElement)
      .addTo(this.map);
  }

  viewTree(id: string): void {
    this.popup?.remove();
    this.cultivationSelect.emit(id);
  }

  private clearMarkers(): void {
    for (const { marker, cleanup } of this.markers.values()) {
      cleanup();
      marker.remove();
    }
    this.markers.clear();
  }

  private renderTreeMarkers(): void {
    const map = this.map;
    if (!map || !this.ready() || !map.isSourceLoaded('collection-trees')) return;
    const features = map.querySourceFeatures('collection-trees') as unknown as NonNullable<
      CollectionClickEvent['features']
    >;
    const visible = new Set(
      features
        .filter((feature) => !feature.properties?.['point_count'])
        .map((feature) => String(feature.properties?.['id'])),
    );
    for (const [id, entry] of this.markers) {
      if (!visible.has(id)) {
        entry.cleanup();
        entry.marker.remove();
        this.markers.delete(id);
      }
    }
    for (const tree of this.trees()) {
      if (!visible.has(tree.id) || this.markers.has(tree.id)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tree-marker collection-tree-marker';
      button.setAttribute('aria-label', `${tree.name} ? ${tree.location}`);
      const image = document.createElement('img');
      image.src = '/images/assets/cathay-tree-icon.svg';
      image.alt = '';
      button.append(image);
      const cleanup = bindCollectionTreeGesture(
        button,
        () =>
          this.showTree({
            features: [
              {
                geometry: {
                  type: 'Point',
                  coordinates: [tree.position.longitude, tree.position.latitude],
                },
                properties: { id: tree.id },
              },
            ],
          }),
        () => this.viewTree(tree.id),
      );
      const marker = new mapboxgl.Marker({ element: button, anchor: 'center' })
        .setLngLat([tree.position.longitude, tree.position.latitude])
        .addTo(map);
      this.markers.set(tree.id, { marker, cleanup });
    }
  }

  ngOnDestroy(): void {
    this.revision++;
    this.clearMarkers();
    this.observer?.disconnect();
    this.popup?.remove();
    this.map?.remove();
    this.map = undefined;
  }
}

/** A tap previews the card; a stationary 500 ms press opens cultivation. */
export function bindCollectionTreeGesture(
  button: HTMLButtonElement,
  tap: () => void,
  hold: () => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let suppressClick = false;
  let start: { x: number; y: number } | null = null;
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    start = null;
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    cancel();
    suppressClick = false;
    start = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      suppressClick = true;
      cancel();
      hold();
    }, 500);
  };
  const move = (event: PointerEvent) => {
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
      suppressClick = true;
      cancel();
    }
  };
  const click = (event: MouseEvent) => {
    event.stopPropagation();
    if (!suppressClick) tap();
    suppressClick = false;
  };
  const context = (event: Event) => event.preventDefault();
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointermove', move);
  button.addEventListener('pointerup', cancel);
  button.addEventListener('pointercancel', cancel);
  button.addEventListener('pointerleave', cancel);
  button.addEventListener('click', click);
  button.addEventListener('contextmenu', context);
  window.addEventListener('blur', cancel);
  return () => {
    cancel();
    button.removeEventListener('pointerdown', down);
    button.removeEventListener('pointermove', move);
    button.removeEventListener('pointerup', cancel);
    button.removeEventListener('pointercancel', cancel);
    button.removeEventListener('pointerleave', cancel);
    button.removeEventListener('click', click);
    button.removeEventListener('contextmenu', context);
    window.removeEventListener('blur', cancel);
  };
}
