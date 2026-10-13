import { Component, ElementRef, effect, inject, OnDestroy, output, viewChild } from '@angular/core';
import mapboxgl, { LngLatLike } from 'mapbox-gl';
import { LocationPoint, LocationStore } from '../../../shared/stores/location-store';
import {
  destination,
  routeCoordinatesByTree,
  settings,
} from '../../../environments/environment-dev';
import { mapboxAccessToken } from '../../../app/mapbox-config';

@Component({
  selector: 'app-home-map',
  templateUrl: './home-map.component.html',
  styleUrls: ['./home-map.component.scss'],
  imports: [],
})
export class HomeMapComponent implements OnDestroy {
  readonly bearingChange = output<number>();
  readonly settings = settings;
  private readonly ls = inject(LocationStore);
  private readonly mapElement = viewChild<ElementRef<HTMLDivElement>>('map');
  private map?: mapboxgl.Map;
  private resizeObserver?: ResizeObserver;
  private destinationClickHandlerRegistered = false;
  private mapReady = false;
  private walkRouteCoordinates: LngLatLike[] = [];
  private readonly locationEffect = effect(() => {
    this.syncCurrentPosition(this.ls.current(), this.ls.status() !== '行走中');
  });
  ngAfterViewInit(): void {
    if (settings.mockMap) {
      return;
    }
    mapboxgl.accessToken = mapboxAccessToken;
    const mapContainer = this.mapElement()!.nativeElement;
    this.map = new mapboxgl.Map({
      attributionControl: false,
      container: mapContainer,
      style: 'mapbox://styles/mapbox/standard',
      center: [this.ls.current()!.longitude, this.ls.current()!.latitude + 0.001],
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
    this.resizeObserver = new ResizeObserver(() => {
      this.map?.resize();
    });
    this.resizeObserver.observe(mapContainer);
    requestAnimationFrame(() => {
      this.map?.resize();
    });
    this.map.on('load', async () => {
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
      this.mapReady = true;
      this.syncCurrentPosition(this.ls.current());
    });
    this.map.on('rotate', () => {
      this.bearingChange.emit(this.map?.getBearing() ?? 0);
    });
  }

  ngOnDestroy(): void {
    this.mapReady = false;
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  chooseTree(treeId: string, destination: LngLatLike) {
    const lngLat = mapboxgl.LngLat.convert(destination);
    this.ls.setDestination([lngLat]);
    const routeCoordinates = routeCoordinatesByTree[treeId];
    if (routeCoordinates) {
      this.drawRoute(routeCoordinates);
    }
    this.map?.easeTo({
      center: lngLat,
      duration: 500,
    });
  }

  focusPlayer(zoom?: number) {
    const position = this.ls.current();
    if (!position) return;

    this.map?.easeTo({
      center: [position.longitude, position.latitude],
      ...(zoom === undefined ? {} : { zoom }),
      bearing: 0,
      pitch: 0,
      duration: 500,
    });
  }

  focusWalkRoute() {
    const map = this.map;
    const position = this.ls.current();
    const destination = this.ls.destination()?.[0];
    if (!map || !this.mapReady || !position || !destination) return;

    const player = new mapboxgl.LngLat(position.longitude, position.latitude);
    const target = mapboxgl.LngLat.convert(destination);
    const bounds = new mapboxgl.LngLatBounds().extend(player).extend(target);
    for (const coordinate of this.walkRouteCoordinates) {
      bounds.extend(mapboxgl.LngLat.convert(coordinate));
    }
    const mapHeight = map.getContainer().clientHeight;
    if (mapHeight === 0) return;

    map.fitBounds(bounds, {
      bearing: this.bearingBetween(player, target),
      pitch: 55,
      padding: {
        top: Math.round(mapHeight * 0.42),
        right: 24,
        bottom: Math.round(mapHeight * 0.18),
        left: 24,
      },
      maxZoom: 17,
      duration: 1000,
      retainPadding: false,
    });
  }

  /**控制縮放 */
  zoom(zoom: number) {
    this.map?.easeTo({
      zoom,
      duration: 500,
    });
  }

  /**繪製行動路線 */
  drawRoute(coordinates: LngLatLike[]) {
    this.walkRouteCoordinates = coordinates;
    const geoJsonCoordinates = coordinates.map((coordinate) =>
      mapboxgl.LngLat.convert(coordinate).toArray(),
    );
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
        'line-color': '#168f55',
        'line-width': 6,
        'line-opacity': 0.85,
      },
    });
  }

  /**移除圖層 */
  removeLayer(id: string) {
    if (this.map?.getLayer(id)) {
      this.map?.removeLayer(id);
    }
  }

  /**移除源頭 */
  removeSource(id: string) {
    if (this.map?.getSource(id)) {
      this.map?.removeSource(id);
    }
    if (id === 'task-route') {
      this.walkRouteCoordinates = [];
    }
  }

  /**繪製目標地點 */
  async drawDestination() {
    this.map?.addSource('task-destination', {
      type: 'geojson',
      data: destination,
    });
    await this.registerTreeIcon();
    this.map?.addLayer({
      id: 'task-destination-point',
      type: 'symbol',
      source: 'task-destination',
      slot: 'top',
      layout: {
        'icon-image': 'tree-marker',
        'icon-size': 0.8,
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
      },
    });
    if (this.map && !this.destinationClickHandlerRegistered) {
      this.map.on('click', 'task-destination-point', this.onDestinationClick);
      this.destinationClickHandlerRegistered = true;
    }
  }

  /**加入圖標點擊事件監聽 */
  private readonly onDestinationClick = (event: mapboxgl.MapMouseEvent) => {
    const feature = event.features?.[0]?.toJSON();
    if (feature?.geometry.type !== 'Point') return;
    const [longitude, latitude] = feature.geometry.coordinates;
    const treeId = feature.properties?.['treeId'];
    if (typeof treeId !== 'string') return;
    this.chooseTree(treeId, new mapboxgl.LngLat(longitude, latitude));
  };

  private syncCurrentPosition(position: LocationPoint | null, recenter = true): void {
    if (!this.map || !this.mapReady || !position) {
      return;
    }
    if (recenter) {
      this.map.jumpTo({
        center: [position.longitude, position.latitude],
      });
    }
    const source = this.map.getSource('user-position') as mapboxgl.GeoJSONSource | undefined;
    source?.setData(userPositionFeature(position));
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

  private async registerTreeIcon(): Promise<void> {
    const map = this.map;
    if (!map || map.hasImage('tree-marker')) return;

    const image = new Image();
    image.src = '/images/assets/cathay-tree-icon.svg';
    await image.decode();

    if (!map.hasImage('tree-marker')) {
      map.addImage('tree-marker', image, { pixelRatio: 2 });
    }
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
