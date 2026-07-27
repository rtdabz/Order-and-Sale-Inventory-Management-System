import type { RefObject } from "react";
import { Search } from "lucide-react";

import { SHELL_COLOR_TRANSITION, SHELL_ICON_CLASS, SHELL_ICON_STROKE } from "../../lib/shellTokens";
import { cn } from "../../lib/utils";

/**
 * The Header's entry point to the global search surface (Requirement 9.1).
 *
 * A `button` styled to read as a field — deliberately **not** an `input`.
 * That is what keeps Requirement 11.3 true: the shell defines no replacement
 * search input, because the real `components/ui/input/SearchInput` is rendered
 * by the surface this trigger opens.
 */
export type SearchTriggerProps = {
  /** Opens the search surface. Supplied by `useSearchSurface`. */
  onOpen: () => void;
  /**
   * Attached to the button so the surface can restore focus here on close
   * (Requirement 9.5). Nullable because `useRef<HTMLButtonElement>(null)`
   * yields `RefObject<HTMLButtonElement | null>` under React 19 types.
   */
  triggerRef: RefObject<HTMLButtonElement | null>;
};

/**
 * 40×40 minimum at every width (Requirement 10.7): `h-10 w-10` is the whole
 * box in the icon-only form below `lg`. From `lg` the height stays at 40px and
 * only the width opens up (`lg:w-auto` plus padding) to seat the label and the
 * shortcut hint, so the target never shrinks below the minimum.
 */
const HIT_AREA = "h-10 w-10 justify-center lg:w-auto lg:justify-start lg:pl-3 lg:pr-2";

/** Field-like surface, both themes (Requirements 6.1, 6.2). */
const SURFACE = cn(
  "bg-white text-gray-500 lg:border lg:border-gray-200 lg:bg-gray-50",
  "dark:bg-transparent dark:text-gray-400 lg:dark:border-gray-800 lg:dark:bg-white/[0.03]"
);

/** Hover changes colour only — nothing moves under the cursor (Requirements 5.1, 5.2). */
const HOVER = cn(
  "hover:bg-gray-100 hover:text-gray-900",
  "dark:hover:bg-white/[0.06] dark:hover:text-white"
);

/**
 * Shared focus-visible ring, both themes (Requirement 5.3). `brand-500` on
 * white and `brand-400` on `gray-900` each clear 3:1 against their background.
 */
const FOCUS_RING = cn(
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  "focus-visible:ring-brand-500 focus-visible:ring-offset-white",
  "dark:focus-visible:ring-brand-400 dark:focus-visible:ring-offset-gray-900"
);

/**
 * The shortcut as **visible text** at and above `lg` (Requirement 9.2).
 * `aria-keyshortcuts` on the button announces the same thing to assistive
 * tech, but an attribute alone would not satisfy the criterion.
 */
const KBD = cn(
  "hidden items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium lg:inline-flex",
  "border-gray-200 bg-white text-gray-500",
  "dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
);

/**
 * Icon-only below `lg` — degradation step 2 in the header order
 * (Requirements 7.4, 10.1). The label and the shortcut hint are the parts that
 * drop; the control itself carries no responsive visibility class, so it is
 * present at every width from 320px upward.
 */
const SearchTrigger: React.FC<SearchTriggerProps> = ({ onOpen, triggerRef }) => (
  <button
    ref={triggerRef}
    type="button"
    onClick={onOpen}
    aria-label="Search"
    aria-keyshortcuts="Control+K"
    className={cn(
      "inline-flex shrink-0 items-center gap-2 rounded-lg text-sm",
      HIT_AREA,
      SURFACE,
      HOVER,
      FOCUS_RING,
      SHELL_COLOR_TRANSITION
    )}
  >
    <Search className={SHELL_ICON_CLASS} strokeWidth={SHELL_ICON_STROKE} aria-hidden="true" />
    <span className="hidden lg:inline lg:w-32 lg:text-left">Search…</span>
    <kbd className={KBD}>Ctrl K</kbd>
  </button>
);

export default SearchTrigger;
