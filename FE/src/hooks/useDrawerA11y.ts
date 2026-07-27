import { useEffect, type RefObject } from "react";

/**
 * Accessibility behaviour for the Sidebar's Drawer_State (and any future modal
 * shell overlay): `Escape` closes and returns focus to the opener, the page
 * behind the drawer cannot scroll, and `Tab`/`Shift+Tab` stay inside the panel.
 *
 * Requirements: 1.9 (Escape closes, focus returns), 1.11 (background scroll
 * lock), 12.7 (focus containment).
 */
export type UseDrawerA11yOptions = {
  /** True while the drawer is on screen. */
  open: boolean;
  /** Called when `Escape` is pressed. */
  onClose: () => void;
  /** The drawer panel. Focusable descendants are cycled within it. */
  containerRef: RefObject<HTMLElement | null>;
  /** The control that opened the drawer; focus returns here on close. */
  returnFocusRef: RefObject<HTMLElement | null>;
};

/**
 * Selector for elements that can hold keyboard focus. Queried at keypress time
 * rather than captured when the drawer opens, because nav content can change
 * while the drawer is open.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(nodes).filter(
    (node) =>
      node.getAttribute("aria-hidden") !== "true" &&
      !node.hasAttribute("inert") &&
      (node.offsetWidth > 0 ||
        node.offsetHeight > 0 ||
        node.getClientRects().length > 0),
  );
}

export function useDrawerA11y({
  open,
  onClose,
  containerRef,
  returnFocusRef,
}: UseDrawerA11yOptions): void {
  // Requirement 1.9 — Escape closes and focus returns to the opener.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
      returnFocusRef.current?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, returnFocusRef]);

  // Requirement 1.11 — lock background scrolling, restoring the value that was
  // there before rather than clearing it, so a page-level modal's own lock
  // (sweetalert2, Radix dialog) is not stomped. The cleanup runs on close and
  // on unmount, so unmounting mid-open cannot leave the page locked.
  useEffect(() => {
    if (!open) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Requirement 12.7 — contain focus: Tab and Shift+Tab wrap at both ends.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        // Nothing to focus inside: keep focus from escaping the drawer.
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      if (active === null || !container.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, containerRef]);
}

export default useDrawerA11y;
