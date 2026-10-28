import { Component, inject } from '@angular/core';
import { CmsWorkspaceService } from '../../cms-workspace.service';
import { CubButtonModule } from 'cub-lib-view-rootng/component/button';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CubTableModule } from 'cub-lib-view-rootng/component/table';
import { CubInputModule } from 'cub-lib-view-rootng/component/input';
import { CubCommonModule } from 'cub-lib-view-rootng/component/common';
import { CubCardModule } from 'cub-lib-view-rootng/component/card';
@Component({
  selector: 'cms-tasks-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CubTableModule,
    CubInputModule,
    CubCommonModule,
    CubCardModule,
    CubButtonModule,
  ],
  templateUrl: './tasks.component.html',
})
export class TasksPageComponent {
  readonly vm = inject(CmsWorkspaceService);
}
