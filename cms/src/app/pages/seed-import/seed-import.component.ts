import { Component } from '@angular/core';
import { SeedImportComponent } from '../../shared/seed-import/seed-import.component';

@Component({
  selector: 'cms-seed-import-page',
  standalone: true,
  imports: [SeedImportComponent],
  template: '<cms-seed-import></cms-seed-import>',
})
export class SeedImportPageComponent {}
