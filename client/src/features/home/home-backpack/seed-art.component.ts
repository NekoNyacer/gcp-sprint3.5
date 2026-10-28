import { Component, input } from '@angular/core';
import type { BackpackSeed } from '../../../shared/models/backpack-seed';

@Component({
  selector: 'app-seed-art',
  template: `
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <ellipse cx="60" cy="101" rx="25" ry="4" fill="#344b3412" />
      <ellipse cx="60" cy="101" rx="16" ry="2" fill="#344b3412" />
      <g
        [attr.transform]="'translate(60 57) scale(' + seed().size + ') rotate(' + seed().seam + ')'"
      >
        <path d="M0-32 C-10-28-29-10-29 10 C-29 43 28 43 29 10 C30-8 12-25 0-32Z" fill="#80563b" />
        <path
          d="M0-32 C-10-28-29-10-29 10 C-29 43 28 43 29 10 C30-8 12-25 0-32Z"
          [attr.fill]="seed().tint"
          opacity=".42"
        />
        <path
          d="M-2-27 C-19-15-26 2-22 15 C-20 24-12 28-7 27 C-16 15-17-5-2-27"
          fill="#edd6aa"
          opacity=".55"
        />
        <path
          d="M6-25 C23-7 26 8 19 22 C15 30 6 32-3 31 C20 30 33 8 6-25Z"
          fill="#583923"
          opacity=".4"
        />
        <path
          d="M0-29 C7-11-6 5 0 29"
          fill="none"
          stroke="#5f4533"
          stroke-width="1.5"
          opacity=".45"
        />
        <path
          d="M3-26 C9-10-3 6 3 25"
          fill="none"
          stroke="#e8d5ae"
          stroke-width="1.2"
          opacity=".5"
        />
        <path d="M-3-30 Q-2-36 2-35 L5-31" fill="#7b6948" />
        <path
          d="M-12-8 L-15-2 M12 9 L14 14 M-12 17 L-9 21"
          stroke="#e4c59a"
          stroke-width="1.4"
          stroke-linecap="round"
          opacity=".45"
        />
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: 132px;
      margin-inline: auto;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
    }
  `,
})
export class SeedArtComponent {
  readonly seed = input.required<BackpackSeed>();
}
