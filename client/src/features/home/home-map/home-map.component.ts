import { Component } from '@angular/core';
import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps';

@Component({
  selector: 'app-home-map',
  templateUrl: './home-map.component.html',
  styleUrls: ['./home-map.component.scss'],
  imports: [GoogleMap, MapAdvancedMarker],
})
export class HomeMapComponent {
  readonly center: google.maps.LatLngLiteral = {
    lat: 25.082,
    lng: 121.567,
  };

  readonly zoom = 15;

  readonly locations = [
    {
      id: 'tree-1',
      name: '我的樹',
      position: { lat: 25.082, lng: 121.567 },
    },
  ];

  readonly mapOptions: google.maps.MapOptions = {
    mapId: 'DEMO_MAP_ID',
    disableDefaultUI: true,
    clickableIcons: false,
    gestureHandling: 'cooperative',
  };
}
