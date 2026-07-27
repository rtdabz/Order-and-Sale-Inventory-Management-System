# Implementation Plan: POS shell redesign

## Overview

Shared foundations land first (Route_Registry, shell tokens, `IconButton`, `BrandLockup`) because they have no dependencies and no consumers, so each one compiles on its own. The `SidebarContext` rewrite and its four consumers are updated in **one** task, because removing `isHovered` breaks `AppLayout`, `AppSidebar` and `AppHeader` simultaneously — splitting it would leave the tree non-compiling between tasks. Sidebar composition, then header composition, then the `PageHeader` prop change (which `tsc` turns into an enumerated list of call-site errors). Every task ends compiling.

The design concludes that this spec warrants **no property-based tests** and the repository has no test runner, so no test-authoring tasks appear below. Static guarantees come from `tsc -b`, `npm run build`, a non-increasing `eslint` count and targeted greps; behavioural guarantees come from the human checklist in task 9.

All commands run from `FE/`.

## Tasks

- [x] 1. Shared foundations
  - [x] 1.1 Create `FE/src/lib/navigation.ts` (Route_Registry)
    - Export `NavGroupId`, `RouteEntry`, `Crumb`, `NAV_GROUPS`, `ROUTE_REGISTRY`, `DASHBOARD_PATH`, `UNKNOWN_ROUTE_LABEL`
    - Nine entries with `path`, `label`, `group`, `icon` (a `LucideIcon` reference, not an element) and `showInSidebar`; `/profile` is registered with `showInSidebar: false`
    - Labels exactly: Dashboard, POS Terminal, Transactions, Stock management, Categories, Sales Report, Inventory Report, Damage Report, Profile
    - Icons from `lucide-react`: `LayoutDashboard`, `ScanBarcode`, `ReceiptText`, `Package`, `Tags`, `TrendingUp`, `Boxes`, `TriangleAlert`, `UserRound`
    - Export `findRoute(pathname)`, `sidebarGroups()` and `resolveBreadcrumbs(pathname)`
    - `resolveBreadcrumbs` is total: first crumb always `Dashboard` (linked unless it is also last), a non-link group crumb only when the group is not `menu` and its label differs from the page label, final crumb never carries `to`; unregistered paths return `Dashboard` + `Page` and never throw
    - No React import, no JSX, no `any`
    - _Requirements: 2.2, 8.1, 8.3, 8.5, 8.6, 8.7, 11.5_

  - [x] 1.2 Create `FE/src/lib/shellTokens.ts`
    - Export `SHELL_ICON_CLASS` (`'h-5 w-5 shrink-0'`), `SHELL_ICON_STROKE` (`1.75`)
    - Export `RAIL_WIDTH_EXPANDED`/`RAIL_WIDTH_COLLAPSED` and `CONTENT_OFFSET_EXPANDED`/`CONTENT_OFFSET_COLLAPSED`/`CONTENT_OFFSET_NONE` as literal Tailwind class strings (280px / 80px)
    - Export `SHELL_TRANSITION` enumerating only `margin`, `transform`, `opacity`, `background-color`, `border-color`, `color` at `duration-200`, with `motion-reduce:transition-none`; export `SHELL_COLOR_TRANSITION` at `duration-150` with the same reduced-motion suffix
    - Export `SIDEBAR_STORAGE_KEY = 'pos.shell.sidebarExpanded'`
    - No `transition-all` and no literal colour values
    - _Requirements: 4.1, 5.4, 5.5, 5.6, 11.6_

  - [x] 1.3 Create `FE/src/components/shell/IconButton.tsx`
    - Props type: `label: string`, `children: React.ReactNode`, `onClick: () => void`, optional `aria-expanded`, `aria-controls`, `className`
    - Renders a `button` with `aria-label={label}`, fixed `h-10 w-10` hit area rising to `h-11 w-11` at `lg`, shared hover and `focus-visible` ring tokens with `dark:` variants
    - Uses `SHELL_COLOR_TRANSITION`; no inline SVG, no literal colours, no `any`
    - _Requirements: 4.7, 5.1, 5.3, 10.7, 11.1, 11.5, 12.5_

  - [x] 1.4 Create `FE/src/components/shell/BrandLockup.tsx`
    - Props type: `showWordmark: boolean`, optional `className`
    - `Link` to `/dashboard` wrapping `/images/logo/MKB.jpg` at the current 50×50 with `rounded-lg`, plus the `MKB` wordmark when `showWordmark` is true
    - Wordmark colour has a `dark:` variant (the current `text-gray-800` has none)
    - _Requirements: 2.8, 6.1, 6.2, 6.4, 11.1, 11.5_

- [x] 2. Sidebar_Context and content offset
  - [x] 2.1 Rewrite `FE/src/context/SidebarContext.tsx` and update all four consumers in the same change
    - Context value: `isExpanded`, `isDrawerOpen`, `viewport` (`'mobile' | 'tablet' | 'desktop'`), derived `railState` (`'expanded' | 'collapsed' | 'drawer'`), `toggleSidebar`, `openDrawer`, `closeDrawer`; explicit exported type, no unused state
    - Remove `activeItem`, `openSubmenu`, `setActiveItem`, `toggleSubmenu`, `isHovered`, `setIsHovered`
    - Read the persisted boolean in a **lazy `useState` initialiser** (not an effect) so the restored width is correct on the first paint; helper accepts only `"true"`/`"false"` and otherwise falls back to `viewport === 'desktop'`; wrap read and write in `try/catch`
    - Track `viewport` with two `matchMedia` listeners (`(max-width: 767px)`, `(min-width: 1024px)`); close the drawer when leaving `mobile`
    - Keep the `useSidebar` throw naming `SidebarProvider`
    - Update in the same task so the tree keeps compiling: `AppLayout.tsx` computes the offset from `railState` alone using the `CONTENT_OFFSET_*` tokens on a `min-w-0 flex-1` column and drops `xl:flex`; `Backdrop.tsx`, `AppSidebar.tsx` and `AppHeader.tsx` switch to the new members; delete the `991` branch in `AppHeader.handleToggle` in favour of `viewport !== 'mobile' ? toggleSidebar() : openDrawer()/closeDrawer()`
    - Leave `PageArea`, `bootstrapped` and `AppBootstrapSkeleton` untouched
    - Verify: `npx tsc -b` clean, `grep -rn "isHovered\|activeItem\|openSubmenu\|toggleSubmenu" src` returns nothing
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.12, 1.13, 5.7, 10.6, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 14.2_

  - [x] 2.2 Extend `FE/src/layout/Backdrop.tsx`
    - Render only when `railState === 'drawer' && isDrawerOpen`; click calls `closeDrawer`
    - Add `aria-hidden="true"`, replace the deprecated `bg-opacity-50` with `bg-gray-900/50`, add `dark:bg-black/60`, add the opacity fade from `SHELL_TRANSITION`, keep `z-40`
    - Keep the file name and export so no other file changes
    - _Requirements: 1.10, 5.5, 5.6, 6.1, 6.3_

  - [x] 2.3 Create `FE/src/hooks/useDrawerA11y.ts`
    - Signature `useDrawerA11y({ open, onClose, containerRef, returnFocusRef })`
    - `Escape` closes and moves focus to `returnFocusRef`
    - Locks `document.body.style.overflow` while open and restores the **captured previous value** on cleanup, so a page-level modal's lock is not stomped
    - Cycles `Tab`/`Shift+Tab` across the container's focusable elements, wrapping at both ends, so focus cannot leave while open
    - No `any`; wired up in task 3.3
    - _Requirements: 1.9, 1.11, 12.7_

- [x] 3. Sidebar composition
  - [x] 3.1 Create `FE/src/components/shell/NavItem.tsx`
    - Props type: `entry: RouteEntry`, `showLabel: boolean`
    - `NavLink` to `entry.path`; active when `useLocation().pathname === entry.path`, computed during render and never stored
    - Active cues, all four: `bg-brand-50 dark:bg-brand-500/10`, a 3px left accent bar (`bg-brand-500 dark:bg-brand-400`), `text-brand-700 dark:text-brand-300` on label and icon, `font-semibold`
    - Explicit `aria-current="page"` on the active anchor; `aria-label={entry.label}` whenever `showLabel` is false
    - Icon rendered as `<entry.icon className={SHELL_ICON_CLASS} strokeWidth={SHELL_ICON_STROKE} aria-hidden="true" />` — one call site, no per-item override
    - Collapsed tooltip: a sibling span shown by `group-hover:` **and** `group-focus-visible:`, `absolute left-full ml-2`, `pointer-events-none whitespace-nowrap`, `aria-hidden="true"`, with `dark:` variants
    - Hover changes colour only; use `SHELL_COLOR_TRANSITION`; do not use the `menu-item*` classes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 6.1, 6.3, 11.2, 11.5_

  - [x] 3.2 Create `FE/src/components/shell/NavGroup.tsx`
    - Props type: `label: string`, `items: readonly RouteEntry[]`, `showLabels: boolean`
    - When `showLabels`: heading as `text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500`
    - When not: a `<li role="separator">` divider (`mx-auto my-3 h-px w-8 bg-gray-200 dark:bg-gray-800`) instead of the `HorizontaLDots` glyph
    - One `ul` per group so items stay contiguous; `space-y-1` within, no border box or card background
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 6.1, 6.3, 11.2_

  - [x] 3.3 Rewrite `FE/src/layout/AppSidebar.tsx`
    - `aside id="app-sidebar"` — `fixed left-0 top-0 z-50 h-screen flex flex-col`, `bg-white dark:bg-gray-900`, `border-r border-gray-200 dark:border-gray-800`; drop the `mt-16 lg:mt-0` offset
    - Width from `RAIL_WIDTH_*`; drawer translate via `-translate-x-full` / `translate-x-0`; no `onMouseEnter`/`onMouseLeave`
    - `BrandLockup` at the top with `showWordmark` true when labels are shown
    - `nav` with an accessible name identifying it as the main navigation, containing `sidebarGroups().map(…)` → `NavGroup`, `space-y-6` between groups
    - Labels shown when `railState !== 'collapsed'`
    - Wire `useDrawerA11y` for the drawer, passing the header toggle ref supplied through context or a shared ref so focus returns to the control that opened it
    - Keep the file under 150 lines
    - _Requirements: 1.1, 1.8, 1.9, 1.11, 2.1, 2.7, 2.8, 6.1, 6.3, 6.5, 11.1, 11.2, 12.1, 12.7_

- [x] 4. Checkpoint — sidebar compiles and builds
  - Run `npx tsc -b` and `npm run build` from `FE/`; both clean of new errors. Ensure all checks pass, ask the user if questions arise.
  - _Requirements: 14.7, 14.8_

- [x] 5. Header composition
  - [x] 5.1 Create `FE/src/components/shell/BreadcrumbTrail.tsx`
    - `nav aria-label="Breadcrumb"` wrapping an `ol`, built from `resolveBreadcrumbs(useLocation().pathname)`
    - Crumbs with `to` render as `Link`; the final crumb renders as text with `aria-current="page"`; the group crumb renders as plain text with neither
    - Separator chevron from `lucide-react` with `aria-hidden="true"`
    - Below `md`, hide every crumb except the last (`hidden md:flex` on the others); at `md` and up, `truncate` inside a `min-w-0` container
    - Colours have `dark:` variants; no literal colours
    - _Requirements: 6.1, 6.3, 7.4, 8.3, 8.5, 8.6, 8.7, 8.8, 10.2, 11.2, 11.5_

  - [x] 5.2 Create `FE/src/hooks/useSearchSurface.ts`
    - Returns `{ open, openSurface, closeSurface, triggerRef }`
    - One `window` `keydown` listener matching `(metaKey || ctrlKey) && key.toLowerCase() === 'k'`, then `preventDefault()`; ignored when the event target is `INPUT`, `TEXTAREA`, `SELECT` or `isContentEditable`
    - Binds no other key — in particular no `/` binding, so `orderpage.tsx` remains the sole handler of its product-filter hotkey
    - `closeSurface` restores focus to `triggerRef.current`
    - _Requirements: 9.3, 9.5, 9.7_

  - [x] 5.3 Create `FE/src/components/shell/SearchTrigger.tsx`
    - Props type: `onOpen: () => void`, `triggerRef: React.RefObject<HTMLButtonElement>`
    - A `button` (not an input) with `aria-label="Search"` and `aria-keyshortcuts="Control+K"`, containing the `Search` glyph (`aria-hidden`), a `Search…` label at `lg` and up, and a `kbd` reading `Ctrl K` at `lg` and up
    - Icon-only below `lg`; 40×40 minimum hit area; `dark:` variants throughout
    - _Requirements: 7.4, 9.1, 9.2, 10.1, 10.7, 11.2, 11.5, 12.5_

  - [x] 5.4 Create `FE/src/components/shell/SearchOverlay.tsx`
    - Props type: `open: boolean`, `onClose: () => void`
    - Scrim (`fixed inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm`) plus a centred panel with `role="dialog" aria-modal="false" aria-label="Search"`
    - Body renders the existing `components/ui/input/SearchInput` with `autoFocus` and local value state, plus the text `Search is not yet available. Use the sidebar to navigate.` — do **not** define a replacement input primitive
    - `Escape` on the panel calls `onClose`
    - `focusout` on the panel closes when `event.relatedTarget` is outside, **without** `preventDefault`, so `Tab` continues onward rather than being trapped or discarded
    - Structure the file so the body can be swapped for the future Command_Palette without touching `SearchTrigger`, `useSearchSurface` or `AppHeader`
    - _Requirements: 9.4, 9.6, 9.12, 11.2, 11.3, 11.5_

  - [x] 5.5 Create `FE/src/components/shell/HeaderQuickActions.tsx`
    - One `Link` to `/orderpage` wrapping the existing `Button` with a `ShoppingCart` `startIcon` and the label `New sale`
    - Returns `null` when `useLocation().pathname === '/orderpage'`
    - Label hidden below `xl` with `aria-label="New sale"` retained; the whole component hidden below `md`
    - _Requirements: 7.2, 7.4, 10.1, 11.1, 11.3, 11.5, 12.5_

  - [x] 5.6 Rewrite `FE/src/layout/AppHeader.tsx`
    - `header` element with no `role` attribute (implicit `banner`), `sticky top-0 z-30 flex h-16 w-full items-center gap-2 px-3 lg:px-6`, `bg-white/95 dark:bg-gray-900/95 backdrop-blur`, `border-b border-gray-200 dark:border-gray-800`; replace `z-99999`
    - DOM order = visual order: `IconButton` toggle → `BrandLockup` (`md:hidden`) → `BreadcrumbTrail` (`min-w-0 flex-1`) → `SearchTrigger` → `HeaderQuickActions` → `NotificationDropdown` → `UserDropdown`, and nothing else
    - Toggle: `aria-expanded={railState === 'expanded'}`, `aria-controls="app-sidebar"`, label naming the target action and differing between desktop and mobile; glyphs `PanelLeftClose`/`PanelLeftOpen` and `Menu`/`X` from `lucide-react`
    - Delete both inline `<svg><path d=…>` blocks, the `isApplicationMenuOpen` state and the mobile application-menu control entirely
    - Mount `SearchOverlay` and wire `useSearchSurface`, passing `triggerRef` to `SearchTrigger`; expose the toggle ref for the drawer's focus return
    - No responsive visibility class on the toggle, notifications or user menu, so they are present at every width; leave `NotificationDropdown` and `UserDropdown` internals untouched
    - Verify `grep -n "<path" src/layout/AppHeader.tsx` returns nothing and the file is under 150 lines
    - _Requirements: 4.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 10.1, 10.2, 10.3, 10.4, 10.5, 10.7, 11.1, 11.2, 11.5, 12.2, 12.3, 12.5_

- [x] 6. Checkpoint — shell compiles and builds
  - Run `npx tsc -b` and `npm run build` from `FE/`; both clean of new errors. Ensure all checks pass, ask the user if questions arise.
  - _Requirements: 14.7, 14.8_

- [x] 7. `PageHeader` and page call sites
  - [x] 7.1 Remove breadcrumbs from `FE/src/components/common/PageHeader.tsx`
    - Delete `breadcrumbs` from `PageHeaderProps`, the destructured parameter, the `nav aria-label="Breadcrumb"` block and its inline chevron SVG (~45 lines)
    - Leave `title` (still the page's single `h1`), `description`, `eyebrow`, `actions`, `children` and `className` unchanged
    - Removing the optional prop makes `tsc -b` enumerate the call sites for task 7.2
    - _Requirements: 8.4, 14.5_

  - [x] 7.2 Drop the `breadcrumbs` prop from the seven call sites that pass it
    - `src/components/form/Category.tsx:158`, `src/pages/OrderPage/orderpage.tsx:137`, `src/pages/Products/products.tsx:344`, `src/pages/Reports/DamageReport.tsx:240`, `src/pages/Reports/InventoryReport.tsx:562`, `src/pages/Reports/SalesReport.tsx:457`, `src/pages/Transactions/TransactionHistory.tsx:191`
    - `src/pages/Dashboard/Home.tsx` passes no `breadcrumbs` and needs no change here
    - Change nothing else on these pages: `PageMeta`, `eyebrow`, `title`, `description` and `actions` all stay
    - Verify `grep -rn "breadcrumbs" src` returns nothing
    - _Requirements: 8.4, 14.5_

  - [x] 7.3 Remove the `New sale` action from `FE/src/pages/Dashboard/Home.tsx`
    - Delete the `<Link to="/orderpage"><Button …>New sale</Button></Link>` block from the `PageHeader` `actions` prop, so the header's quick action is the only `New sale` on the screen
    - Keep the date/time block and the `Refresh` button; keep the `Open POS terminal` tile in the quick-actions grid
    - Drop any import left unused by the deletion so no new lint error appears
    - _Requirements: 7.2, 14.5, 14.9_

- [ ] 8. Static verification sweep
  - `npx tsc -b` and `npm run build` from `FE/` — no new errors or warnings
  - `npx eslint .` — compare the total against the recorded pre-work baseline of **80 errors / 27 warnings**; the count must not rise. The pre-existing `@typescript-eslint/no-explicit-any` errors sit in files this spec does not touch and stay as they are
  - `grep -rn "breadcrumbs" src` → nothing
  - `grep -n "<path" src/layout/AppHeader.tsx` → nothing
  - `grep -rn "fill-black\|dark:fill-gray-900" src/layout src/components/shell` → nothing
  - `grep -rnE "#[0-9a-fA-F]{3,8}|rgb\(|hsl\(" src/layout src/components/shell src/lib/shellTokens.ts` → nothing
  - `grep -rn ": any\|as any\|<any" src/layout src/components/shell src/lib/navigation.ts src/context/SidebarContext.tsx` → nothing
  - `grep -rn "isHovered\|activeItem\|openSubmenu\|toggleSubmenu" src` → nothing
  - `wc -l src/layout/*.tsx src/components/shell/*.tsx src/context/SidebarContext.tsx src/lib/navigation.ts` → every file under 150
  - `git diff --stat -- src/App.tsx` → empty
  - _Requirements: 4.3, 4.7, 6.3, 8.4, 11.2, 11.5, 13.2, 13.4, 14.6, 14.7, 14.8, 14.9_

- [ ] 9. Manual verification checklist — **human-performed, in a browser**
  - Not automatable by a coding agent: contrast ratios, layout shift, focus behaviour and the responsive sweep all need a real rendering engine and a human eye. Work through the "Manual checklist" section of `design.md` in full, in **both light and dark themes**:
    - Sidebar states: toggle, reload persistence with no flash, cleared and corrupt storage keys, group order and dividers, icon colour and size parity in dark mode including Damage Report, collapsed tooltips on hover **and** focus, active-item cues, `/nope` renders nothing active
    - Drawer at 375px: overlay with backdrop, no content shift, Escape closes with focus returning to the toggle, backdrop click closes, background does not scroll, `Tab` wraps inside the drawer
    - Header: breadcrumb labels match the sidebar on all nine routes including `/profile`; degradation order verified at 1400 → 1100 → 900 → 700 → 320px; one row at 320px; sticky without covering content; `New sale` present once on `/dashboard` and absent on `/orderpage`; no application-menu control; ≥40×40 targets below 1024px
    - Search: `Tab` reaches the trigger, `Ctrl K` visible at ≥1024px, `Ctrl`/`Cmd`+`K` opens with focus in the input, ignored while typing in the `/products` filter, `Escape` restores focus to the trigger, `Tab` out closes rather than traps, and on `/orderpage` `/` still focuses the page filter from the body while typing `/` inside the open surface leaves that filter untouched
    - Theme and motion: theme toggle recolours both bars with no reload and no white stripe; axe or devtools contrast passes in both themes; pointer sweep over the rail causes no movement; focus rings visible everywhere; OS reduced motion makes state changes instant
    - Keyboard and landmarks: `Tab` alone reaches all nine destinations plus toggle, search, notifications and user menu; tab order matches visual order; one `banner`, a named main `navigation`, and a `navigation` named `Breadcrumb`
    - Layout sweep at 320/375/640/768/1024/1440/1920/2560px in every rail state: no horizontal page scrollbar, no rail/content overlap
    - No regression: nine destinations render; fresh login shows `AppBootstrapSkeleton` before the page; a low-stock alert navigates to `/products` with the product highlighted; logout clears cached data and returns to sign-in; all eight screens keep their document title, exactly one `h1`, and working action buttons
  - _Requirements: 1.4, 1.8, 1.9, 1.10, 1.11, 1.12, 2.4, 3.2, 3.4, 4.2, 4.4, 4.6, 5.2, 5.3, 5.6, 6.5, 6.6, 7.4, 7.5, 7.6, 7.8, 8.5, 9.2, 9.3, 9.5, 9.6, 9.7, 9.12, 10.4, 10.5, 10.7, 12.1, 12.2, 12.4, 12.6, 12.7, 12.8, 14.1, 14.2, 14.3, 14.4, 14.5_

## Notes

- No property-based test tasks appear here. `design.md` evaluates the one legitimate candidate — `resolveBreadcrumbs` totality over arbitrary pathnames — and concludes that a nine-row registry plus one unregistered case is exhaustive over the behaviour space, and that the repository has no test runner to host either style of test. The Command_Palette follow-up inherits the genuine property (query → results filtering).
- No task is marked optional. Every task either changes shell behaviour a requirement names, or is the verification that proves it.
- Task 2.1 is deliberately large: the `isHovered` removal breaks four files at once, so context and consumers move together to keep the tree compiling.
- Task 7.1 before 7.2 is intentional — removing the optional prop makes `tsc -b` list the remaining work.
- `FE/src/App.tsx`, `FE/src/icons/index.ts`, `FE/src/index.css`, `NotificationDropdown` and `UserDropdown` are not modified by any task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "3.1", "5.1", "5.2", "5.5"] },
    { "id": 4, "tasks": ["3.2", "5.3", "5.4"] },
    { "id": 5, "tasks": ["3.3", "5.6"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3"] }
  ]
}
```
