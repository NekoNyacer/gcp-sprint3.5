import { Component, inject } from "@angular/core";
import { CmsWorkspaceService } from "../../cms-workspace.service";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { CubCardModule } from "cub-lib-view-rootng/component/card";
import { CubButtonModule } from "cub-lib-view-rootng/component/button";
import { CubInputModule } from "cub-lib-view-rootng/component/input";
import { CubFormFieldModule } from "cub-lib-view-rootng/component/form-field";
@Component({
  selector: "cms-budget-page",
  standalone: true,
  templateUrl: "./budget.component.html",
  imports: [
    CommonModule,
    FormsModule,
    CubCardModule,
    CubButtonModule,
    CubInputModule,
    CubFormFieldModule,
  ],
})
export class BudgetPageComponent {
  readonly vm = inject(CmsWorkspaceService);
}
