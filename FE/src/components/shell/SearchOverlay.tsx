import { useRef, useState, type FocusEvent, type KeyboardEvent } from "react";

import SearchInput from "../ui/input/SearchInput";
import Portal from "../ui/portal/Portal";
import { cn } from "../../lib/utils";

/**
 * The global search surface.
 *
 * Props are `open` and `onClose` only. Everything else — the `Cmd`/`Ctrl`+`K`
 * binding, the open/close state and focus restoration to the trigger — lives in
 * `useSearchSurface`, so replacing the body below with the Command_Palette
 * touches neither `SearchTrigger`, the hook, nor `AppHeader`.
 *
 * Requirements: 9.4 (focus lands in the input on open), 9.6 (no focus trap —
 * `Tab` out closes rather than being discarded), 9.12 (the deferred-search
 * message), 11.2, 11.3 (renders the existing `SearchInput`; defines no
 * replacement input primitive), 11.5.
 */
export type SearchOverlayProps = {
  /** True while the surface is on screen. */
  open: boolean;
  /** Closes the surface. `useSearchSurface` restores focus to the trigger. */
  onClose: () => void;
};

/** Scrim above the header (`z-30`) and the sidebar (`z-50`). */
const SCRIM = "fixed inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm";

const PANEL = cn(
  "absolute left-1/2 top-24 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2",
  "rounded-xl border border-gray-200 bg-white p-4 shadow-lg",
  "dark:border-gray-800 dark:bg-gray-900"
);

/**
 * ---------------------------------------------------------------------------
 * Panel body — the Command_Palette's future home.
 *
 * D2 resolved to option B (deferred), so this is the placeholder stated by
 * Requirement 9.12. When the palette lands it replaces **this component only**;
 * the scrim, the panel, the `Escape` handling and the focus-out behaviour below
 * are surface concerns and stay as they are.
 * ---------------------------------------------------------------------------
 */
const SearchPlaceholderBody = () => {
  // Local to the body: unmounting on close resets the query, and the palette
  // will own its own query state the same way.
  const [value, setValue] = useState("");

  return (
    <>
      {/* Requirement 9.4 — `autoFocus` puts keyboard focus in the input as the
          surface mounts. Requirement 11.3 — this is the existing
          `components/ui/input/SearchInput`, not a shell-local copy of it. */}
      <SearchInput
        value={value}
        onChange={setValue}
        autoFocus
        placeholder="Search…"
        aria-label="Search"
      />
      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
        Search is not yet available. Use the sidebar to navigate.
      </p>
    </>
  );
};

const SearchOverlay = ({ open, onClose }: SearchOverlayProps) => {
  const panelRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  // Requirement 9.5 — the panel only reports the intent; `useSearchSurface`
  // does the focus restoration.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose();
  };

  /**
   * Requirement 9.6 — no focus trap.
   *
   * React's `onBlur` is the native bubbling `focusout`, so this fires for any
   * control inside the panel. When focus is heading somewhere outside the panel
   * — `event.relatedTarget` is either null or not a descendant — the surface
   * closes and gets out of the way. `preventDefault` is deliberately **not**
   * called, so the `Tab` keypress still lands on whatever comes next instead of
   * being swallowed or bounced back inside.
   *
   * This is the deliberate opposite of `useDrawerA11y`'s containment: the
   * drawer is a modal overlay over the page, this placeholder is not. The two
   * are not unified for that reason.
   */
  const handleFocusOut = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    const panel = panelRef.current;
    if (!panel) return;
    if (next instanceof Node && panel.contains(next)) return;
    onClose();
  };

  return (
    <Portal>
      <div className={SCRIM}>
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Search"
          // Intentional and load-bearing: this surface does not trap focus, so
          // claiming modality would mislead a screen reader.
          aria-modal="false"
          className={PANEL}
          onKeyDown={handleKeyDown}
          onBlur={handleFocusOut}
        >
          <SearchPlaceholderBody />
        </div>
      </div>
    </Portal>
  );
};

export default SearchOverlay;
