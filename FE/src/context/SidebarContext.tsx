import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { SIDEBAR_STORAGE_KEY } from "../lib/shellTokens";

export type ViewportMode = "mobile" | "tablet" | "desktop";

export type SidebarState = {
  /** Persisted user preference. Meaningless at 'mobile'. */
  isExpanded: boolean;
  isDrawerOpen: boolean;
  viewport: ViewportMode;
  /** Derived: the one value the Sidebar, Backdrop and content offset all read. */
  railState: "expanded" | "collapsed" | "drawer";
  /**
   * The Header's sidebar toggle. The Header attaches it to its button; the
   * Sidebar hands it to `useDrawerA11y` so closing the drawer returns focus to
   * the control that opened it (Requirement 1.9).
   */
  toggleRef: RefObject<HTMLButtonElement | null>;
  toggleSidebar: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

/** Glossary breakpoints — the only two width numbers in the codebase. */
const MOBILE_QUERY = "(max-width: 767px)";
const DESKTOP_QUERY = "(min-width: 1024px)";

function readViewport(): ViewportMode {
  if (typeof window === "undefined" || !window.matchMedia) return "desktop";
  if (window.matchMedia(MOBILE_QUERY).matches) return "mobile";
  if (window.matchMedia(DESKTOP_QUERY).matches) return "desktop";
  return "tablet";
}

/**
 * Requirement 1.4/1.5: read in a lazy initialiser, never in an effect, so the
 * restored width is already correct on the first paint. Only exactly "true" or
 * "false" is honoured; anything else — absent, `"1"`, `"{}"`, a value left by
 * another app — falls through to the width-appropriate default.
 */
function readPersistedExpanded(): boolean {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return readViewport() === "desktop";
  } catch {
    // Storage blocked (private mode, quota): run without remembering the rail.
    return true;
  }
}

function persistExpanded(value: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
  } catch {
    // Fail silently — a terminal with storage blocked should still trade.
  }
}

const SidebarContext = createContext<SidebarState | undefined>(undefined);

export const useSidebar = (): SidebarState => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() =>
    readPersistedExpanded()
  );
  const [viewport, setViewport] = useState<ViewportMode>(() => readViewport());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  /**
   * Two `matchMedia` listeners rather than a `resize` handler, so the callback
   * fires only when a band is crossed instead of on every resize frame.
   */
  useEffect(() => {
    if (!window.matchMedia) return;

    const mobile = window.matchMedia(MOBILE_QUERY);
    const desktop = window.matchMedia(DESKTOP_QUERY);

    const sync = () => {
      const next = readViewport();
      setViewport(next);
      if (next !== "mobile") setIsDrawerOpen(false);
    };

    sync();
    mobile.addEventListener("change", sync);
    desktop.addEventListener("change", sync);

    return () => {
      mobile.removeEventListener("change", sync);
      desktop.removeEventListener("change", sync);
    };
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      persistExpanded(next);
      return next;
    });
  }, []);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const railState: SidebarState["railState"] =
    viewport === "mobile" ? "drawer" : isExpanded ? "expanded" : "collapsed";

  const value: SidebarState = {
    isExpanded,
    isDrawerOpen,
    viewport,
    railState,
    toggleRef,
    toggleSidebar,
    openDrawer,
    closeDrawer,
  };

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
};
