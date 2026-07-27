/**
 * Shared shell values, declared once and referenced by every shell component
 * so no literal is repeated across files (Requirement 11.6).
 *
 * Class strings live in a `.ts` file under `src/`, which Tailwind's content
 * glob covers, so the JIT compiler sees them.
 */

/** Icon_Size_Token — every Nav_Item icon and every header icon-button glyph. */
export const SHELL_ICON_CLASS = 'h-5 w-5 shrink-0';
export const SHELL_ICON_STROKE = 1.75;

/** Rail widths: 280px expanded, 80px collapsed. */
export const RAIL_WIDTH_EXPANDED = 'w-[280px]';
export const RAIL_WIDTH_COLLAPSED = 'w-[80px]';

/** Matching content-region offsets for each rail state. */
export const CONTENT_OFFSET_EXPANDED = 'ml-[280px]';
export const CONTENT_OFFSET_COLLAPSED = 'ml-[80px]';
export const CONTENT_OFFSET_NONE = 'ml-0';

/**
 * Requirement 5.4: 300ms ceiling — 200ms here.
 *
 * Properties are enumerated individually rather than transitioning every
 * property at once (Requirement 5.5).
 * `width` is deliberately absent, so a rail width change snaps; the visible
 * motion is the `transform` on the drawer and the `margin` on the content
 * region. `motion-reduce:transition-none` is baked in so no component can
 * forget the `prefers-reduced-motion` path (Requirement 5.6).
 */
export const SHELL_TRANSITION =
  'transition-[margin,transform,opacity,background-color,border-color,color] duration-200 ease-out motion-reduce:transition-none';

/** Hover/focus colour changes only, 150ms, same reduced-motion path. */
export const SHELL_COLOR_TRANSITION =
  'transition-colors duration-150 motion-reduce:transition-none';

export const SIDEBAR_STORAGE_KEY = 'pos.shell.sidebarExpanded';
