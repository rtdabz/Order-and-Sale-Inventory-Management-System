import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";
import BrandLockup from "../components/shell/BrandLockup";
import BreadcrumbTrail from "../components/shell/BreadcrumbTrail";
import HeaderQuickActions from "../components/shell/HeaderQuickActions";
import IconButton from "../components/shell/IconButton";
import { useSidebar } from "../context/SidebarContext";
import { SHELL_ICON_CLASS, SHELL_ICON_STROKE } from "../lib/shellTokens";
import { cn } from "../lib/utils";

/**
 * Top bar for the authenticated shell.
 *
 * A layout file: it arranges seven named regions in DOM order and owns nothing
 * else (Requirement 7.3). Sales are completed at the terminal, so there is
 * nothing to poll for here — no incoming-order queue and no arrival chime.
 *
 * A bare `header` not nested inside another landmark exposes `banner`
 * implicitly, so it carries no `role` (Requirements 7.7, 12.2).
 *
 * `z-30` is the middle of the shell's stacking order — page content `z-auto` <
 * header `z-30` < backdrop `z-40` < sidebar `z-50` — so the drawer covers the
 * header on mobile while the header still covers sticky table headers inside
 * pages. The former `z-99999` broke the first of those.
 */
const HEADER_SHELL = cn(
  "sticky top-0 z-30 flex h-14 w-full items-center gap-2 px-3 lg:px-5",
  "bg-white/95 dark:bg-gray-900/95 backdrop-blur-md",
  "border-b border-gray-200 dark:border-gray-800"
);

const AppHeader: React.FC = () => {
  const {
    railState,
    viewport,
    isDrawerOpen,
    toggleRef,
    toggleSidebar,
    openDrawer,
    closeDrawer,
  } = useSidebar();

  const isMobile = viewport === "mobile";

  /**
   * One control, two meanings, resolved from the context's viewport band — no
   * width measurement and no breakpoint literal here.
   */
  const handleToggle = () => {
    if (!isMobile) {
      toggleSidebar();
      return;
    }
    if (isDrawerOpen) closeDrawer();
    else openDrawer();
  };

  /**
   * The name always names the target action, and it differs between the two
   * meanings of the control (Requirements 1.6, 1.7).
   */
  const toggleLabel = isMobile
    ? isDrawerOpen
      ? "Close navigation"
      : "Open navigation"
    : railState === "expanded"
      ? "Collapse sidebar"
      : "Expand sidebar";

  /** Lucide glyphs — no hand-written SVG path markup here (Requirement 4.7). */
  const ToggleGlyph = isMobile
    ? isDrawerOpen
      ? X
      : Menu
    : railState === "expanded"
      ? PanelLeftClose
      : PanelLeftOpen;

  return (
    <header className={HEADER_SHELL}>
      {/* 1. Sidebar toggle. `toggleRef` lands on the button itself, so closing
             the drawer with Escape returns focus here (Requirement 1.9). No
             responsive visibility class (Requirement 7.4). */}
      <IconButton
        label={toggleLabel}
        onClick={handleToggle}
        buttonRef={toggleRef}
        aria-expanded={railState === "expanded"}
        aria-controls="app-sidebar"
      >
        <ToggleGlyph
          className={SHELL_ICON_CLASS}
          strokeWidth={SHELL_ICON_STROKE}
          aria-hidden="true"
        />
      </IconButton>

      {/* 2. Brand, mobile only — the rail carries it at `md` and up. */}
      <BrandLockup showWordmark={false} className="shrink-0 md:hidden" />

      {/* 3. Page context. Absorbs the slack and truncates, so nothing to its
             right is pushed off-screen. */}
      <div className="min-w-0 flex-1">
        <BreadcrumbTrail />
      </div>

      {/* 5. Quick action — first to degrade (Requirement 7.4). */}
      <HeaderQuickActions />

      {/* 6, 7. Untouched internals, including the low-stock highlight flow and
                the logout cache reset (Requirements 7.5, 7.6). */}
      <NotificationDropdown />
      <UserDropdown />
    </header>
  );
};

export default AppHeader;
