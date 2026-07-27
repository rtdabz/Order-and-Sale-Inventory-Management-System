# Design: POS shell redesign

## Overview

The authenticated shell becomes: one **Route_Registry** module that is the single source of navigation truth, a **Sidebar** and **Header** that are thin compositions over small typed components, and a **Sidebar_Context** that holds exactly one piece of persisted state plus a derived viewport mode. `AppSidebar.tsx` (137 lines, no dark mode, two collapse mechanisms) and `AppHeader.tsx` (117 lines, two inline SVG blobs) stop being the places where shell behaviour lives; they become layout files that arrange named parts.

Implementation language is **TypeScript + React 18** with Tailwind CSS 3.4, matching the rest of `FE/src`. No new runtime dependency is introduced — `lucide-react@0.552` is already installed and already used by every page.

### Verified starting facts

Read before designing, and worth recording because two of them contradict assumptions in the requirements introduction:

- **The `breadcrumbs` prop is passed by seven pages, not eight.** `Category.tsx`, `orderpage.tsx`, `products.tsx`, `DamageReport.tsx`, `InventoryReport.tsx`, `SalesReport.tsx` and `TransactionHistory.tsx` each pass `[{ label: 'Home', to: '/dashboard' }, { label: '<page>' }]`. `Home.tsx` renders `PageHeader` without `breadcrumbs`. So the prop removal touches seven call sites; the eighth call site (`Home.tsx`) is touched only for the `New sale` removal in D3.
- **The nav icon assets cannot share one `currentColor` rule.** Measured per file in `FE/src/icons/`: `grid.svg` uses `fill="currentColor"`; `shopping-basket.svg` is a Lucide export using `stroke="currentColor"`; `order.svg` has `fill="#000000"` on the root and four empty `fill=""` attributes; `history.svg` hardcodes `#1C274C` on both `fill` and `stroke`; `category.svg` hardcodes `#010101` across fourteen paths plus one `#040305`; `report.svg`, `inventory.svg` and `damage.svg` hardcode `#000000`. Six of eight are immune to any `currentColor` rule — that is the actual reason the Damage Report item needs its `[&_svg]:fill-black` override, and the reason a size-only token would not fix Requirement 4.
- **Breakpoints currently disagree three ways.** `SidebarContext` uses `768`, `AppHeader.handleToggle` uses `991`, and the width/margin classes use Tailwind `lg` (`1024`). The requirements define Mobile_Breakpoint `<768` and Desktop_Breakpoint `>=1024`, leaving a 768–1023 band that today is governed by whichever of the three numbers happens to apply.
- **Lint baseline: 80 errors, 27 warnings** from `npx eslint .` in `FE/`. Dominated by `@typescript-eslint/no-explicit-any` in pages, contexts and `svg.d.ts` — files this spec does not touch. See [Lint baseline](#lint-baseline).
- **No test runner exists.** `FE/package.json` has `dev`, `build`, `lint`, `preview` and no vitest/jest/testing-library/fast-check. This shapes the [Correctness properties](#correctness-properties) section.

---

## Resolved decisions

### D1 — Header owns the Breadcrumb_Trail; `PageHeader` keeps the `h1`

**Resolution: Option C, with the H1 question resolved in favour of `PageHeader`.**

The Header renders a Breadcrumb_Trail derived from Route_Registry whose **final crumb is the current-page label**. No separate "page label" element is added — the last crumb *is* the page label, which is what Requirement 7 criterion 4 means when it says the page context truncates "to the current-page label alone": the trail drops its intermediate crumbs and what remains is the label.

`PageHeader` keeps `eyebrow`, `title`, `description` and `actions`. `title` remains the page's single `h1`. `PageHeader` **loses its `breadcrumbs` prop**, and the seven pages that pass one drop the array.

Rationale, stated plainly:

- It deletes seven duplicated arrays that all restate the same `Home → <page>` shape, and moves label ownership to the registry so a rename lands in the menu and the trail at once (Requirement 8 criteria 2–4).
- It keeps exactly one `h1` per page. Moving the title into the Header would either give every page an `h1` inside `banner` (wrong landmark for page content) or leave pages with no `h1` at all.
- It preserves the visual weight pages currently have. `PageHeader`'s `text-2xl lg:text-3xl font-bold` title is the anchor of every screen; replacing it with a small header label would flatten all eight pages.
- A small trail in the header above a large title in the page is a conventional pattern, not redundancy — the trail answers "where am I in the structure", the title answers "what is this screen". They differ in size, weight and colour, so they do not read as a duplicate.
- It avoids inventing a portal or context channel to lift per-page `actions` into the Header, which Option A would have required for eleven files.

The word "Home" disappears from breadcrumbs; the first crumb becomes `Dashboard`, matching the nav label for `/dashboard` (Requirement 8 criterion 5).

### D2 — Search_Trigger now, Command_Palette deferred

**Resolution: Option B, deferred. Build the Search_Trigger only.**

In scope: a Header control that satisfies Requirement 9 criteria 1–7 and 12 — reachable by `Tab`, accessible name naming the search action, visible `Ctrl K` hint at or above Desktop_Breakpoint, `Cmd`/`Ctrl`+`K` opens a surface anywhere outside a text input, focus moves into the surface's input, `Escape` closes and returns focus to the trigger, no focus trap (Tab out closes rather than swallowing the keypress), and no binding on `/` so `orderpage.tsx` remains the sole handler of its own product-filter hotkey.

The surface it opens is a **minimal placeholder** stating that search is not yet available, containing a focusable `SearchInput` so criterion 4 holds.

**Out of scope, explicitly:** Requirement 9 criteria 8–11 — the Command_Palette over nav destinations, products by name and transactions by number, with `ProductNotificationContext` highlight-then-scroll on product results. That is a follow-up spec.

The placeholder is built so the palette can replace its **body** without changing the trigger contract: `SearchTrigger` owns nothing but "I am a button that requests the surface"; open/close state, the `Cmd+K` binding, focus movement and focus restoration live in `useSearchSurface`, and the surface component receives `open` and `onClose` only. Swapping `SearchPlaceholderPanel` for a `CommandPalette` inside `SearchOverlay` is then a one-line change with no edit to `SearchTrigger`, `AppHeader` or the hook.

### D3 — One `New sale` quick action, removed from `Home.tsx`

**Resolution: a single `New sale` primary action in the Header.** Hidden on `/orderpage`, where "start a new sale" is what the page already is. **Removed from `Home.tsx`'s `PageHeader` actions**, so it never appears twice on one screen. `Home.tsx` keeps its `Refresh` button and its date/time block, and keeps the `Open POS terminal` tile in its quick-actions grid — that tile is a different affordance (a labelled card in the page body, not a chrome button) and is not a duplicate of a header control.

Hidden entirely below Mobile_Breakpoint, because Requirement 10 criterion 1 enumerates the mobile header row and quick actions are not in it.

### D4 — Hover-to-expand dropped

**Resolution: drop it.** `isHovered` and `setIsHovered` are removed from `SidebarContext`, and `AppLayout` computes the content offset from the persisted expanded/collapsed state alone. Collapsed items get tooltips (Requirement 4 criterion 6).

Rationale: today `AppLayout` keys `lg:ml-[290px] / lg:ml-[90px]` off `isExpanded || isHovered`, so **every pointer crossing of the rail reflows the entire page** — a 200px shift of the sale in progress. Removing `isHovered` from the context deletes that class of bug at the source rather than patching the margin expression, and satisfies Requirement 5 criteria 2 and 7: width changes only on toggle, on state restore, or on a breakpoint change.

---

## Architecture

```
AppLayout                        AppDataProvider → SidebarProvider → LayoutContent
 ├─ AppSidebar                   <aside>: BrandLockup + <nav> of NavGroup[] of NavItem[]
 ├─ Backdrop                     drawer scrim, mobile only
 └─ content region               offset computed from one value
     ├─ AppHeader                <header>: IconButton toggle · BrandLockup (mobile)
     │                           · BreadcrumbTrail · SearchTrigger
     │                           · HeaderQuickActions · NotificationDropdown · UserDropdown
     └─ PageArea                 AppBootstrapSkeleton until bootstrapped, then <Outlet/>

lib/navigation.ts   ← Route_Registry, consumed by AppSidebar and BreadcrumbTrail
lib/shellTokens.ts  ← Icon_Size_Token, rail widths, transition duration
```

Both bars read shell state from `useSidebar()`. Nothing else in the app reads it.

### Shared modules

#### `FE/src/lib/navigation.ts` — Route_Registry

One module, no React import, no JSX. Icons are stored as component references, not elements, so the registry stays a plain data module and each consumer decides the size.

```ts
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, ScanBarcode, ReceiptText, Package, Tags,
  TrendingUp, Boxes, TriangleAlert, UserRound,
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
  { id: 'menu',     label: 'Menu' },
  { id: 'catalog',  label: 'Product Catalog' },
  { id: 'reports',  label: 'Reports' },
  { id: 'account',  label: 'Account' },
];

export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  { path: '/dashboard',      label: 'Dashboard',        group: 'menu',    icon: LayoutDashboard, showInSidebar: true  },
  { path: '/orderpage',      label: 'POS Terminal',     group: 'menu',    icon: ScanBarcode,     showInSidebar: true  },
  { path: '/transactions',   label: 'Transactions',     group: 'menu',    icon: ReceiptText,     showInSidebar: true  },
  { path: '/products',       label: 'Stock management', group: 'catalog', icon: Package,         showInSidebar: true  },
  { path: '/category',       label: 'Categories',       group: 'catalog', icon: Tags,            showInSidebar: true  },
  { path: '/reports/sales',  label: 'Sales Report',     group: 'reports', icon: TrendingUp,      showInSidebar: true  },
  { path: '/inventory',      label: 'Inventory Report', group: 'reports', icon: Boxes,           showInSidebar: true  },
  { path: '/reports/damage', label: 'Damage Report',    group: 'reports', icon: TriangleAlert,   showInSidebar: true  },
  { path: '/profile',        label: 'Profile',          group: 'account', icon: UserRound,       showInSidebar: false },
];

export const DASHBOARD_PATH = '/dashboard';
export const UNKNOWN_ROUTE_LABEL = 'Page';

export type Crumb = { label: string; to?: string };

export function findRoute(pathname: string): RouteEntry | undefined { /* exact match */ }

export function sidebarGroups(): ReadonlyArray<{ id: NavGroupId; label: string; items: readonly RouteEntry[] }> {
  /* NAV_GROUPS order, filtered to showInSidebar, empty groups dropped */
}

export function resolveBreadcrumbs(pathname: string): Crumb[] { /* see below */ }
```

Nine destinations are covered, including `/profile` (Requirement 12 criterion 4 counts it among the nine reachable destinations; it reaches the shell through `UserDropdown`, so it is registered but excluded from the rail by `showInSidebar: false`, which also keeps the rail at the eight items Requirement 2 criterion 2 lists).

Sidebar labels come from this table, so `/products` reads `Stock management` in the rail and the trail alike, matching the existing page `h1` and `PageMeta` title.

`resolveBreadcrumbs` is a **total function** — every input returns a non-empty array and nothing throws (Requirement 8 criterion 7):

| Input | Output |
| --- | --- |
| `/dashboard` | `[{ label: 'Dashboard' }]` — single crumb, `aria-current` |
| `/products` | `[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Product Catalog' }, { label: 'Stock management' }]`… the group crumb carries no `to` (a group is not a route) and so renders as plain text, with only the final crumb carrying `aria-current="page"` |
| `/reports/damage` | `Dashboard` → `Reports` → `Damage Report` |
| `/profile` | `Dashboard` → `Account` → `Profile` |
| unregistered, e.g. `/nope` | `[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Page' }]` |

Rules: the first crumb is always `Dashboard`, linked unless it is also the last. The group crumb is emitted only when the group label differs from the page label and the group is not `menu` — `Menu` is a rail-organisation label, not a place, and `Dashboard → Menu → Transactions` reads worse than `Dashboard → Transactions`. Requirement 8 criterion 5 asks for the group crumb "where the group differs from the current page label", which this satisfies for the two groups where it adds information. The final crumb never carries `to`.

To keep Requirement 8 criterion 6 exact — "every preceding crumb as a link" — the group crumb is rendered as a **non-link, non-`aria-current` span**. It is a labelled separator, not a navigable ancestor. Recorded as a deliberate reading rather than an oversight.

#### `FE/src/lib/shellTokens.ts` — shared shell values

Declared once, referenced everywhere (Requirement 11 criterion 6). Class strings live in a `.ts` file inside Tailwind's content glob (`./src/**/*.{js,ts,jsx,tsx}`), so the JIT compiler sees them.

```ts
/** Icon_Size_Token — every Nav_Item icon and every header icon-button glyph. */
export const SHELL_ICON_CLASS = 'h-5 w-5 shrink-0';
export const SHELL_ICON_STROKE = 1.75;

export const RAIL_WIDTH_EXPANDED = 'w-[280px]';
export const RAIL_WIDTH_COLLAPSED = 'w-[80px]';
export const CONTENT_OFFSET_EXPANDED = 'ml-[280px]';
export const CONTENT_OFFSET_COLLAPSED = 'ml-[80px]';
export const CONTENT_OFFSET_NONE = 'ml-0';

/** Requirement 5 criterion 4: 300ms ceiling. */
export const SHELL_TRANSITION = 'transition-[margin,transform,opacity,background-color,border-color,color] duration-200 ease-out motion-reduce:transition-none';
export const SHELL_COLOR_TRANSITION = 'transition-colors duration-150 motion-reduce:transition-none';

export const SIDEBAR_STORAGE_KEY = 'pos.shell.sidebarExpanded';
```

`SHELL_TRANSITION` enumerates its properties rather than using `transition-all`, which is what makes Requirement 5 criterion 5 checkable: `width` is absent from the list, so a rail width change snaps rather than animating, and the visible motion is the `transform` on the drawer and the `margin` on the content region. `motion-reduce:transition-none` is the `prefers-reduced-motion` path (Requirement 5 criterion 6) and is baked into the token so no component can forget it.

### Sidebar_Context

`FE/src/context/SidebarContext.tsx`, rewritten. Removed: `activeItem`, `openSubmenu`, `setActiveItem`, `toggleSubmenu` (dead since the nav was flattened), `isHovered`, `setIsHovered` (D4). Requirement 13 criteria 2, 4 and 6.

```ts
export type ViewportMode = 'mobile' | 'tablet' | 'desktop';

export type SidebarState = {
  /** Persisted user preference. Meaningless at 'mobile'. */
  isExpanded: boolean;
  isDrawerOpen: boolean;
  viewport: ViewportMode;
  /** Derived: the one value the Sidebar and the content offset both read. */
  railState: 'expanded' | 'collapsed' | 'drawer';
  toggleSidebar: () => void;      // desktop/tablet: expand ⇄ collapse
  openDrawer: () => void;
  closeDrawer: () => void;
};
```

**One toggle, two meanings, resolved in the context, not the Header.** The Header calls `toggleSidebar()` when `viewport !== 'mobile'` and `openDrawer()`/`closeDrawer()` when it is mobile. The `991` magic number in `AppHeader.handleToggle` goes away; the only breakpoint numbers in the codebase become the two in the context's media queries, and they match the glossary (768 / 1024).

**`railState` is the single derived value** that the Sidebar width, the Backdrop and the content offset all read (Requirement 13 criterion 3). Because there is one source, the sidebar and the offset cannot disagree while a breakpoint is being crossed (Requirement 10 criterion 6) — there is no second value to fall out of sync with:

```
viewport === 'mobile'  → 'drawer'
otherwise              → isExpanded ? 'expanded' : 'collapsed'
```

**Persistence** (Requirement 1 criteria 3–5). One key: `pos.shell.sidebarExpanded`, holding `"true"` or `"false"`.

Read in a **lazy `useState` initialiser**, not in an effect:

```ts
const [isExpanded, setIsExpanded] = useState<boolean>(() => readPersistedExpanded());
const [viewport, setViewport] = useState<ViewportMode>(() => readViewport());
```

`SidebarProvider` sits above `LayoutContent`, which renders both bars and the `Outlet`, so this initialiser runs *before* the routed page's first render and inside the same commit. The browser therefore paints the restored width once, with no expanded-then-collapsed flash — which is what Requirement 1 criterion 4 asks for. An effect-based read would paint the default first and correct it on the next frame; that is the failure this avoids.

`readPersistedExpanded` handles absent and corrupt values (Requirement 1 criterion 5):

```ts
function readPersistedExpanded(): boolean {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return readViewport() === 'desktop';   // absent or garbage → width-appropriate default
  } catch {
    return true;                            // storage blocked (private mode, quota) → expanded
  }
}
```

Anything that is not exactly `"true"` or `"false"` — `null`, `"1"`, `"{}"`, a value left by another app — falls through to the default. `try/catch` covers `localStorage` access throwing, which it does when storage is disabled. Writes are wrapped in the same `try/catch` and fail silently: a shop terminal with storage blocked should still run, just without remembering the rail.

The absent-value default is `true` at desktop and `false` at tablet, which is how Requirement 1 criterion 5 and Requirement 10 criterion 2 are reconciled. Once a user has toggled, the persisted value wins in both bands — a deliberate reading of "by default" in 10.2 as "when there is no preference", because silently overriding an explicit toggle on window resize would be worse.

`viewport` is tracked with two `matchMedia` listeners (`(max-width: 767px)`, `(min-width: 1024px)`) rather than a `resize` handler, so the callback fires only on band changes instead of on every resize frame. Crossing out of `mobile` closes the drawer.

`useSidebar` keeps its throw (Requirement 13 criterion 5), message unchanged: `useSidebar must be used within a SidebarProvider`.

### Component breakdown

Every file below is its own module, under 150 lines, with an exported props type and no `any` (Requirement 11 criteria 1, 2, 5).

| File | Responsibility | Approx. lines |
| --- | --- | --- |
| `components/shell/BrandLockup.tsx` | Logo + `MKB` wordmark, `Link` to `/dashboard`. Props: `showWordmark: boolean`, `className?: string`. One component, used by the Sidebar in all three states and by the Header's mobile region (Requirement 6 criterion 4). | ~30 |
| `components/shell/IconButton.tsx` | The one icon-only control for the shell. Props: `label: string` (becomes `aria-label`), `onClick`, `children: ReactNode`, `aria-expanded?`, `aria-controls?`, `className?`. Renders a `button` with a fixed 40×40 hit area (`h-10 w-10`), rising to `h-11 w-11` at `lg`, so Requirement 10 criterion 7 holds below desktop by construction. | ~40 |
| `components/shell/NavItem.tsx` | One `NavLink`. Props: `entry: RouteEntry`, `showLabel: boolean`. Owns active styling, `aria-current`, the accent bar, the `aria-hidden` icon and the collapsed tooltip. | ~65 |
| `components/shell/NavGroup.tsx` | One labelled cluster. Props: `label: string`, `items: readonly RouteEntry[]`, `showLabels: boolean`. Renders the heading when labels are shown and a divider when they are not. | ~40 |
| `components/shell/BreadcrumbTrail.tsx` | `nav aria-label="Breadcrumb"` + `ol`, from `resolveBreadcrumbs(useLocation().pathname)`. No props. | ~55 |
| `components/shell/SearchTrigger.tsx` | The button. Props: `onOpen: () => void`, `triggerRef: RefObject<HTMLButtonElement>`. Renders the `Search` glyph, the `Search…` label and the `Ctrl K` hint, each at its own breakpoint. | ~45 |
| `components/shell/SearchOverlay.tsx` | The surface. Props: `open: boolean`, `onClose: () => void`. Scrim + centred panel; hosts the placeholder body. **This is the file the Command_Palette replaces.** | ~70 |
| `components/shell/HeaderQuickActions.tsx` | `New sale`. No props; reads `useLocation()` to hide itself on `/orderpage`. | ~35 |
| `hooks/useSearchSurface.ts` | `Cmd`/`Ctrl`+`K` binding, open/close state, focus restoration to the trigger. Returns `{ open, openSurface, closeSurface, triggerRef }`. | ~50 |
| `hooks/useDrawerA11y.ts` | Escape-to-close with focus return, background scroll lock, focus containment. Consumed by the drawer; reusable by any future shell overlay. | ~70 |
| `layout/AppSidebar.tsx` | Arranges `BrandLockup` + `NavGroup[]`; owns the `aside` shell and width classes. | ~70 |
| `layout/AppHeader.tsx` | Arranges the seven header regions in DOM order. | ~75 |
| `layout/AppLayout.tsx` | Providers, content offset, `PageArea`. | ~60 |
| `layout/Backdrop.tsx` | Extended, not replaced — see [Drawer_State](#drawer_state). | ~30 |

**Reuse, not replacement** (Requirement 11 criteria 3, 4): the `New sale` quick action renders the existing `components/ui/button/Button` wrapped in a `Link` (`Button` has no `href`, and `Home.tsx` already uses this `Link`-wrapping pattern). The search surface renders the existing `components/ui/input/SearchInput`, whose `hint` prop already supports the `Ctrl K` affordance and whose `autoFocus` prop delivers Requirement 9 criterion 4. `StatusPill` is used for any shell count badge — the notification count already comes from `NotificationDropdown`, which this spec does not modify.

`IconButton` is not a `Button` replacement and does not violate criterion 3: `Button` is a labelled action with padding-based sizing and no square hit-area guarantee, while the shell needs a fixed-square 40×40 icon control. `IconButton` is the "icon button" component criterion 1 explicitly asks for. It renders a `button` element with shared focus-ring and hover tokens; it defines no new visual language.

### Icons

**Finding: the existing SVG assets cannot all be driven by one `currentColor` rule.** Six of the eight nav icons hardcode a fill (`order.svg`, `history.svg`, `category.svg`, `report.svg`, `inventory.svg`, `damage.svg`), and the two that do respond to `currentColor` respond through *different* channels — `grid.svg` via `fill`, `shopping-basket.svg` via `stroke`. A single rule cannot colour a hardcoded `#010101` path at all, and a rule that sets `fill` on a stroke-based icon produces a filled blob. This is not a size problem, and no amount of token discipline fixes it.

**Remedy: replace all eight nav icons with `lucide-react` imports.** `lucide-react@0.552` is already a dependency and is already the icon set every page uses (`Home.tsx` alone imports seven). Lucide icons are uniformly 24×24, stroke-based, `stroke="currentColor"`, and accept `className` and `strokeWidth`. That gives one rendering treatment, so one rule colours every icon correctly in both themes (Requirement 4 criteria 2 and 4), and the `[&_svg]:fill-black [&_svg]:dark:fill-gray-900` override on Damage Report is deleted with nothing to replace it (criterion 3).

Mapping, stored in Route_Registry: `LayoutDashboard`, `ScanBarcode`, `ReceiptText`, `Package`, `Tags`, `TrendingUp`, `Boxes`, `TriangleAlert`, `UserRound`.

Sizing is `SHELL_ICON_CLASS` (`h-5 w-5 shrink-0`) with `strokeWidth={SHELL_ICON_STROKE}`, applied in `NavItem` — one call site, so criterion 1 holds structurally. The `.menu-item-icon-size svg { @apply size-6 !important }` rule in `index.css` is no longer referenced by the shell; it is left in place because `PageBreadCrumb` and other non-shell files may use the `menu-*` family, and deleting shared CSS is outside this spec's blast radius. The shell simply stops using `menu-item*` classes.

The eight now-unused `import { ReactComponent as … }` entries in `FE/src/icons/index.ts` are left alone: the barrel is shared, other files import from it, and pruning it risks breaking unrelated screens for no benefit to this spec.

Every nav and header glyph is `aria-hidden="true"`; the accessible name comes from the anchor text when expanded and from `aria-label` on the anchor when collapsed (Requirement 4 criterion 5, Requirement 12 criterion 5).

### Sidebar

```
<aside id="app-sidebar" aria-label="Main navigation"  (nav element carries the label — see below)
   fixed left-0 top-0 z-50 h-screen  flex flex-col
   border-r  bg-white dark:bg-gray-900  border-gray-200 dark:border-gray-800
   width: RAIL_WIDTH_EXPANDED | RAIL_WIDTH_COLLAPSED
   transform: drawer ? (open ? translate-x-0 : -translate-x-full) : translate-x-0
```

The `mt-16 lg:mt-0` hack goes: the rail is full-height in every state, and the Header sits inside the offset content region, so they no longer need to dodge each other. `onMouseEnter`/`onMouseLeave` are deleted (D4).

**Colours, both themes** (Requirement 6 criteria 1, 3, 5) — all from existing Tailwind tokens, no literal values anywhere in shell files:

| Surface | Light | Dark |
| --- | --- | --- |
| Rail background | `bg-white` | `dark:bg-gray-900` |
| Rail border | `border-gray-200` | `dark:border-gray-800` |
| Group heading | `text-gray-400` | `dark:text-gray-500` |
| Item label, idle | `text-gray-700` | `dark:text-gray-300` |
| Item label, hover | `hover:text-gray-900 hover:bg-gray-100` | `dark:hover:text-white dark:hover:bg-white/[0.06]` |
| Item, active | `bg-brand-50 text-brand-700` | `dark:bg-brand-500/10 dark:text-brand-300` |
| Accent bar, active | `bg-brand-500` | `dark:bg-brand-400` |
| Icon, idle | `text-gray-500` | `dark:text-gray-400` |
| Icon, active | `text-brand-600` | `dark:text-brand-300` |
| Focus ring | `focus-visible:ring-brand-500 focus-visible:ring-offset-white` | `dark:focus-visible:ring-brand-400 dark:focus-visible:ring-offset-gray-900` |
| Tooltip | `bg-gray-900 text-white` | `dark:bg-gray-700 dark:text-gray-50` |

`brand-700` (#2A31D8) on `brand-50` (#ECF3FF) and `brand-300` (#9CB9FF) on `gray-900` both clear 4.5:1; `brand-500` and `brand-400` as a 3px bar and as a focus ring clear 3:1 against `white` and `gray-900` respectively. Requirement 6 criterion 5 and Requirement 12 criterion 6 are confirmed with tooling at verification time, not asserted here.

**Active state** (Requirement 3) uses four simultaneous cues, so criteria 2 and 4 hold with room to spare: a `bg-brand-50` fill, a 3px left accent bar (`absolute left-0 h-6 w-[3px] rounded-r-full bg-brand-500`), `text-brand-700` on label and icon, and `font-semibold`. The accent bar is the non-colour cue that survives collapse (criterion 4) — it is a shape at a position, visible with no label and legible to a colour-blind operator.

Active is computed from `useLocation().pathname === entry.path` during render, never stored. There is therefore no intermediate commit where two items are active (criterion 6), and an unregistered route matches nothing so every item renders inactive (criterion 5). `aria-current="page"` comes from `NavLink`'s own behaviour, backed by an explicit attribute so it does not depend on router internals (criterion 3).

**Groups** (Requirement 2): expanded and drawer states render each `NAV_GROUPS` label as `text-xs font-semibold uppercase tracking-wider text-gray-400` — differing from item labels in size, weight, letter-spacing and colour, which is four of the four cues criterion 5 offers. Collapsed replaces the heading with `<li role="separator" class="mx-auto my-3 h-px w-8 bg-gray-200 dark:bg-gray-800">` — a visible divider, not the `HorizontaLDots` placeholder glyph criterion 4 rejects. Items stay contiguous in DOM order because each group is one `ul`. No group gets a border box or card background (criterion 6); grouping is spacing (`space-y-6` between groups, `space-y-1` within) plus the type scale.

**Collapsed tooltips** (Requirement 4 criterion 6): a CSS-only sibling span on the `NavItem`, shown by `group-hover:` and `group-focus-visible:`, positioned `absolute left-full ml-2` with `pointer-events-none whitespace-nowrap`. It carries `aria-hidden="true"` because the anchor already has an `aria-label` — a tooltip that also announced itself would double up in a screen reader. It appears on keyboard focus as well as hover, which criterion 6 requires and which a `title` attribute would not deliver.

### Header

`<header>` — a bare `header` element that is not nested inside another landmark exposes `banner` implicitly, so no `role` attribute is needed (Requirements 7 criterion 7, 12 criterion 2).

```
sticky top-0 z-30  flex h-16 w-full items-center gap-2 px-3 lg:px-6
bg-white/95 backdrop-blur  dark:bg-gray-900/95
border-b border-gray-200  dark:border-gray-800
```

`z-30` replaces the current `z-99999`. Ordering: page content `z-auto` < header `z-30` < backdrop `z-40` < sidebar/drawer `z-50`. The drawer must sit above the header on mobile; the header must sit above page content, including the `z-10` sticky table headers inside pages. `z-99999` broke the first of those. Sticky positioning plus a fixed `h-16` and a non-transparent background is what keeps the header from overlapping the first content row on scroll (Requirement 7 criterion 8) — the content region's own `p-4 md:p-6` provides the gap.

DOM order equals visual order, left to right (Requirements 7 criterion 2, 12 criterion 3):

1. `IconButton` sidebar toggle — `aria-expanded={railState === 'expanded'}`, `aria-controls="app-sidebar"`, label `"Collapse sidebar"` / `"Expand sidebar"` at desktop and `"Open navigation"` / `"Close navigation"` at mobile, so the name always names the target action (Requirement 1 criteria 6, 7). Glyph: `PanelLeftClose` / `PanelLeftOpen` at desktop, `Menu` / `X` at mobile — all Lucide, so **no inline SVG path markup remains in `AppHeader.tsx`** (Requirement 4 criterion 7).
2. `BrandLockup` — `md:hidden`, mobile only, same component as the rail's.
3. `BreadcrumbTrail` — `min-w-0 flex-1`, so it absorbs slack and truncates rather than pushing anything off-screen.
4. `SearchTrigger`.
5. `HeaderQuickActions`.
6. `NotificationDropdown` — untouched, including its `ProductNotificationContext` highlight-then-scroll into `/products` (Requirement 7 criterion 5, Requirement 14 criterion 3).
7. `UserDropdown` — untouched, including logout and `resetAppData()` (Requirement 7 criterion 6, Requirement 14 criterion 4).

Nothing else is rendered. The `isApplicationMenuOpen` state and the collapsible right-hand cluster it gated are both deleted, so the header is one flat row of seven slots (Requirement 7 criterion 3, Requirement 10 criterion 4).

#### Degradation order

Exactly the order Requirement 7 criterion 4 specifies, implemented with Tailwind breakpoint utilities on the elements themselves rather than JS width measurement:

| Width | Quick action | Search_Trigger | Page context | Always present |
| --- | --- | --- | --- | --- |
| `≥1280` (`xl`) | icon + `New sale` label | icon + `Search…` + `Ctrl K` hint | full trail | toggle, notifications, user menu |
| `1024–1279` (`lg`) | **icon only** (`aria-label="New sale"`) | icon + `Search…` + hint | full trail | ″ |
| `768–1023` (`md`) | icon only | **icon only** | full trail | ″ |
| `<768` | **hidden** (Requirement 10 criterion 1) | icon only | **final crumb only** | ″ |

Step 1 collapses quick actions, step 2 reduces the search trigger, step 3 truncates the page context — the stated sequence. The toggle, notifications and user menu carry no responsive visibility class at all, which is how "visible at every width from 320px upward" is guaranteed rather than hoped for.

Truncation is `BreadcrumbTrail` hiding all but the last `li` below `md` (`hidden md:flex` on the preceding items), so the label that remains is the current page. At `md` and up the trail additionally truncates its text with `truncate` inside a `min-w-0` container, so a long label shortens instead of wrapping.

#### Search_Trigger and the placeholder surface

`SearchTrigger` renders a **`button` styled to read as a field**, not an `input`. This matters for Requirement 11 criterion 3: the shell defines no replacement search input, because the trigger is not an input, and the real `SearchInput` is what the surface renders.

```
<button aria-label="Search" aria-keyshortcuts="Control+K">
  <Search aria-hidden />
  <span class="hidden lg:inline">Search…</span>
  <kbd class="hidden lg:inline-flex">Ctrl K</kbd>
</button>
```

The `kbd` is visible text at and above `lg` (Requirement 9 criterion 2). `aria-keyshortcuts` announces the same thing to assistive tech.

`useSearchSurface` owns the behaviour:

- **Global binding** (criterion 3): one `keydown` listener on `window`. Fires on `(event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'`, then `preventDefault()`. Ignored when the event target is an `INPUT`, `TEXTAREA` or `SELECT` or is `isContentEditable` — "outside a text input", as the criterion words it.
- **`/` is never bound** (criterion 7). The listener matches only `k` with a modifier, so `orderpage.tsx`'s `/` handler stays the sole handler. The reverse direction also holds: that handler already returns early when the event target is an `INPUT`, and the surface autofocuses a real input, so pressing `/` inside the open surface types a literal `/` and does not steal focus to the page filter. Neither listener double-handles the other's key.
- **Focus in** (criterion 4): the surface renders `SearchInput` with `autoFocus`.
- **Escape** (criterion 5): a `keydown` handler on the panel closes the surface; the hook then calls `triggerRef.current?.focus()`. Focus restoration lives in the hook, not the surface, so it survives the palette swap.
- **No focus trap** (criterion 6). Tab and Shift+Tab move naturally through the panel's controls. A `focusout` handler on the panel checks whether `event.relatedTarget` is still inside; if not, it closes the surface **without** calling `preventDefault`, so the keypress lands on whatever comes next. That is "close the surface rather than discard the keypress", and it is deliberately the opposite of the drawer's behaviour below.

`SearchOverlay` renders a scrim (`fixed inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm`) and a panel (`role="dialog" aria-modal="false" aria-label="Search"`). `aria-modal="false"` is correct and intentional: this surface does not trap focus, so claiming modality would mislead a screen reader. Body: the `SearchInput` plus `Search is not yet available. Use the sidebar to navigate.` — the Requirement 9 criterion 12 message.

The Command_Palette will replace **only** this body. `SearchTrigger`'s props, `useSearchSurface`'s return shape and `AppHeader`'s markup are all unchanged by that follow-up.

#### Quick actions

`HeaderQuickActions` renders one `Link` to `/orderpage` wrapping `Button` with `startIcon={<ShoppingCart …/>}`, returning `null` when `useLocation().pathname === '/orderpage'`. Label hidden below `xl` with `aria-label="New sale"` preserved on the button, so the icon-only form keeps a non-empty accessible name (Requirement 12 criterion 5). Whole component hidden below `md`.

`Home.tsx` loses its `<Link to="/orderpage"><Button>New sale</Button></Link>` block from `PageHeader` `actions` and keeps the date/time block and `Refresh` (D3).

### Drawer_State

`useDrawerA11y({ open, onClose, containerRef, returnFocusRef })` covers Requirement 1 criteria 8–11 and Requirement 12 criterion 7:

- **Escape closes and returns focus** (criterion 9): `keydown` on `document` while open; on close, focus goes to `returnFocusRef` — the Header toggle, which is the control that opened it.
- **Backdrop click closes** (criterion 10): the Backdrop's `onClick` calls `closeDrawer`.
- **Scroll lock** (criterion 11): `document.body.style.overflow = 'hidden'` while open, restored to its previous value on close. Restoring the captured previous value rather than `''` avoids stomping a lock held by a page-level modal — `sweetalert2` and the Radix dialog are both in use.
- **Focus containment** (Requirement 12 criterion 7): a `keydown` handler cycles Tab and Shift+Tab across the drawer's focusable elements, wrapping at both ends. Focus stays inside until the drawer closes. This is the deliberate opposite of the search surface: the drawer is a modal overlay covering the page, the search placeholder is not.

**`Backdrop.tsx` is extended, not replaced.** It already does the right thing structurally — reads context, renders nothing when closed, closes on click. Changes: read `railState === 'drawer' && isDrawerOpen` instead of `isMobileOpen`, call `closeDrawer` instead of the toggle, add `aria-hidden="true"`, replace the deprecated `bg-opacity-50` with `bg-gray-900/50`, add `dark:bg-black/60`, and add the fade from `SHELL_TRANSITION`. It stays a ~30-line file and keeps its name, so nothing else needs to know.

### Content offset

`AppLayout`'s `LayoutContent` reads `railState` alone (D4, Requirement 13 criterion 4):

```tsx
const offset =
  railState === 'drawer'   ? CONTENT_OFFSET_NONE :
  railState === 'expanded' ? CONTENT_OFFSET_EXPANDED :
                             CONTENT_OFFSET_COLLAPSED;

<div className={cn('flex min-w-0 flex-1 flex-col', offset, SHELL_TRANSITION)}>
```

Three points this settles:

- **No `isHovered`.** The offset changes only when the toggle changes `isExpanded` or the viewport crosses a band (Requirement 5 criteria 2, 7).
- **Drawer leaves the offset at zero** (Requirement 1 criterion 13), because `railState === 'drawer'` maps to `ml-0`.
- **No horizontal scrollbar, 320–2560px** (Requirement 1 criterion 12). The offset is a margin on a `min-w-0 flex-1` column, so the content box is viewport width minus rail width and never wider than the viewport. `min-w-0` is the part that matters: without it a wide flex child refuses to shrink and pushes the page. The existing `mx-auto max-w-screen-2xl p-4 md:p-6` inside `PageArea` is unchanged, which is what keeps 2560px readable.

`xl:flex` on the outer wrapper is dropped — the rail is `fixed`, so a flex row buys nothing and the `xl` prefix was another stray breakpoint.

`PageArea` and the `bootstrapped`/`AppBootstrapSkeleton` gate are untouched (Requirement 14 criterion 2).

### `PageHeader` change

`breadcrumbs` is deleted from `PageHeaderProps`, and the `nav aria-label="Breadcrumb"` block plus its inline chevron SVG are deleted from the body — roughly 45 lines gone. `title`, `description`, `eyebrow`, `actions`, `children` and `className` are untouched, so `title` stays the page's single `h1`.

Seven call sites drop their `breadcrumbs={[…]}` line: `components/form/Category.tsx:158`, `pages/OrderPage/orderpage.tsx:137`, `pages/Products/products.tsx:344`, `pages/Reports/DamageReport.tsx:240`, `pages/Reports/InventoryReport.tsx:562`, `pages/Reports/SalesReport.tsx:457`, `pages/Transactions/TransactionHistory.tsx:191`. `Home.tsx` has no such line. After this, `grep -rn breadcrumbs FE/src` returns nothing, which is how Requirement 8 criterion 4 is checked.

Because `breadcrumbs` is optional, removing it from the type turns every call site into a compile error — `tsc -b` enumerates the work rather than leaving it to grep.

`PageMeta` and every page's `actions` are untouched (Requirement 14 criterion 5).

### Mobile "application menu" toggle — remove it

**Recommendation: remove.** Requirement 10 criterion 5 allows either a distinct function or removal.

The control currently toggles the visibility of the header's right-hand cluster — notifications and the user menu — on mobile only. It exists because that cluster was laid out as a second row that had to be hidden to fit. Once the header is a single flat row, there is nothing left for it to reveal: the mobile row is brand lockup, toggle, icon-only search, notifications and user menu, which is five 40×40 targets plus a lockup, and that fits at 320px with room over. A control whose only job is to reveal two buttons that are already visible has no distinct function to be given, and every candidate function for it (a duplicate nav menu, an overflow menu) is already reachable through the drawer or the user menu. Removing it also deletes the second of the two inline hand-written SVGs (Requirement 4 criterion 7) and the `isApplicationMenuOpen` state.

---

## Files affected

| File | Change |
| --- | --- |
| `FE/src/lib/navigation.ts` | **new** — Route_Registry, `findRoute`, `sidebarGroups`, `resolveBreadcrumbs` |
| `FE/src/lib/shellTokens.ts` | **new** — Icon_Size_Token, rail widths, offsets, transitions, storage key |
| `FE/src/hooks/useSearchSurface.ts` | **new** — `Cmd`/`Ctrl`+`K`, open/close, focus restoration |
| `FE/src/hooks/useDrawerA11y.ts` | **new** — Escape, scroll lock, focus containment |
| `FE/src/components/shell/BrandLockup.tsx` | **new** |
| `FE/src/components/shell/IconButton.tsx` | **new** |
| `FE/src/components/shell/NavItem.tsx` | **new** |
| `FE/src/components/shell/NavGroup.tsx` | **new** |
| `FE/src/components/shell/BreadcrumbTrail.tsx` | **new** |
| `FE/src/components/shell/SearchTrigger.tsx` | **new** |
| `FE/src/components/shell/SearchOverlay.tsx` | **new** — placeholder body; the Command_Palette's future home |
| `FE/src/components/shell/HeaderQuickActions.tsx` | **new** |
| `FE/src/context/SidebarContext.tsx` | **rewrite** — persisted `isExpanded`, `viewport`, derived `railState`; six members removed |
| `FE/src/layout/AppSidebar.tsx` | **rewrite** — composition, dark mode, no hover handlers, registry-driven |
| `FE/src/layout/AppHeader.tsx` | **rewrite** — seven regions, no inline SVG, no application-menu state |
| `FE/src/layout/AppLayout.tsx` | **edit** — offset from `railState` alone; `isHovered` gone |
| `FE/src/layout/Backdrop.tsx` | **edit** — new context members, `aria-hidden`, dark variant, fade |
| `FE/src/components/common/PageHeader.tsx` | **edit** — `breadcrumbs` prop and its markup removed |
| `FE/src/components/form/Category.tsx` | **edit** — drop `breadcrumbs` |
| `FE/src/pages/OrderPage/orderpage.tsx` | **edit** — drop `breadcrumbs` |
| `FE/src/pages/Products/products.tsx` | **edit** — drop `breadcrumbs` |
| `FE/src/pages/Reports/DamageReport.tsx` | **edit** — drop `breadcrumbs` |
| `FE/src/pages/Reports/InventoryReport.tsx` | **edit** — drop `breadcrumbs` |
| `FE/src/pages/Reports/SalesReport.tsx` | **edit** — drop `breadcrumbs` |
| `FE/src/pages/Transactions/TransactionHistory.tsx` | **edit** — drop `breadcrumbs` |
| `FE/src/pages/Dashboard/Home.tsx` | **edit** — remove the `New sale` action (D3) |
| `FE/src/App.tsx` | **unchanged** (Requirement 14 criterion 6) |
| `FE/src/icons/index.ts` | **unchanged** — shared barrel, other consumers |
| `FE/src/index.css` | **unchanged** — `menu-*` classes left for non-shell consumers; the shell stops using them |
| `FE/src/components/header/NotificationDropdown.tsx` | **unchanged** (Requirement 7 criterion 5) |
| `FE/src/components/header/UserDropdown.tsx` | **unchanged** (Requirement 7 criterion 6) |

---

## Error handling

| Situation | Behaviour |
| --- | --- |
| `localStorage` value absent or corrupt | Fall through to the width-appropriate default; no throw (Requirement 1 criterion 5) |
| `localStorage` access throws (disabled, quota) | `try/catch` on read and write; shell runs without persistence |
| Route not in Route_Registry | `resolveBreadcrumbs` returns `Dashboard` + `Page`; every Nav_Item inactive (Requirements 8 criterion 7, 3 criterion 5) |
| `useSidebar` called outside `SidebarProvider` | Throws naming the provider (Requirement 13 criterion 5) |
| Viewport crosses a band while the drawer is open | Drawer closes; `railState` recomputes from one source, so no disagreement (Requirement 10 criterion 6) |
| `Cmd+K` pressed while typing in a page filter | Ignored — target is an editable element (Requirement 9 criterion 3) |
| Drawer unmounts while scroll lock is held | Cleanup effect restores the captured previous `overflow` value |

---

## Correctness properties

*A property is a characteristic or behaviour that should hold true across all valid executions of a system — a formal statement about what the system should do, verifiable across many generated inputs.*

**This design specifies no property-based tests.** That is a judgement, not an omission, and here is the reasoning.

**What this spec actually changes.** Class names, ARIA attributes, DOM structure, one context's shape, and one pure data module. Nearly every acceptance criterion is either a static fact about the source (`no literal hex`, `no per-item override`, `under 150 lines`, `no any`) — exhaustively checkable by `tsc -b`, `eslint` and grep — or a visual/interaction fact requiring a rendering engine and a human eye (contrast ratios, "no layout shift on hover", "single row at 320px").

**The two criteria with a genuinely large input domain both need real layout.** Requirement 1 criterion 12 quantifies over viewport widths 320–2560; Requirement 5 criterion 2 quantifies over shell controls and asserts geometry is unchanged on hover. Both are honest universal statements. Neither is testable in jsdom, which implements no layout: `scrollWidth` and `getBoundingClientRect()` return zeros, so a property test would pass **vacuously** — a green assertion that checks nothing, which is worse than no test. Verifying them for real needs a browser driver (Playwright), which this project does not have and which is a larger undertaking than the feature.

**The one legitimate candidate, evaluated.** `resolveBreadcrumbs(pathname: string): Crumb[]` is a pure total function with real invariants: never throws for any string, always returns a non-empty array, first crumb is always `Dashboard`, last crumb never carries `to`, exactly one crumb carries `aria-current`. Universal quantification over arbitrary strings is meaningful precisely because the unregistered branch must be total.

Weighed against enumeration: the registry is a **nine-row literal**, so the registered branch has exactly nine reachable behaviours. The unregistered branch is a single code path with no data dependence beyond "this key is absent from a nine-key map" — `/nope`, `/dashboard/x`, `''` and a 500-character random string all traverse the same three lines. A generator over strings would therefore rediscover the same two equivalence classes a few thousand times. **Ten cases — the nine registered paths plus one unregistered — are exhaustive over the behaviour space.** A property test here would be a more expensive way to reach identical coverage.

The related candidate, "at most one Nav_Item is active for any pathname" (Requirement 3 criteria 1 and 5), collapses into the same lookup: both are `pathname → registry entry`, so a property on one is a property on the other. Consolidated away rather than listed twice.

**And there is no runner.** `FE/package.json` has no vitest, jest, testing-library or fast-check. Standing up a test runner, jsdom and a PBT library to host a single property whose coverage a ten-row table already matches is disproportionate to a chrome redesign, and it would expand this spec's blast radius from the shell into the build configuration.

**Recorded for the follow-up spec.** When the Command_Palette lands (D2), it brings the first genuine property in this area: *for any catalog of products and any query of two or more characters, every result the palette lists matches the query, and no matching record is omitted.* That has a large input domain, a pure filtering function underneath, and real edge cases (case folding, whitespace, punctuation in transaction numbers, unicode product names) that generated inputs would find and a handful of examples would not. If a test runner is introduced for that spec, the `resolveBreadcrumbs` totality property is worth adding alongside it at near-zero marginal cost.

**What replaces tests here:** `npx tsc -b` and `npm run build` for the static half, a non-increasing `eslint` count, targeted greps for the "SHALL NOT contain" criteria, and the manual checklist below for the visual and interaction half — which is where the value actually is for presentational work.

---

## Verification

### Automated

Run from `FE/`:

```
npx tsc -b        # Requirement 14 criterion 7 — no new type errors
npm run build     # Requirement 14 criterion 8 — no new build errors or warnings
npx eslint .      # Requirement 14 criterion 9 — see baseline below
```

Targeted static checks for the "SHALL NOT" criteria, run from `FE/`:

| Check | Command | Expected |
| --- | --- | --- |
| No hand-written breadcrumbs (Req 8.4) | `grep -rn "breadcrumbs" src` | no matches |
| No inline SVG paths in the header (Req 4.7) | `grep -n "<path" src/layout/AppHeader.tsx` | no matches |
| No per-item icon override (Req 4.3) | `grep -rn "fill-black\|dark:fill-gray-900" src/layout src/components/shell` | no matches |
| No literal colours in shell files (Req 6.3) | `grep -rnE "#[0-9a-fA-F]{3,8}\|rgb\(\|hsl\(" src/layout src/components/shell src/lib/shellTokens.ts` | no matches |
| No `any` in shell files (Req 11.5) | `grep -rn ": any\|as any\|<any" src/layout src/components/shell src/lib/navigation.ts src/context/SidebarContext.tsx` | no matches |
| Every shell file under 150 lines (Req 11.2) | `wc -l src/layout/*.tsx src/components/shell/*.tsx src/context/SidebarContext.tsx src/lib/navigation.ts` | all `< 150` |
| Dead context members gone (Req 13.2, 13.4) | `grep -rn "isHovered\|activeItem\|openSubmenu\|toggleSubmenu" src` | no matches |
| Routes untouched (Req 14.6) | `git diff --stat -- src/App.tsx` | empty |

#### Lint baseline

`npx eslint .` currently reports **80 errors and 27 warnings**, project-wide and pre-existing. They are predominantly `@typescript-eslint/no-explicit-any` in pages, contexts and `src/svg.d.ts` (which also trips `no-require-imports`) — files this spec does not touch. **The bar is therefore "no NEW lint errors": capture the count before starting and confirm it has not risen.** Requirement 14 criterion 9 is satisfied by a non-increasing total, not by a clean run, and fixing the pre-existing 80 is out of scope.

### Manual checklist

Human-performed, in a browser, **in both light and dark themes** unless noted.

**Sidebar states (Req 1, 2, 3, 4)**
- [ ] Toggle at ≥1024px switches expanded ⇄ collapsed; toggle glyph and accessible name flip with it
- [ ] Reload in each state: the rail comes back in the same state with **no flash** of the other width (Req 1.4)
- [ ] Clear `pos.shell.sidebarExpanded` and reload at 1440px → expanded; at 900px → collapsed (Req 1.5, 10.2)
- [ ] Set the key to garbage (`"maybe"`), reload → default applies, no error in the console
- [ ] Three groups read `Menu`, `Product Catalog`, `Reports` in that order with the eight documented items (Req 2.1, 2.2)
- [ ] Collapsed: group separators are dividers, not a dots glyph; items stay in group order (Req 2.4)
- [ ] All eight nav icons are the **same colour** in dark mode — Damage Report included (Req 4.2, 4.4)
- [ ] All eight icons are the same visual size (Req 4.1)
- [ ] Collapsed: hover **and** keyboard focus each show the item's tooltip (Req 4.6)
- [ ] Active item shows fill, accent bar, brand-coloured icon/label and heavier weight; only one at a time (Req 3.1, 3.2)
- [ ] Collapsed: the active item is still identifiable by its accent bar with no label (Req 3.4)
- [ ] Visit `/nope` → no nav item is active, nothing throws (Req 3.5, 8.7)

**Drawer (Req 1.8–1.11, 12.7)**
- [ ] At 375px the rail is an overlay with a backdrop; page content does not shift horizontally (Req 1.13)
- [ ] Escape closes it and focus lands back on the header toggle
- [ ] Backdrop click closes it
- [ ] Background does not scroll while it is open
- [ ] Tab past the last nav item wraps to the first — focus never escapes the drawer

**Header (Req 7, 9, 10)**
- [ ] Breadcrumb trail matches the sidebar label on all nine routes, including `/profile`
- [ ] Final crumb is plain text with `aria-current="page"`; preceding `Dashboard` crumb is a link
- [ ] Narrow the window through 1400 → 1100 → 900 → 700 → 320px and confirm the degradation order: quick action label goes, then the search label and hint, then the leading crumbs; toggle, notifications and user menu never disappear (Req 7.4)
- [ ] Header stays one row at 320px (Req 10.4)
- [ ] Header stays visible on scroll and does not cover the first row of page content (Req 7.8)
- [ ] `New sale` is present on `/dashboard` **once** and absent on `/orderpage` (D3)
- [ ] No "application menu" dots control exists anywhere (Req 10.5)
- [ ] Below 1024px every header and sidebar control measures ≥40×40 in devtools (Req 10.7)

**Search (Req 9)**
- [ ] Tab reaches the trigger; `Ctrl K` is visible text at ≥1024px
- [ ] `Ctrl`/`Cmd`+`K` on three different routes opens the surface and focus lands in the input
- [ ] `Ctrl`/`Cmd`+`K` while typing in the `/products` filter does nothing (Req 9.3)
- [ ] Escape closes and focus returns to the trigger
- [ ] Tab out of the surface closes it and focus continues onward — no trap (Req 9.6)
- [ ] On `/orderpage`, `/` with focus on the body still focuses the page's product filter (Req 9.7)
- [ ] On `/orderpage`, open the surface with `Ctrl+K`, press `/` → a literal `/` is typed and the page filter is untouched (Req 9.7)
- [ ] The surface states that search is not yet available (Req 9.12)

**Theme and motion (Req 5, 6)**
- [ ] Toggle the theme with the sidebar open: both bars recolour with no reload and no white stripe (Req 6.1, 6.2, 6.6)
- [ ] Run axe or devtools contrast on both bars in both themes: text ≥4.5:1, icons/borders/focus rings ≥3:1 (Req 6.5, 12.6)
- [ ] Sweep the pointer across the rail and header — nothing moves, resizes or reflows (Req 5.2, 5.7, D4)
- [ ] Tab through the whole shell: every control shows a visible focus ring in both themes (Req 5.3)
- [ ] Enable OS reduced motion, toggle the rail and open the drawer → state changes are instant (Req 5.6)

**Keyboard traversal and landmarks (Req 12)**
- [ ] Tab alone reaches: toggle, all eight nav items, breadcrumb link, search trigger, quick action, notifications, user menu — and `/profile` via the user menu (Req 12.4)
- [ ] Tab order matches visual left-to-right, top-to-bottom order (Req 12.3)
- [ ] Landmarks report one `banner` and a `navigation` named for the main nav plus one named `Breadcrumb` (Req 12.1, 12.2, 8.8)

**Layout sweep (Req 1.12)**
- [ ] At 320, 375, 640, 768, 1024, 1440, 1920 and 2560px, in every rail state: no horizontal page scrollbar, no overlap between rail and content

**No regression (Req 14)**
- [ ] All nine destinations render their page (Req 14.1)
- [ ] Fresh login shows `AppBootstrapSkeleton`, then the page — the `Outlet` is withheld until `bootstrapped` (Req 14.2)
- [ ] Open a low-stock alert from notifications → `/products` with the product highlighted and scrolled to (Req 14.3)
- [ ] Log out from the user menu → cache cleared, back at sign-in (Req 14.4)
- [ ] All eight screens: document title still correct, `h1` still present exactly once, page action buttons still work (Req 14.5)
