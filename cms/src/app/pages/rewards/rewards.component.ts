import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CubButtonModule } from 'cub-lib-view-rootng/component/button';
import { CubCardModule } from 'cub-lib-view-rootng/component/card';
import { CubCommonModule } from 'cub-lib-view-rootng/component/common';
import { CubInputModule } from 'cub-lib-view-rootng/component/input';
import { CubTableModule } from 'cub-lib-view-rootng/component/table';
import { CmsWorkspaceService } from '../../cms-workspace.service';

@Component({
  selector: 'cms-rewards-page',
  standalone: true,
  templateUrl: './rewards.component.html',
  imports: [CommonModule, FormsModule, CubButtonModule, CubCardModule, CubCommonModule, CubInputModule, CubTableModule],
})
export class RewardsPageComponent {
  readonly vm = inject(CmsWorkspaceService);
}
