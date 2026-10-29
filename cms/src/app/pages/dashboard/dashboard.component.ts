import { Component, inject } from "@angular/core";
import { CmsWorkspaceService } from "../../cms-workspace.service";
import { CommonModule } from "@angular/common";
import { CubCardModule } from "cub-lib-view-rootng/component/card";
import { CubButtonModule } from "cub-lib-view-rootng/component/button";
import { CubProgressBarModule } from "cub-lib-view-rootng/component/progress-bar";
@Component({
  selector: "cms-dashboard-page",
  standalone: true,
  templateUrl: "./dashboard.component.html",
  imports: [CommonModule, CubCardModule, CubButtonModule, CubProgressBarModule],
})
export class DashboardPageComponent {
  readonly vm = inject(CmsWorkspaceService);
}
