import { Injectable, signal } from '@angular/core';

export interface MapPosition { lat: number; lng: number; }
export interface MapsListener { remove(): void; }
interface MapEvent { latLng?: { lat(): number; lng(): number }; }
export interface PickerMap {
  panTo(position: MapPosition): void;
  setZoom(zoom: number): void;
  addListener(event: string, handler: (event: MapEvent) => void): MapsListener;
}
export interface PickerMarker {
  position: MapPosition;
  map: PickerMap | null;
  addListener(event: string, handler: (event: MapEvent) => void): MapsListener;
}
export interface GeocodeResult {
  formatted_address: string;
  geometry: { location: { lat(): number; lng(): number } };
}
export interface MapsSdk {
  Map: new (element: HTMLElement, options: object) => PickerMap;
  marker: { AdvancedMarkerElement: new (options: object) => PickerMarker };
  Geocoder: new () => { geocode(request: object): Promise<{ results: GeocodeResult[] }> };
  event: { clearInstanceListeners(instance: object): void };
}
type MapsWindow = Window & {
  google?: { maps: MapsSdk };
  __cmsMapsReady?: () => void;
  gm_authFailure?: () => void;
};
@Injectable({ providedIn: 'root' })
export class GoogleMapsService {
  readonly error = signal('');
  private pending?: Promise<{ sdk: MapsSdk; mapId: string }>;
  load() {
    return this.pending ??= this.initialize().catch(error => {
      this.pending = undefined;
      this.error.set(error instanceof Error ? error.message : 'Google Maps 載入失敗');
      throw error;
    });
  }
  private async initialize() {
    this.error.set('');
    let config: { apiKey?: string; mapId?: string };
    try {
      const response = await fetch(new URL('maps-config.json', document.baseURI), {cache: 'no-store'});
      if (!response.ok) throw new Error();
      config = await response.json();
      if (!config.apiKey || config.apiKey.startsWith('YOUR_')) throw new Error();
    } catch {
      throw new Error('尚未設定 Google Maps，仍可手動輸入經緯度。');
    }
    const target = window as MapsWindow;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = window.setTimeout(() => fail('Google Maps 載入逾時，請檢查網路後重試。'), 20000);
      const fail = (message: string) => {
        clearTimeout(timeout);
        script.remove();
        delete target.__cmsMapsReady;
        this.error.set(message);
        reject(new Error(message));
      };
      target.gm_authFailure = () => fail('Google Maps 授權失敗，請確認金鑰、網站限制及 Maps API 設定。');
      target.__cmsMapsReady = () => {
        clearTimeout(timeout);
        delete target.__cmsMapsReady;
        resolve();
      };
      const params = new URLSearchParams({key: config.apiKey!, v: 'weekly', loading: 'async',
        libraries: 'marker,geocoding', language: 'zh-TW', region: 'TW', callback: '__cmsMapsReady'});
      script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
      script.async = true;
      script.onerror = () => fail('無法連線 Google Maps，仍可手動輸入經緯度。');
      document.head.append(script);
    });
    if (!target.google?.maps?.marker) throw new Error('Google Maps 尚未完成初始化。');
    return {sdk: target.google.maps, mapId: config.mapId || 'DEMO_MAP_ID'};
  }
}
