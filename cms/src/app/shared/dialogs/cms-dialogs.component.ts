import { REWARD_ICONS, REWARD_BACKGROUNDS } from "../../../../../functions/src/reward-avatar";
import {
  Component,
  inject,
  ViewChild,
  TemplateRef,
  AfterViewInit,
} from "@angular/core";
import { CmsWorkspaceService } from "../../cms-workspace.service";
import { FormsModule } from "@angular/forms";
import { CubButtonModule } from "cub-lib-view-rootng/component/button";
import { CubInputModule } from "cub-lib-view-rootng/component/input";
import { CubSelectModule } from "cub-lib-view-rootng/component/select";
import { CubCheckboxModule } from "cub-lib-view-rootng/component/checkbox";
import { CubFormFieldModule } from "cub-lib-view-rootng/component/form-field";
import { CubDialogModule } from "cub-lib-view-rootng/component/dialog";
import { CubDrawerModule } from "cub-lib-view-rootng/component/drawer";
import { LocationPickerComponent } from "../location-picker/location-picker.component";
@Component({
  selector: "cms-dialogs",
  standalone: true,
  templateUrl: "./cms-dialogs.component.html",
  imports: [
    FormsModule,
    CubButtonModule,
    CubInputModule,
    CubSelectModule,
    CubCheckboxModule,
    CubFormFieldModule,
    CubDialogModule,
    CubDrawerModule,
    LocationPickerComponent,
  ],
})
export class CmsDialogsComponent implements AfterViewInit {
  readonly vm = inject(CmsWorkspaceService);
  readonly rewardIcons = REWARD_ICONS;
  readonly rewardBackgrounds = REWARD_BACKGROUNDS;

  @ViewChild("editorDrawer", { static: true })
  editorDrawer!: TemplateRef<unknown>;
  @ViewChild("releaseDialog", { static: true })
  releaseDialog!: TemplateRef<unknown>;
  ngAfterViewInit() {
    this.vm.editorDrawer = this.editorDrawer;
    this.vm.releaseDialog = this.releaseDialog;
  }
}
