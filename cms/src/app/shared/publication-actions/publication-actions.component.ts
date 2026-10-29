import { Component, inject } from "@angular/core";
import { CmsWorkspaceService } from "../../cms-workspace.service";
import { CubCardModule } from "cub-lib-view-rootng/component/card";
import { CubButtonModule } from "cub-lib-view-rootng/component/button";
@Component({
  selector: "cms-publication-actions",
  standalone: true,
  templateUrl: "./publication-actions.component.html",
  imports: [CubCardModule, CubButtonModule],
})
export class PublicationActionsComponent {
  readonly vm = inject(CmsWorkspaceService);
}
