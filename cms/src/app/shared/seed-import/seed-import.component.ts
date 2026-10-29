import { Component, inject } from "@angular/core";
import { CmsWorkspaceService } from "../../cms-workspace.service";
import { CubCardModule } from "cub-lib-view-rootng/component/card";
import { CubButtonModule } from "cub-lib-view-rootng/component/button";
import { CubUploadModule } from "cub-lib-view-rootng/component/upload";
@Component({
  selector: "cms-seed-import",
  standalone: true,
  templateUrl: "./seed-import.component.html",
  imports: [CubCardModule, CubButtonModule, CubUploadModule],
})
export class SeedImportComponent {
  readonly vm = inject(CmsWorkspaceService);
}
