import { Component, inject } from '@angular/core';
import { CmsWorkspaceService } from '../../cms-workspace.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CubCardModule } from 'cub-lib-view-rootng/component/card';
import { CubButtonModule } from 'cub-lib-view-rootng/component/button';
import { CubInputModule } from 'cub-lib-view-rootng/component/input';
import { CubTableModule } from 'cub-lib-view-rootng/component/table';
import { CubCommonModule } from 'cub-lib-view-rootng/component/common';
@Component({
  selector: 'cms-merchants-page',
  standalone: true,
  templateUrl: './merchants.component.html',
  imports: [CommonModule, FormsModule, CubCardModule, CubButtonModule, CubInputModule, CubTableModule, CubCommonModule],
})
export class MerchantsPageComponent {
  readonly vm = inject(CmsWorkspaceService);
}
