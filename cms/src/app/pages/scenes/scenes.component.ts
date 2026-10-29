import { Component, inject } from '@angular/core';
import { CmsWorkspaceService } from '../../cms-workspace.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CubTableModule } from 'cub-lib-view-rootng/component/table';
import { CubInputModule } from 'cub-lib-view-rootng/component/input';
import { CubCommonModule } from 'cub-lib-view-rootng/component/common';
import { CubCardModule } from 'cub-lib-view-rootng/component/card';
import { CubButtonModule } from 'cub-lib-view-rootng/component/button';
@Component({
  selector: 'cms-scenes-page',
  standalone: true,
  templateUrl: './scenes.component.html',
  imports: [CommonModule, FormsModule, CubTableModule, CubInputModule, CubCommonModule, CubCardModule, CubButtonModule],
})
export class ScenesPageComponent {
  readonly vm = inject(CmsWorkspaceService);
}

