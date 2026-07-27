# Requirements: POS shell redesign

## Introduction

This spec covers the authenticated application shell only: `FE/src/layout/AppSidebar.tsx`, `FE/src/layout/AppHeader.tsx`, `FE/src/layout/Backdrop.tsx`, `FE/src/layout/AppLayout.tsx` and `FE/src/context/SidebarContext.tsx`. The goal is a modern, cohesive POS shell: clearer navigation hierarchy, a predictable collapsible sidebar, a header that carries page context and global concerns, one shared design system for spacing, type, icons and motion, and small reusable components instead of two monolithic files.

Current state, verified against the code:

- **Sidebar has no dark mode.** It hardcodes `bg-white`, `text-gray-900`, `border-gray-200`. Every other surface in the app ships `dark:` variants, so the rail is the one light-only region in a dark theme.
- **Two competing collapse mechanisms.** Width is `90px` collapsed / `290px` expanded, and `onMouseEnter` also expands it. `AppLayout` keys its `lg:ml-[290px] / lg:ml-[90px]` margin off `isExpanded || isHovered`, so page content shifts whenever the pointer crosses the rail.
- **Collapsed state is unlabelled and unpersisted.** Group headings degrade to a `HorizontaLDots` glyph, nav items show icon only with no tooltip, and `isExpanded` is component state that resets to `true` on reload.
- **Weak active state.** Active is the `menu-item-active` utility class only, with no accent bar and no `aria-current`.
- **Inconsistent icons.** Icons come from the local `../icons` barrel (`GridIcon`, `OrderIcon`, `HistoryIcon`, `ShoppingBasketIcon`, `CategoryIcon`, `ReportIcon`, `InventoryIcon`, `DamageIcon`) with no shared size token, and Damage Report needs a per-item `[&_svg]:fill-black [&_svg]:dark:fill-gray-900` override.
- **Header is nearly empty.** It has the sidebar toggle, a mobile-only logo, a mobile "application menu" toggle, `NotificationDropdown` and `UserDropdown`. No page title, no breadcrumbs, no global search, no quick actions. The hamburger and dots glyphs are inline hand-written SVGs.
- **Dead context members.** `activeItem`, `openSubmenu`, `setActiveItem` and `toggleSubmenu` on `SidebarContext` have no consumer since the nav was flattened.
- **Page context already lives in the pages.** All eight shell screens (`Home.tsx`, `orderpage.tsx`, `products.tsx`, `TransactionHistory.tsx`, `SalesReport.tsx`, `InventoryReport.tsx`, `DamageReport.tsx`, `components/form/Category.tsx`) render `PageHeader` with `eyebrow`, `title`, `description`, a hand-written `breadcrumbs` array that always starts `{ label: 'Home', to: '/dashboard' }`, and page-specific `actions`. This conflicts head-on with moving title and breadcrumbs into the header.
- **No global search exists.** Each page owns a local `SearchInput` bound to its own filter (`products.tsx`, `TransactionHistory.tsx`, `orderpage.tsx` which also binds a `/` hotkey, `DamageReport.tsx`). There is no shared search surface to promote.

Out of scope: the route map in `App.tsx` (the nine authenticated destinations stay as they are), page bodies, data fetching, and the receipt/toast work tracked in a separate spec. `PageHeader` and its call sites are touched only to the extent decision **D1** requires.

Reuse rather than reinvent: `NotificationDropdown` (low-stock/out-of-stock alerts that drive the `ProductNotificationContext` highlight-then-scroll flow into `/products`), `UserDropdown` (logout, `resetAppData()`), `Backdrop.tsx`, `Button`, `StatusPill`, `SearchInput`, and the existing `brand-*` Tailwind palette.

## Open decisions

Design cannot be committed until all four are answered. Each changes the shape of the shell, not just its styling.

### D1 — Who owns the page title and breadcrumbs?

| Option | What it means | Tradeoff |
| --- | --- | --- |
| A | Header owns title **and** breadcrumbs. `PageHeader` is removed from all eight screens; per-page `actions` are routed up to the header via context or a portal. | Most cohesive and matches the request literally, but touches 11+ files and requires inventing a cross-tree channel for page actions. |
| B | Header owns breadcrumbs plus global concerns. `PageHeader` keeps the in-page H1, description and actions. | Smallest blast radius, keeps exactly one H1 per page, keeps room for descriptions. Only partially delivers "page title in header". |
| C | Header shows a compact current-page label derived from the route registry **and** the breadcrumb trail. `PageHeader` keeps description and actions but drops its own `breadcrumbs` and `title`. | Removes eight duplicated breadcrumb arrays, gives the header real page context, no cross-tree actions channel needed. Requires deciding where the page H1 lives for accessibility. |

**Recommendation: C.** It deletes the duplicated breadcrumb arrays, gives the header the page context the request asks for, and avoids building a portal for page actions. Whichever option is chosen, breadcrumbs must be derived from one shared route registry rather than hand-written per page.

### D2 — What does global search search?

| Option | What it means | Tradeoff |
| --- | --- | --- |
| A | Header field that focuses or forwards to the current page's existing local filter. | Cheapest, but behaves differently on every route and reads as clutter on routes with no filter. |
| B | Command palette (`Ctrl`/`Cmd`+`K`) over navigation destinations, products by name and transactions by number. Product hits jump to `/products` with the row highlighted through the existing `ProductNotificationContext` flow; transaction hits jump to `/transactions`. | Only option that earns permanent header space. Also the largest single piece of work in this spec. |
| C | Navigation-only palette (jump to a page). | Cheap and predictable, but thin value when there are only nine destinations. |

**Recommendation: B**, scoped to nav destinations plus products by name and transactions by number. Flag: B can be deferred to a follow-up with the header reserving the slot — Requirement 9 is written so its criteria still hold if only the entry point ships.

### D3 — Which quick actions belong in the header?

`Home.tsx` already renders a `New sale` link-button and a `Refresh`, and most other pages render their own `Refresh`, so a header quick action risks putting two identical buttons on screen at once.

Options: a single primary `New sale` always present; a small set (`New sale`, `Add product`); or none, leaving quick actions to pages.

**Recommendation:** a single `New sale`, hidden on `/orderpage` where it is meaningless, and removed from `Home.tsx` so it never appears twice.

### D4 — Keep hover-to-expand?

Options: keep hover-peek as is; drop it so collapse is explicit only; or keep it as an overlay peek that never moves page content.

**Recommendation: drop hover-expand** in favour of an explicit, persisted toggle plus tooltips in the collapsed state. Predictable for a till operator on a mouse for a whole shift, and it removes the layout shift caused by `isHovered` feeding the content margin.

## Glossary

- **App_Shell**: the persistent authenticated chrome rendered by `AppLayout` — Sidebar plus Header — excluding the routed page body.
- **Sidebar**: the left navigation rail (`AppSidebar.tsx` and its successor components).
- **Header**: the top bar (`AppHeader.tsx` and its successor components).
- **Sidebar_Context**: the React context in `FE/src/context/SidebarContext.tsx` holding shell layout state.
- **Route_Registry**: a single exported module mapping each authenticated route path to its label, group and icon, consumed by both Sidebar and Header.
- **Breadcrumb_Trail**: the Header component that renders the ancestor path of the current route from Route_Registry.
- **Search_Trigger**: the Header control that opens the global search surface.
- **Command_Palette**: the overlay search surface described in D2 option B.
- **Nav_Group**: one labelled cluster of nav items — currently `Menu`, `Product Catalog`, `Reports`.
- **Nav_Item**: one link inside a Nav_Group pointing at one authenticated route.
- **Collapsed_State**: Sidebar showing icons only at rail width, on viewports at or above the desktop breakpoint.
- **Expanded_State**: Sidebar showing icons plus text labels and group headings.
- **Drawer_State**: Sidebar rendered as an overlay panel over page content below the mobile breakpoint.
- **Mobile_Breakpoint**: viewport width below 768px.
- **Desktop_Breakpoint**: viewport width at or above 1024px (Tailwind `lg`).
- **Icon_Size_Token**: one shared class or constant defining nav icon dimensions for every Nav_Item.
- **Design_Tokens**: the existing Tailwind `brand-*` palette, grey scale, spacing scale and shadow scale defined in the project's Tailwind config.

## Requirements

### Requirement 1 — Sidebar collapsible state

**User Story:** As a cashier, I want the sidebar to collapse and stay collapsed, so that the terminal keeps as much room as possible for the sale in progress without me re-collapsing it every shift.

#### Acceptance Criteria

1. THE Sidebar SHALL render in exactly one of three states at any time: Expanded_State, Collapsed_State or Drawer_State.
2. WHEN the user activates the Sidebar toggle at or above Desktop_Breakpoint, THEN THE Sidebar SHALL switch between Expanded_State and Collapsed_State.
3. WHEN the Sidebar state changes, THEN THE App_Shell SHALL persist the new state to browser local storage under a single named key.
4. WHEN the application loads and a persisted Sidebar state exists, THEN THE Sidebar SHALL restore that state before first paint of the routed page.
5. IF no persisted Sidebar state exists, THEN THE Sidebar SHALL default to Expanded_State at or above Desktop_Breakpoint.
6. THE Sidebar toggle SHALL be a `button` element reachable by `Tab`, operable by `Enter` and `Space`, and SHALL expose `aria-expanded` reflecting whether the Sidebar is in Expanded_State.
7. THE Sidebar toggle SHALL expose an accessible name that names the target action.
8. WHILE the viewport is below Mobile_Breakpoint, THE Sidebar SHALL render in Drawer_State over page content with a backdrop covering the remaining viewport.
9. WHEN the user presses `Escape` while the Sidebar is in Drawer_State, THEN THE Sidebar SHALL close and return keyboard focus to the control that opened it.
10. WHEN the user activates the backdrop while the Sidebar is in Drawer_State, THEN THE Sidebar SHALL close.
11. WHILE the Sidebar is in Drawer_State, THE App_Shell SHALL prevent scrolling of the content behind the drawer.
12. WHEN the Sidebar enters Collapsed_State or Expanded_State, THEN THE App_Shell SHALL reflow the page content region to start at the Sidebar's outer edge with no overlap and no horizontal page scrollbar at any viewport width from 320px to 2560px.
13. WHILE the Sidebar is in Drawer_State, THE App_Shell SHALL leave the page content region's horizontal offset unchanged.

### Requirement 2 — Navigation structure and hierarchy

**User Story:** As a shop owner, I want navigation grouped the way I think about the business, so that I can find any screen without reading every label.

#### Acceptance Criteria

1. THE Sidebar SHALL render three Nav_Groups in this order with these labels: `Menu`, `Product Catalog`, `Reports`.
2. THE Sidebar SHALL render these Nav_Items in these groups: `Menu` → Dashboard `/dashboard`, POS Terminal `/orderpage`, Transactions `/transactions`; `Product Catalog` → Products `/products`, Categories `/category`; `Reports` → Sales Report `/reports/sales`, Inventory Report `/inventory`, Damage Report `/reports/damage`.
3. WHILE the Sidebar is in Expanded_State or Drawer_State, THE Sidebar SHALL render each Nav_Group label as visible text.
4. WHILE the Sidebar is in Collapsed_State, THE Sidebar SHALL separate Nav_Groups by a visible divider or spacing step rather than a placeholder glyph, and SHALL keep each group's items contiguous in DOM order.
5. THE Sidebar SHALL distinguish Nav_Group labels from Nav_Item labels using at least two of: font size, font weight, letter spacing, colour.
6. THE Sidebar SHALL express grouping through spacing and type scale drawn from Design_Tokens, and SHALL NOT add per-group border boxes or card backgrounds around Nav_Groups.
7. WHEN the user activates any Nav_Item, THEN THE App_Shell SHALL navigate to that Nav_Item's path without a full page reload.
8. THE Sidebar SHALL render a brand lockup linking to `/dashboard` in all three states.

### Requirement 3 — Active state

**User Story:** As a cashier, I want to see at a glance which screen I am on, so that I do not lose my place mid-transaction.

#### Acceptance Criteria

1. WHEN the current route path matches a Nav_Item path, THEN THE Sidebar SHALL mark that Nav_Item as active and SHALL mark every other Nav_Item as inactive.
2. THE active Nav_Item SHALL be distinguished by at least two simultaneous cues from: background fill, accent bar, icon colour, label font weight.
3. THE active Nav_Item's anchor SHALL carry `aria-current="page"`.
4. WHILE the Sidebar is in Collapsed_State, THE active Nav_Item SHALL remain distinguishable by at least one non-colour cue that is visible without the text label.
5. IF the current route matches no Nav_Item path, THEN THE Sidebar SHALL render every Nav_Item as inactive.
6. WHEN navigation completes, THEN THE Sidebar SHALL update the active Nav_Item within the same render pass as the route change, with no interim state where two items appear active.

### Requirement 4 — Icon consistency

**User Story:** As a shop owner, I want the navigation icons to look like one set, so that the terminal reads as a finished product.

#### Acceptance Criteria

1. THE Sidebar SHALL size every Nav_Item icon using one shared Icon_Size_Token.
2. THE Sidebar SHALL apply the same colour treatment rule to every Nav_Item icon, derived only from active/inactive/hover state.
3. THE Sidebar SHALL contain no per-item icon colour override, including the current `[&_svg]:fill-black [&_svg]:dark:fill-gray-900` override on Damage Report.
4. THE Sidebar SHALL use icon assets that share one rendering treatment, so that a single `currentColor`-based rule colours every Nav_Item icon correctly in both themes.
5. WHILE a Nav_Item's text label is hidden, THE Sidebar SHALL expose that Nav_Item's name to assistive technology via an accessible name on the anchor.
6. WHILE the Sidebar is in Collapsed_State, WHEN the pointer rests on a Nav_Item or the Nav_Item receives keyboard focus, THEN THE Sidebar SHALL display a tooltip containing that Nav_Item's name.
7. THE Header SHALL render its icon-only controls through one shared icon-button component with a single size and hit-area rule, and SHALL NOT contain inline hand-written SVG path markup for the sidebar toggle or the mobile menu control.

### Requirement 5 — Hover, focus and motion

**User Story:** As a cashier, I want controls to respond immediately and predictably, so that nothing jumps under the cursor while I am working fast.

#### Acceptance Criteria

1. WHEN the pointer enters an interactive Sidebar or Header control, THEN THE App_Shell SHALL apply a hover treatment that changes background or foreground colour only.
2. WHEN the pointer enters or leaves any Sidebar or Header control, THEN THE App_Shell SHALL leave the widths, heights, margins and positions of all shell elements unchanged.
3. WHEN any interactive Sidebar or Header element receives keyboard focus, THEN THE App_Shell SHALL render a `focus-visible` outline or ring with a minimum contrast ratio of 3:1 against the adjacent background in both light and dark themes.
4. THE App_Shell SHALL limit shell transition durations to 300ms or less.
5. THE App_Shell SHALL animate only `transform`, `opacity`, `color`, `background-color` and `border-color` on shell elements.
6. WHILE the operating system reports `prefers-reduced-motion: reduce`, THE App_Shell SHALL complete all shell state changes with no transition or animation.
7. WHERE decision D4 resolves to dropping hover-expand, THE Sidebar SHALL change width only in response to the toggle, a route-independent state restore, or a breakpoint change.

### Requirement 6 — Theming and branding

**User Story:** As a shop owner, I want the whole terminal to follow one theme, so that switching to dark mode does not leave a white stripe down the left.

#### Acceptance Criteria

1. THE Sidebar SHALL define a `dark:` variant for every background, text, border and icon colour it sets.
2. THE Header SHALL define a `dark:` variant for every background, text, border and icon colour it sets.
3. THE App_Shell SHALL source all shell colours from Design_Tokens and SHALL contain no literal hex, `rgb()` or `hsl()` colour values in shell component files.
4. THE App_Shell SHALL render the same brand lockup component in the Sidebar and in the Header's mobile region, with logo asset, corner radius and wordmark type identical between the two.
5. WHILE the dark theme is active, THE App_Shell SHALL render shell body text at a minimum contrast ratio of 4.5:1 and shell icons and borders at a minimum of 3:1 against their backgrounds.
6. WHEN the theme changes, THEN THE App_Shell SHALL update Sidebar and Header colours without a page reload.

### Requirement 7 — Header layout

**User Story:** As a cashier, I want one clean top bar that tells me where I am and gives me the few things I actually need, so that I am not hunting through clutter.

#### Acceptance Criteria

1. THE Header SHALL render as a single sticky bar pinned to the top of the content region, above page content in stacking order.
2. THE Header SHALL render, in this left-to-right order: Sidebar toggle, page context (per D1), Search_Trigger, quick actions (per D3), notifications, user menu.
3. THE Header SHALL contain no controls other than those listed in criterion 2 and the mobile brand lockup.
4. WHEN available width falls below the width needed for all Header regions, THEN THE Header SHALL degrade in this order: first collapse quick actions to icon-only, then reduce the Search_Trigger to an icon-only control, then truncate the page context to the current-page label alone, and SHALL keep the Sidebar toggle, notifications and user menu visible at every width from 320px upward.
5. THE Header SHALL preserve the existing `NotificationDropdown` behaviour, including its low-stock and out-of-stock alert list and the `ProductNotificationContext` highlight-then-scroll navigation into `/products`.
6. THE Header SHALL preserve the existing `UserDropdown` behaviour, including logout and its `resetAppData()` cache reset.
7. THE Header SHALL wrap its content in a `header` element exposing the `banner` landmark role.
8. WHEN the page content region is scrolled, THEN THE Header SHALL remain visible and SHALL NOT overlap the first row of page content.

### Requirement 8 — Breadcrumbs from a shared route registry

**User Story:** As a shop owner, I want breadcrumbs that always match the menu, so that a renamed screen is renamed everywhere at once.

#### Acceptance Criteria

1. THE App_Shell SHALL define Route_Registry as one exported module containing, for each authenticated route, its path, display label, owning Nav_Group and icon.
2. THE Sidebar SHALL derive every Nav_Item label and icon from Route_Registry.
3. THE Breadcrumb_Trail SHALL derive every crumb label and link target from Route_Registry.
4. THE App_Shell SHALL contain no hand-written breadcrumb array in any page or component file outside Route_Registry.
5. WHEN the current route resolves in Route_Registry, THEN THE Breadcrumb_Trail SHALL render `Dashboard` as the first crumb, the owning Nav_Group as an intermediate crumb where the group differs from the current page label, and the current page label as the final crumb.
6. THE Breadcrumb_Trail SHALL render the final crumb as non-interactive text carrying `aria-current="page"` and every preceding crumb as a link.
7. IF the current route is not present in Route_Registry, THEN THE Breadcrumb_Trail SHALL render a single `Dashboard` crumb plus a fallback label for the current route and SHALL NOT throw.
8. THE Breadcrumb_Trail SHALL wrap its list in a `nav` element with the accessible name `Breadcrumb`.

### Requirement 9 — Global search entry point

**User Story:** As a cashier, I want one keyboard-driven way to jump to a screen or a product, so that I stop hunting through the menu mid-shift.

#### Acceptance Criteria

1. THE Header SHALL render a Search_Trigger that is reachable by `Tab` and exposes an accessible name naming the search action.
2. THE Search_Trigger SHALL display its keyboard shortcut as visible text at or above Desktop_Breakpoint.
3. WHEN the user presses `Ctrl`+`K` or `Cmd`+`K` anywhere in the App_Shell outside a text input, THEN THE App_Shell SHALL open the search surface.
4. WHEN the search surface opens, THEN THE App_Shell SHALL move keyboard focus to the search text input.
5. WHEN the user presses `Escape` while the search surface is open, THEN THE App_Shell SHALL close the surface and return focus to the Search_Trigger.
6. WHILE the search surface is open, THE App_Shell SHALL allow `Tab` and `Shift`+`Tab` to reach every control inside the surface and SHALL close the surface rather than discard the keypress when focus would leave it.
7. WHEN the search surface is open, THEN THE App_Shell SHALL leave the existing `/` hotkey on `/orderpage` bound to that page's own product filter and SHALL NOT double-handle the keypress.
8. WHERE decision D2 resolves to a Command_Palette, WHEN the user types two or more characters, THEN THE Command_Palette SHALL list matching navigation destinations, products matched by name and transactions matched by transaction number, each result group labelled.
9. WHERE decision D2 resolves to a Command_Palette, WHEN the user selects a product result, THEN THE App_Shell SHALL navigate to `/products` and highlight that product through the existing `ProductNotificationContext` flow.
10. WHERE decision D2 resolves to a Command_Palette, WHEN the user selects a transaction result, THEN THE App_Shell SHALL navigate to `/transactions` for that transaction.
11. WHERE decision D2 resolves to a Command_Palette, IF a query matches no records, THEN THE Command_Palette SHALL display an empty-state message and SHALL keep the input focused.
12. WHERE the Command_Palette is deferred to a follow-up, THE Search_Trigger SHALL still satisfy criteria 1 through 7 and SHALL open a surface stating that search is not yet available.

### Requirement 10 — Responsive behaviour

**User Story:** As a shop owner, I want the terminal usable on the counter screen and on a tablet in the stockroom, so that I am not locked to one device.

#### Acceptance Criteria

1. WHILE the viewport is below Mobile_Breakpoint, THE Sidebar SHALL use Drawer_State and THE Header SHALL render the brand lockup, Sidebar toggle, an icon-only Search_Trigger, notifications and the user menu on one row.
2. WHILE the viewport is between Mobile_Breakpoint and Desktop_Breakpoint, THE Sidebar SHALL use Collapsed_State by default and THE Header SHALL render page context truncated to the current-page label.
3. WHILE the viewport is at or above Desktop_Breakpoint, THE Sidebar SHALL honour the persisted Expanded_State or Collapsed_State and THE Header SHALL render all regions listed in Requirement 7 criterion 2.
4. THE Header SHALL remain a single row at every viewport width from 320px upward.
5. THE App_Shell SHALL either give the mobile "application menu" toggle a distinct function not otherwise reachable at that width, or remove that control.
6. WHEN the viewport crosses Mobile_Breakpoint or Desktop_Breakpoint, THEN THE App_Shell SHALL apply the target state for the new width without leaving the Sidebar and the content offset disagreeing.
7. THE App_Shell SHALL render every Header and Sidebar interactive control with a minimum touch target of 40px by 40px below Desktop_Breakpoint.

### Requirement 11 — Reusable shell components

**User Story:** As a developer, I want the shell built from small named pieces, so that changing one nav affordance does not mean editing a 200-line file.

#### Acceptance Criteria

1. THE App_Shell SHALL compose the Sidebar and Header from separately exported components covering at least: brand lockup, Nav_Group, Nav_Item, icon button, Breadcrumb_Trail, Search_Trigger and quick actions.
2. THE App_Shell SHALL keep each shell component file under 150 lines.
3. THE App_Shell SHALL render shell buttons through the existing `Button` component and shell text inputs through the existing `SearchInput` component, and SHALL NOT define replacement button or search-input primitives.
4. THE App_Shell SHALL use the existing `StatusPill` component for any count or status badge rendered in the shell.
5. THE App_Shell SHALL define each shell component's props with an explicit TypeScript type and no `any`.
6. THE App_Shell SHALL declare shared shell values — Icon_Size_Token, rail widths, transition duration — once and reference them from every consuming component.

### Requirement 12 — Accessibility

**User Story:** As a cashier who works by keyboard, I want to reach every screen without a mouse, so that I can keep both hands on the till.

#### Acceptance Criteria

1. THE Sidebar SHALL wrap its Nav_Groups in a `nav` element with an accessible name identifying it as the main navigation.
2. THE Header SHALL expose the `banner` landmark role.
3. THE App_Shell SHALL place shell controls in DOM order matching their visual order, so that sequential `Tab` traversal follows the rendered layout.
4. WHEN the user traverses the App_Shell with `Tab` alone, THEN THE App_Shell SHALL make all nine authenticated destinations, the Sidebar toggle, the Search_Trigger, notifications and the user menu reachable.
5. THE App_Shell SHALL give every icon-only control a non-empty accessible name and SHALL mark every decorative SVG `aria-hidden="true"`.
6. THE App_Shell SHALL render shell text at a minimum contrast ratio of 4.5:1 and shell icons, borders and focus rings at a minimum of 3:1 against their backgrounds in both light and dark themes.
7. WHEN the Sidebar is in Drawer_State, THEN THE App_Shell SHALL keep keyboard focus within the drawer until the drawer closes.
8. Full WCAG conformance is not claimed by this spec: the criteria above are checkable at a screen or with automated tooling, and complete validation additionally requires manual testing with assistive technologies and expert accessibility review.

### Requirement 13 — Sidebar context cleanup

**User Story:** As a developer, I want the sidebar context to expose only what the shell uses, so that dead state stops implying features that do not exist.

#### Acceptance Criteria

1. THE Sidebar_Context SHALL expose only members consumed by at least one shell component.
2. THE Sidebar_Context SHALL remove `activeItem`, `openSubmenu`, `setActiveItem` and `toggleSubmenu`, or give each a consumer in the redesigned shell.
3. THE Sidebar_Context SHALL own the persisted Sidebar state required by Requirement 1 and SHALL be the single source of Sidebar state for the Sidebar, Header, Backdrop and content-offset calculation.
4. WHERE decision D4 resolves to dropping hover-expand, THE Sidebar_Context SHALL remove `isHovered` and `setIsHovered`, and `AppLayout` SHALL compute the content offset from the persisted state alone.
5. WHEN a component calls `useSidebar` outside a `SidebarProvider`, THEN THE Sidebar_Context SHALL throw an error naming the missing provider.
6. THE Sidebar_Context SHALL declare its value type explicitly and SHALL contain no unused state variables.

### Requirement 14 — No regression

**User Story:** As a shop owner, I want the redesign to change how the shell looks and feels without changing what works, so that a normal trading day is unaffected.

#### Acceptance Criteria

1. WHEN the user activates each of the nine Nav_Items in turn, THEN THE App_Shell SHALL render the corresponding page: `/dashboard`, `/orderpage`, `/transactions`, `/products`, `/category`, `/reports/sales`, `/inventory`, `/reports/damage`, and `/profile` via the user menu.
2. THE App_Shell SHALL keep the one-time post-login bootstrap behaviour in `AppLayout`, rendering `AppBootstrapSkeleton` and withholding the routed `Outlet` until `bootstrapped` is true.
3. WHEN the user opens a low-stock alert from notifications, THEN THE App_Shell SHALL navigate to `/products` and highlight the referenced product exactly as before the redesign.
4. WHEN the user logs out from the user menu, THEN THE App_Shell SHALL clear cached application data and return to the sign-in route exactly as before the redesign.
5. WHERE decision D1 removes `PageHeader` title or breadcrumb usage from a page, THE App_Shell SHALL keep that page's `PageMeta` document title and its page-specific actions functional.
6. THE App_Shell SHALL leave the routes declared in `App.tsx` unchanged.
7. THE App_Shell SHALL pass the project's TypeScript check with no new errors.
8. THE App_Shell SHALL pass the project's production build with no new errors or warnings.
9. THE App_Shell SHALL pass the project's lint task with no new errors.
