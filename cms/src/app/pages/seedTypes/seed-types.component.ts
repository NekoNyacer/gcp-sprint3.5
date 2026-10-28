import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CubButtonModule } from "cub-lib-view-rootng/component/button";
import { CubCardModule } from "cub-lib-view-rootng/component/card";
import { CubChipModule } from "cub-lib-view-rootng/component/chip";
import { CubCommonModule } from "cub-lib-view-rootng/component/common";
import { CubInputModule } from "cub-lib-view-rootng/component/input";
import { CubTableModule } from "cub-lib-view-rootng/component/table";
import { CmsWorkspaceService } from "../../cms-workspace.service";
import { CubSelectModule } from "cub-lib-view-rootng/component/select";
import { CubCheckboxModule } from "cub-lib-view-rootng/component/checkbox";
import {
  DEFAULT_WALK_SEED_DROP,
  type WalkSeedDrop,
} from "../../../../../functions/src/planting-catalog";
import {
  TREE_APPEARANCES,
  treeAppearance,
} from "../../../../../functions/src/tree-species";

@Component({
  selector: "cms-seed-types-page",
  standalone: true,
  templateUrl: "./seed-types.component.html",
  styleUrl: "./seed-types.component.scss",
  imports: [
    CommonModule,
    FormsModule,
    CubSelectModule,
    CubCheckboxModule,
    CubButtonModule,
    CubCardModule,
    CubChipModule,
    CubCommonModule,
    CubInputModule,
    CubTableModule,
  ],
})
export class SeedTypesPageComponent {
  readonly vm = inject(CmsWorkspaceService);
  readonly selectedSpecies = signal("");
  readonly appearance = treeAppearance;
  readonly stages = [
    { id: "young", name: "小樹", ratio: "30%" },
    { id: "mature", name: "大樹", ratio: "60%" },
    { id: "flowering", name: "開花", ratio: "85%" },
    { id: "large", name: "結果", ratio: "100%" },
  ];
  readonly rule = computed(
    () =>
      this.vm.config().walkSeedDrop ?? {
        ...DEFAULT_WALK_SEED_DROP,
        seedTypeId:
          this.vm.config().seedTypes?.find((p) => p.enabled)?.id ?? "",
        enabled: !!this.vm.config().seedTypes?.some((p) => p.enabled),
      },
  );
  readonly pool = computed(() =>
    this.vm.config().seedTypes?.find((p) => p.id === this.rule().seedTypeId),
  );
  readonly species = computed(() =>
    this.vm
      .config()
      .species.filter((s) => !this.vm.search() || s.includes(this.vm.search())),
  );
  readonly selected = computed(() =>
    this.species().includes(this.selectedSpecies())
      ? this.selectedSpecies()
      : (this.species()[0] ?? ""),
  );
  readonly knownModel = computed(() =>
    TREE_APPEARANCES.some((p) => p.name === this.selected()),
  );
  readonly totalWeight = computed(
    () => this.pool()?.outcomes.reduce((sum, o) => sum + o.weight, 0) ?? 0,
  );
  setRule(change: Partial<WalkSeedDrop>): void {
    const rule = { ...this.rule(), ...change };
    this.vm.config.update((c) => ({ ...c, walkSeedDrop: rule }));
    this.vm.dirty.set(true);
  }
  chance(species: string): number {
    const weight =
      this.pool()?.outcomes.find((o) => o.species === species)?.weight ?? 0;
    return this.totalWeight() > 0 ? (weight / this.totalWeight()) * 100 : 0;
  }
  effectiveChance(species: string): number {
    return this.rule().enabled && this.pool()?.enabled
      ? (this.chance(species) * this.rule().chancePercent) / 100
      : 0;
  }
}
