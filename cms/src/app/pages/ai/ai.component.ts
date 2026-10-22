import { Component, inject } from '@angular/core';
import { CmsWorkspaceService } from '../../cms-workspace.service';
import { FormsModule } from '@angular/forms';
import { CubCardModule } from 'cub-lib-view-rootng/component/card';
import { CubButtonModule } from 'cub-lib-view-rootng/component/button';
import { CubInputModule } from 'cub-lib-view-rootng/component/input';
import { CubFormFieldModule, CubHint } from 'cub-lib-view-rootng/component/form-field';
import { CubChipModule } from 'cub-lib-view-rootng/component/chip';
@Component({
  selector: 'cms-ai-page',
  standalone: true,
  templateUrl: './ai.component.html',
  imports: [
    FormsModule,
    CubCardModule,
    CubButtonModule,
    CubInputModule,
    CubFormFieldModule,
    CubHint,
    CubChipModule,
  ],
})
export class AiPageComponent {
  readonly vm = inject(CmsWorkspaceService);
}
