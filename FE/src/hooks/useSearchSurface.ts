import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * Open/close state for the global search surface, its one global keyboard
 * binding, and focus restoration back to the trigger.
 *
 * The surface's body is a placeholder today and becomes the Command_Palette
 * later; keeping the binding and the focus handling here means that swap does
 * not touch `SearchTrigger`, `SearchOverlay` or `AppHeader`.
 *
 * Requirements: 9.3 (`Ctrl`/`Cmd`+`K` outside a text input opens the surface),
 * 9.5 (`Escape` closes and focus returns to the trigger), 9.7 (`/` is never
 * bound, so `orderpage.tsx` stays the sole handler of its product-filter
 * hotkey).
 */
export type UseSearchSurface = {
  /** True while the search surface is on screen. */
  open: boolean;
  /** Opens the surface. Wired to the Search_Trigger's `onClick`. */
  openSurface: () => void;
  /** Closes the surface and returns focus to the Search_Trigger. */
  closeSurface: () => void;
  /** Attach to the Search_Trigger button so focus can be restored to it. */
  triggerRef: RefObject<HTMLButtonElement | null>;
};

/**
 * True when the keypress originated inside something the user is typing in.
 * `Cmd`/`Ctrl`+`K` is ignored there, so a page filter keeps the keystroke
 * (Requirement 9.3 — "outside a text input").
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function useSearchSurface(): UseSearchSurface {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openSurface = useCallback(() => setOpen(true), []);

  // Requirement 9.5 — focus restoration lives in the hook, not in the surface,
  // so it survives the placeholder body being replaced by the palette.
  const closeSurface = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Requirement 9.3 — one `keydown` listener, matching only `k` with a
  // modifier. Requirement 9.7 — no `/` binding, and no other key, so the
  // `/orderpage` product-filter hotkey is never double-handled.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "k") return;
      if (isTypingTarget(event.target)) return;

      event.preventDefault();
      setOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { open, openSurface, closeSurface, triggerRef };
}

export default useSearchSurface;
