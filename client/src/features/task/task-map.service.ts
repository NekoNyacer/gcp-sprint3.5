import { inject, InjectionToken, OnDestroy, Service, signal } from '@angular/core';
import mapboxgl from 'mapbox-gl';
import { getMapboxAccessToken } from '../../mapbox-runtime-config';
import type { GeoPoint } from '../../shared/models/geo.models';
import type { TaskItem } from './task.models';
import { DEFAULT_TASK_RADIUS } from '../../../../functions/src/task-domain';

export const TASK_MAP_TOKEN = new InjectionToken<string>('Task map token', {
  providedIn: 'root',
  factory: getMapboxAccessToken,
});

/** One retained map host for all Task detail visits, separate from Home's map. */
@Service()
export class TaskMapService implements OnDestroy {
  readonly error = signal('');
  private readonly token = inject(TASK_MAP_TOKEN);
  private map?: mapboxgl.Map;
  private host?: HTMLDivElement;
  private observer?: ResizeObserver;
  private target?: mapboxgl.Marker;
  private player?: mapboxgl.Marker;
  private task: TaskItem | null = null;
  private position: GeoPoint | null = null;
  private fittedId = '';
  private ready = false;
  private attached = false;

  attach(container: HTMLElement): void {
    this.attached = true;
    if (this.host) {
      container.append(this.host);
      this.map?.resize();
      this.render();
      return;
    }
    const token = this.token;
    if (!token) {
      this.error.set('地圖尚未設定，仍可查看步數與目的地資訊。');
      return;
    }
    this.error.set('');
    this.host = document.createElement('div');
    Object.assign(this.host.style, { width: '100%', height: '100%' });
    container.append(this.host);
    if (typeof Worker !== 'undefined') {
      mapboxgl.workerClass = class extends Worker {
        constructor() {
          super(new URL('assets/mapbox/3.32.0/mapbox-gl-csp-worker.js', document.baseURI));
        }
      };
    }
    try {
      this.map = new mapboxgl.Map({
        container: this.host,
        accessToken: token,
        style: 'mapbox://styles/mapbox/streets-v12',
        language: 'zh-Hant',
        center: [121.45475, 25.001],
        zoom: 14,
        attributionControl: true,
      });
      this.map.on('load', () => {
        this.ready = true;
        if (this.attached) this.render();
      });
      this.map.on('error', (event) => {
        if (event.error) this.error.set('地圖暫時無法載入，請檢查連線後重試。');
      });
      this.observer = new ResizeObserver(() => {
        if (this.attached) this.map?.resize();
      });
      this.observer.observe(this.host);
    } catch {
      this.error.set('無法顯示地圖，仍可查看步數與目的地資訊。');
      this.release();
    }
  }
  detach(container?: HTMLElement): void {
    if (container && this.host?.parentElement !== container) return;
    this.attached = false;
    this.map?.stop();
    this.host?.remove();
  }
  update(task: TaskItem | null, position: GeoPoint | null): void {
    this.task = task;
    this.position = position;
    if (this.attached) this.render();
  }
  retry(container: HTMLElement): void {
    this.release();
    this.attach(container);
  }
  private render(): void {
    if (!this.map || !this.ready || !this.task) return;
    const point = this.task.destination;
    const lngLat: [number, number] = [point.longitude, point.latitude];
    if (!this.target)
      this.target = new mapboxgl.Marker({ color: '#f56a10' }).setLngLat(lngLat).addTo(this.map);
    else this.target.setLngLat(lngLat);
    if (this.position) {
      const player: [number, number] = [this.position.longitude, this.position.latitude];
      if (!this.player)
        this.player = new mapboxgl.Marker({ color: '#357ac8', scale: 0.7 })
          .setLngLat(player)
          .addTo(this.map);
      else this.player.setLngLat(player);
    } else {
      this.player?.remove();
      this.player = undefined;
    }
    const radius = this.task.radiusMeters ?? DEFAULT_TASK_RADIUS;
    const ring = Array.from({ length: 65 }, (_, i) => {
      const angle = (i / 64) * 2 * Math.PI;
      return [
        point.longitude +
          (radius * Math.cos(angle)) / (111320 * Math.cos((point.latitude * Math.PI) / 180)),
        point.latitude + (radius * Math.sin(angle)) / 111320,
      ];
    });
    const data = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [ring] },
    };
    const source = this.map.getSource('task-arrival') as mapboxgl.GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      this.map.addSource('task-arrival', { type: 'geojson', data });
      this.map.addLayer({
        id: 'task-arrival-fill',
        type: 'fill',
        source: 'task-arrival',
        paint: { 'fill-color': '#f56a10', 'fill-opacity': 0.12 },
      });
      this.map.addLayer({
        id: 'task-arrival-line',
        type: 'line',
        source: 'task-arrival',
        paint: { 'line-color': '#f56a10', 'line-width': 1.5 },
      });
    }
    const signature = `${this.task.taskId}:${point.latitude}:${point.longitude}:${radius}`;
    if (signature !== this.fittedId) {
      const bounds = new mapboxgl.LngLatBounds(lngLat, lngLat);
      ring.forEach((p) => bounds.extend(p as [number, number]));
      if (this.position) bounds.extend([this.position.longitude, this.position.latitude]);
      this.map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 });
      this.fittedId = signature;
    }
  }
  private release(): void {
    this.observer?.disconnect();
    this.target?.remove();
    this.player?.remove();
    this.map?.remove();
    this.host?.remove();
    this.map = undefined;
    this.host = undefined;
    this.target = undefined;
    this.player = undefined;
    this.ready = false;
    this.fittedId = '';
  }
  ngOnDestroy(): void {
    this.release();
  }
}
