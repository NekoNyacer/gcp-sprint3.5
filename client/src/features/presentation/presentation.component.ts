import { Component } from '@angular/core';

@Component({
  selector: 'app-presentation',
  template: `
    <iframe
      title="CAT WALK 互動式 App 簡報"
      src="/interactive-app-presentation.html?variant=b"
      allow="geolocation; camera; fullscreen"
    ></iframe>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
    }
  `,
})
export class PresentationComponent {}
