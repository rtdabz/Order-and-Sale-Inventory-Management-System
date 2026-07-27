/**
 * Route_Registry — the single source of navigation truth for the app shell.
 *
 * Plain data plus pure functions: no React import, no JSX. Icons are stored as
 * component references so each consumer decides its own size and colour rule.
 */

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ScanBarcode,
  ReceiptText,
  Package,
  Tags,
  TrendingUp,
  Boxes,
  TriangleAlert,
  UserRound,
} from 'lucide-react';

export type NavGroupId = 'menu' | 'catalog' | 'reports' | 'account';

export type RouteEntry = {
  path: string;
  label: string;
  group: NavGroupId;
  icon: LucideIcon;
  /** Account routes are reachable from the user menu, not the rail. */
  showInSidebar: boolean;
};

export const NAV_GROUPS: ReadonlyArray<{ id: NavGroupId; label: string }> = [
  { id: 'menu', label: 'Menu' },
  { id: 'catalog', label: 'Product Catalog' },
  { id: 'reports', label: 'Reports' },
  { id: 'account', label: 'Account' },
];

export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  { path: '/dashboard', label: 'Dashboard', group: 'menu', icon: LayoutDashboard, showInSidebar: true },
  { path: '/orderpage', label: 'POS Terminal', group: 'menu', icon: ScanBarcode, showInSidebar: true },
  { path: '/transactions', label: 'Transactions', group: 'menu', icon: ReceiptText, showInSidebar: true },
  { path: '/products', label: 'Stock management', group: 'catalog', icon: Package, showInSidebar: true },
  { path: '/category', label: 'Categories', group: 'catalog', icon: Tags, showInSidebar: true },
  { path: '/reports/sales', label: 'Sales Report', group: 'reports', icon: TrendingUp, showInSidebar: true },
  { path: '/inventory', label: 'Inventory Report', group: 'reports', icon: Boxes, showInSidebar: true },
  { path: '/reports/damage', label: 'Damage Report', group: 'reports', icon: TriangleAlert, showInSidebar: true },
  { path: '/profile', label: 'Profile', group: 'account', icon: UserRound, showInSidebar: false },
];

export const DASHBOARD_PATH = '/dashboard';

/** Fallback crumb label for any path absent from the registry. */
export const UNKNOWN_ROUTE_LABEL = 'Page';

export type Crumb = { label: string; to?: string };

/** Exact-match lookup. Returns `undefined` for any unregistered path. */
export function findRoute(pathname: string): RouteEntry | undefined {
  return ROUTE_REGISTRY.find((entry) => entry.path === pathname);
}

export type SidebarGroup = {
  id: NavGroupId;
  label: string;
  items: readonly RouteEntry[];
};

/** NAV_GROUPS order, filtered to `showInSidebar`, empty groups dropped. */
export function sidebarGroups(): readonly SidebarGroup[] {
  return NAV_GROUPS.map(({ id, label }) => ({
    id,
    label,
    items: ROUTE_REGISTRY.filter((entry) => entry.group === id && entry.showInSidebar),
  })).filter((group) => group.items.length > 0);
}

function groupLabel(id: NavGroupId): string {
  return NAV_GROUPS.find((group) => group.id === id)?.label ?? '';
}

function dashboardLabel(): string {
  return findRoute(DASHBOARD_PATH)?.label ?? 'Dashboard';
}

/**
 * Total function: every input returns a non-empty array and nothing throws.
 *
 * - The first crumb is always `Dashboard`, linked unless it is also the last.
 * - A group crumb is emitted only when the group is not `menu` and its label
 *   differs from the page label. It carries no `to` — a group is not a route.
 * - The final crumb never carries `to`.
 * - Unregistered paths fall back to `Dashboard` + `UNKNOWN_ROUTE_LABEL`.
 */
export function resolveBreadcrumbs(pathname: string): Crumb[] {
  const entry = findRoute(pathname);

  if (!entry) {
    return [{ label: dashboardLabel(), to: DASHBOARD_PATH }, { label: UNKNOWN_ROUTE_LABEL }];
  }

  if (entry.path === DASHBOARD_PATH) {
    return [{ label: entry.label }];
  }

  const crumbs: Crumb[] = [{ label: dashboardLabel(), to: DASHBOARD_PATH }];

  const group = groupLabel(entry.group);
  if (entry.group !== 'menu' && group !== '' && group !== entry.label) {
    crumbs.push({ label: group });
  }

  crumbs.push({ label: entry.label });
  return crumbs;
}
