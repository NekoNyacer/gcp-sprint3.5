import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CubButtonModule } from 'cub-lib-view-rootng/component/button';
import { CubInputModule } from 'cub-lib-view-rootng/component/input';
import { CubFormFieldModule } from 'cub-lib-view-rootng/component/form-field';
import { GoogleMapsService, MapsListener, MapsSdk, PickerMap, PickerMarker } from './google-maps.service';

@Component({
  selector: 'cms-location-picker', standalone: true,
  imports: [FormsModule, CubButtonModule, CubInputModule, CubFormFieldModule],
  templateUrl: './location-picker.component.html',
})
export class LocationPickerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Input() address = '';
  @Output() positionChange = new EventEmitter<{latitude: number; longitude: number; address?: string}>();
  @ViewChild('canvas', {static: true}) canvas!: ElementRef<HTMLElement>;
  readonly loader = inject(GoogleMapsService);
  private readonly zone = inject(NgZone);
  readonly loading = signal(false);
  readonly searching = signal(false);
  readonly error = signal('');
  readonly results = signal<import('./google-maps.service').GeocodeResult[]>([]);
  query = '';
  private sdk?: MapsSdk;
  private map?: PickerMap;
  private marker?: PickerMarker;
  private listeners: MapsListener[] = [];
  private destroyed = false;
  private generation = 0;
  ngAfterViewInit() { this.query = this.address; void this.initialize(); }
  ngOnChanges() {
    if (this.validPosition() && this.map && this.marker && !this.loader.error()) {
      this.marker.position = {lat: this.latitude!, lng: this.longitude!};
      this.map.panTo(this.marker.position);
    }
  }
  private validPosition() {
    return typeof this.latitude === 'number' && Number.isFinite(this.latitude) && Math.abs(this.latitude) <= 90 &&
      typeof this.longitude === 'number' && Number.isFinite(this.longitude) && Math.abs(this.longitude) <= 180;
  }
  async initialize() {
    if (this.loading() || this.map) return;
    this.loading.set(true); this.error.set('');
    try {
      const {sdk, mapId} = await this.loader.load();
      if (this.destroyed) return;
      this.sdk = sdk;
      const center = this.validPosition() ? {lat: this.latitude!, lng: this.longitude!} : {lat: 25.0134, lng: 121.4628};
      this.map = new sdk.Map(this.canvas.nativeElement, {center, zoom: 16, mapId, mapTypeControl: false, streetViewControl: false});
      this.marker = new sdk.marker.AdvancedMarkerElement({map: this.map, position: center, gmpDraggable: true, title: '拖曳以選擇位置'});
      const choose = (event: {latLng?: {lat(): number; lng(): number}}) => {
        if (event.latLng) this.zone.run(() => this.choose(event.latLng!.lat(), event.latLng!.lng()));
      };
      this.listeners = [this.map.addListener('click', choose), this.marker.addListener('dragend', choose)];
    } catch (error) {
      if (!this.destroyed) this.error.set(error instanceof Error ? error.message : '地圖載入失敗');
    } finally { if (!this.destroyed) this.loading.set(false); }
  }
  choose(latitude: number, longitude: number, address?: string) {
    ++this.generation;
    this.error.set('');
    this.searching.set(false); this.results.set([]);
    const position = {lat: Number(latitude.toFixed(6)), lng: Number(longitude.toFixed(6))};
    if (!this.loader.error()) {
      if (this.marker) this.marker.position = position;
      this.map?.panTo(position);
    }
    this.positionChange.emit({latitude: position.lat, longitude: position.lng, ...(address ? {address} : {})});
  }
  async search() {
    if (!this.sdk || this.loader.error() || !this.query.trim() || this.searching()) return;
    const generation = ++this.generation;
    this.searching.set(true); this.error.set(''); this.results.set([]);
    try {
      const response = await new this.sdk.Geocoder().geocode({address: this.query.trim(), region: 'TW'});
      if (this.destroyed || generation !== this.generation) return;
      this.results.set(response.results);
      if (!response.results.length) this.error.set('找不到地點，請改用完整地址或直接點選地圖。');
    } catch {
      if (!this.destroyed && generation === this.generation) this.error.set('地址搜尋失敗，請確認 Geocoding API 已啟用，或直接點選地圖。');
    } finally { if (!this.destroyed && generation === this.generation) this.searching.set(false); }
  }
  ngOnDestroy() {
    this.destroyed = true; ++this.generation;
    this.listeners.forEach(listener => listener.remove());
    if (this.marker && !this.loader.error()) this.marker.map = null;
    if (this.map) this.sdk?.event.clearInstanceListeners(this.map);
  }
  retry() {
    if (this.map) window.location.reload();
    else void this.initialize();
  }
}
