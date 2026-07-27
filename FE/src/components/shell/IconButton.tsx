import type { ReactNode, RefObject } from "react";
import { cn } from "../../lib/utils";
import { SHELL_COLOR_TRANSITION } from "../../lib/shellTokens";

/**
 * The one icon-only control for the shell (Requirement 11.1).
 *
 * Not a replacement for `components/ui/button/Button`: that is a labelled
 * action sized by padding, this is a fixed-square icon control. No variants
 * are re-implemented here (Requirement 11.3).
 */
export type IconButtonProps = {
  /** Becomes `aria-label` — the glyph is decorative, so the name lives here. */
  label: string;
  /** The glyph. Supplied by the caller so this file contains no inline SVG. */
  children: ReactNode;
  onClick: () => void;
  /**
   * Forwarded to the underlying `button`, so a caller can move focus back to
   * this control — the shell's drawer returns focus to the header toggle this
   * way (Requirement 1.9). A plain prop rather than `forwardRef`: the runtime
   * is React 18, where `ref` is not yet an ordinary function-component prop.
   */
  buttonRef?: RefObject<HTMLButtonElement | null>;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  className?: string;
};

/**
 * Fixed 40×40 hit area below `lg`, 44×44 at `lg` and up, so Requirement 10.7
 * holds by construction rather than by inspection.
 */
const HIT_AREA = "h-10 w-10 lg:h-11 lg:w-11";

/** Shared hover token, both themes (Requirements 5.1, 6.1). */
const HOVER = "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/[0.06] dark:hover:text-white";

/**
 * Shared focus-visible ring, both themes. `brand-500` on white and
 * `brand-400` on `gray-900` each clear 3:1 against the adjacent background
 * (Requirement 5.3).
 */
const FOCUS_RING = cn(
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  "focus-visible:ring-brand-500 focus-visible:ring-offset-white",
  "dark:focus-visible:ring-brand-400 dark:focus-visible:ring-offset-gray-900"
);

const IconButton: React.FC<IconButtonProps> = ({
  label,
  children,
  onClick,
  buttonRef,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  className,
}) => (
  <button
    ref={buttonRef}
    type="button"
    aria-label={label}
    aria-expanded={ariaExpanded}
    aria-controls={ariaControls}
    onClick={onClick}
    className={cn(
      "inline-flex shrink-0 items-center justify-center rounded-lg",
      HIT_AREA,
      "text-gray-500 dark:text-gray-400",
      HOVER,
      FOCUS_RING,
      SHELL_COLOR_TRANSITION,
      className
    )}
  >
    {children}
  </button>
);

export default IconButton;
