import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CubButtonModule } from 'cub-lib-view-rootng/component/button';
import { CubCardModule } from 'cub-lib-view-rootng/component/card';
import { CubChipModule } from 'cub-lib-view-rootng/component/chip';
import { CubCommonModule } from 'cub-lib-view-rootng/component/common';
import { CubInputModule } from 'cub-lib-view-rootng/component/input';
import { CubTableModule } from 'cub-lib-view-rootng/component/table';
import { CmsWorkspaceService } from '../../cms-workspace.service';

@Component({
  selector: 'cms-trees-page',
  standalone: true,
  templateUrl: './trees.component.html',
  imports: [CommonModule, FormsModule, CubButtonModule, CubCardModule, CubChipModule, CubCommonModule, CubInputModule, CubTableModule],
})
export class TreesPageComponent {
  readonly vm = inject(CmsWorkspaceService);
}
