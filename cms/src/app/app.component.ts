import {
  Component,
  inject,
  signal,
  HostListener,
  effect,
  afterRenderEffect,
  untracked,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CubLayoutModule } from 'cub-lib-view-rootng/component/layout';
import {
  CubCommonModule,
  DEVICE_BREAKPOINT,
  setViewHeight,
} from 'cub-lib-view-rootng/component/common';
import { CubButtonModule } from 'cub-lib-view-rootng/component/button';
import { CubCardModule } from 'cub-lib-view-rootng/component/card';
import { CubSelectModule } from 'cub-lib-view-rootng/component/select';
import { CubFormFieldModule } from 'cub-lib-view-rootng/component/form-field';
import { CubToastModule, CubToastService } from 'cub-lib-view-rootng/component/toast';
import { CubConfirmDialog, CubDialog } from 'cub-lib-view-rootng/component/dialog';
import {
  CubCollapsibleMenuModule,
  CubCollapsibleMenuService,
  CubCollapsibleMenuItem,
} from 'cub-lib-view-rootng/component/collapsible-menu';
import {
  CubBreadcrumbModule,
  CubBreadcrumbService,
} from 'cub-lib-view-rootng/component/breadcrumb';
import { CmsWorkspaceService } from './cms-workspace.service';
import { CmsDialogsComponent } from './shared/dialogs/cms-dialogs.component';
import { LoginComponent } from './shared/login/login.component';
import { PublicationActionsComponent } from './shared/publication-actions/publication-actions.component';
@Component({
  selector: 'app-cms',
  styles: ['h1 { margin: 0 0 10px;}'],
  standalone: true,
  templateUrl: './app.component.html',
  providers: [CubBreadcrumbService, CubToastService],
  imports: [
    RouterOutlet,
    FormsModule,
    CubLayoutModule,
    CubCommonModule,
    CubButtonModule,
    CubCardModule,
    CubSelectModule,
    CubFormFieldModule,
    CubToastModule,
    CubCollapsibleMenuModule,
    CubBreadcrumbModule,
    CmsDialogsComponent,
    LoginComponent,
    PublicationActionsComponent,
  ],
})
export class AppComponent {
  private readonly toasts = inject(CubToastService);
  private readonly dialogs = inject(CubDialog);
  private readonly menuService = inject(CubCollapsibleMenuService);
  private readonly breadcrumbs = inject(CubBreadcrumbService);
  private readonly router = inject(Router);
  readonly vm = inject(CmsWorkspaceService);
  readonly sidebarMode = signal<'side' | 'over'>('side');
  readonly sidebarOpened = signal(true);
  readonly menuCollapsed = signal(true);

  protected get isLoginRoute(): boolean {
    return this.router.url.split(/[?#]/)[0] === '/login';
  }

  @HostListener('window:resize')
  updateViewport() {
    setViewHeight();
    const desktop = window.innerWidth >= DEVICE_BREAKPOINT.TABLET_LANDSCAPE;
    const mode = desktop ? 'side' : 'over';
    if (this.sidebarMode() !== mode) {
      this.sidebarMode.set(mode);
      this.sidebarOpened.set(desktop);
      this.menuCollapsed.set(desktop);
    }
  }

  @HostListener('window:orientationchange')
  updateOrientation() {
    this.updateViewport();
  }

  toggleSidebar() {
    if (this.sidebarMode() === 'side') {
      this.menuCollapsed.update((value) => !value);
    } else {
      this.sidebarOpened.update((value) => !value);
    }
  }

  hideSidebar() {
    if (this.sidebarMode() === 'over') this.sidebarOpened.set(false);
  }

  readonly menuItems: CubCollapsibleMenuItem[] = this.vm.nav.map((item) => ({
    id: item.id,
    label: item.label,
    icon: {
      seedTypes: 'cub-icon-leaf',
      cubeChannels: 'cub-icon-credit-card',
      dashboard: 'cub-icon-chart-bar',
      merchants: 'cub-icon-map',
      tasks: 'cub-icon-map',
      trees: 'cub-icon-hand-seedling',
      rewards: 'cub-icon-wallet',
      scenes: 'cub-icon-image',
      budget: 'cub-icon-wallet',
      ai: 'cub-icon-wand-star',
      'seed-import': 'cub-icon-paperclip-vertical',
    }[item.id],
    routerLink: '/' + item.id,
    routerLinkActiveOptions: { exact: true },
  }));

  constructor() {
    this.updateViewport();
    afterRenderEffect(() => {
      if (!this.vm.api.authorized()) return;
      const error = this.vm.error();
      const apiError = this.vm.api.error();
      const message = this.vm.message();
      untracked(() => {
        for (const description of new Set([error, apiError].filter(Boolean))) {
          this.dialogs.open(CubConfirmDialog, {
            panelClass: ['cub-dialog-error', 'cub-dialog-small'],
            data: {
              title: '操作失敗',
              description,
              subButton: { hidden: true },
              mainButton: { label: '確認', appearance: 'filled-outline', color: 'neutral' },
            },
          });
        }
        if (error) this.vm.error.set('');
        if (apiError) this.vm.api.error.set('');
        if (message) {
          this.toasts.add({
            status: 'success',
            title: '操作成功',
            message,
            life: 5000,
            closable: true,
          });
          this.vm.message.set('');
        }
      });
    });
    effect(() => {
      if (this.vm.api.initializing()) return;
      const isLoginRoute = this.router.url.split(/[?#]/)[0] === '/login';
      if (!this.vm.api.authorized() && !isLoginRoute) {
        void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      } else if (this.vm.api.authorized() && isLoginRoute) {
        const returnUrl = this.router.parseUrl(this.router.url).queryParams['returnUrl'];
        void this.router.navigateByUrl(
          typeof returnUrl === 'string' && returnUrl.startsWith('/') && !returnUrl.startsWith('//')
            ? returnUrl
            : '/dashboard',
        );
      }
    });
    effect(() =>
      this.breadcrumbs.customBreadcrumb([{ label: '首頁' }, { label: this.vm.title() }]),
    );
    afterRenderEffect(() => {
      if (this.vm.api.authorized()) this.menuService.selectItem(this.vm.page());
    });
  }
}
