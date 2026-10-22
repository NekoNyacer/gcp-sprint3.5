import { InjectionToken, signal } from '@angular/core';
import type { CmsClientService } from '../services/cms-client.service';
import type { CmsConfig, Selection } from '../../../../functions/src/cms-domain';
import type { HomeTree } from '../../features/home/home-tree-recommendations';
/** Reactive configuration seam. Default null preserves offline fixture behavior. */
export const cmsPublication = signal<{
  config: CmsConfig | null;
  version: number;
  managed: boolean;
}>({ config: null, version: 0, managed: false });
export const cmsRouteRoles = signal<readonly Selection[] | null>(null);
export const cmsRetainedTrees = signal<readonly HomeTree[]>([]);
export const CMS_CONNECTION = new InjectionToken<CmsClientService>('CMS_CONNECTION');
