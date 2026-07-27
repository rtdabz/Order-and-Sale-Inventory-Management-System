import { NavLink, useLocation } from "react-router";

import type { RouteEntry } from "../../lib/navigation";
import {
  SHELL_COLOR_TRANSITION,
  SHELL_ICON_CLASS,
  SHELL_ICON_STROKE,
} from "../../lib/shellTokens";
import { cn } from "../../lib/utils";

export type NavItemProps = {
  entry: RouteEntry;
  /** False in the collapsed rail: the text is hidden and a tooltip stands in. */
  showLabel: boolean;
};

/**
 * Shared focus-visible ring, both themes (Requirements 5.3, 6.1).
 * `brand-500` on white and `brand-400` on `gray-900` each clear 3:1.
 */
const FOCUS_RING = cn(
  "outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  "focus-visible:ring-brand-500 focus-visible:ring-offset-white",
  "dark:focus-visible:ring-brand-400 dark:focus-visible:ring-offset-gray-900"
);

/**
 * Hover changes colour only — no size, padding or position change, so nothing
 * moves under the cursor (Requirements 5.1, 5.2).
 */
const IDLE = cn(
  "text-gray-300",
  "hover:bg-white/[0.06] hover:text-white"
);

/**
 * Four simultaneous active cues (Requirements 3.2, 3.4): background fill,
 * the 3px accent bar rendered below, brand text on label *and* icon, and
 * `font-semibold`.
 */
const ACTIVE = cn(
  "bg-brand-400/10 font-semibold text-brand-300"
);

/** The non-colour cue that survives the collapsed rail: a shape at a position. */
const ACCENT_BAR = "absolute left-0 h-5 w-[3px] rounded-r-full bg-brand-400";

/**
 * CSS-only tooltip for the collapsed rail (Requirement 4.6). Shown on pointer
 * hover *and* keyboard focus, which a `title` attribute would not deliver.
 * `aria-hidden` because the anchor already carries `aria-label` — announcing
 * both would double up in a screen reader.
 */
const TOOLTIP = cn(
  "pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md",
  "px-2 py-1 text-xs font-medium opacity-0",
  "bg-gray-900 text-white dark:bg-gray-700 dark:text-gray-50",
  "group-hover:opacity-100 group-focus-visible:opacity-100"
);

/**
 * One nav destination.
 *
 * Active is derived from the current pathname during render and never stored
 * in state, so there is no intermediate commit where two items look active
 * (Requirement 3.6) and an unregistered route leaves every item inactive
 * (Requirement 3.5).
 *
 * Renders the anchor only — `NavGroup` owns the `ul`/`li` structure, so the
 * list markup stays valid with one wrapper per item.
 */
const NavItem: React.FC<NavItemProps> = ({ entry, showLabel }) => {
  const { pathname } = useLocation();
  const isActive = pathname === entry.path;
  const Icon = entry.icon;

  return (
    <NavLink
      to={entry.path}
      aria-current={isActive ? "page" : undefined}
      aria-label={showLabel ? undefined : entry.label}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm transition-all duration-200",
        showLabel ? "justify-start" : "justify-center",
        isActive ? ACTIVE : IDLE,
        FOCUS_RING,
        SHELL_COLOR_TRANSITION
      )}
    >
      {isActive && <span aria-hidden="true" className={ACCENT_BAR} />}
      <Icon
        className={SHELL_ICON_CLASS}
        strokeWidth={SHELL_ICON_STROKE}
        aria-hidden="true"
      />
      {showLabel && <span className="truncate">{entry.label}</span>}
      {!showLabel && (
        <span aria-hidden="true" className={TOOLTIP}>
          {entry.label}
        </span>
      )}
    </NavLink>
  );
};

export default NavItem;
