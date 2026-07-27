import { useRef } from "react";

import BrandLockup from "../components/shell/BrandLockup";
import NavGroup from "../components/shell/NavGroup";
import { useSidebar } from "../context/SidebarContext";
import useDrawerA11y from "../hooks/useDrawerA11y";
import { sidebarGroups } from "../lib/navigation";
import {
  RAIL_WIDTH_COLLAPSED,
  RAIL_WIDTH_EXPANDED,
  SHELL_TRANSITION,
} from "../lib/shellTokens";
import { cn } from "../lib/utils";

const GROUPS = sidebarGroups();

const RAIL_SURFACE = cn(
  "bg-brand-950 text-white",
  "border-r border-brand-900/40"
);

const AppSidebar: React.FC = () => {
  const { railState, isDrawerOpen, closeDrawer, toggleRef } = useSidebar();
  const asideRef = useRef<HTMLElement | null>(null);

  const isDrawer = railState === "drawer";
  const showLabels = railState !== "collapsed";

  useDrawerA11y({
    open: isDrawer && isDrawerOpen,
    onClose: closeDrawer,
    containerRef: asideRef,
    returnFocusRef: toggleRef,
  });

  return (
    <aside
      id="app-sidebar"
      ref={asideRef}
      className={cn(
        "fixed left-0 top-0 z-50 flex h-screen flex-col px-3",
        RAIL_SURFACE,
        SHELL_TRANSITION,
        showLabels ? RAIL_WIDTH_EXPANDED : RAIL_WIDTH_COLLAPSED,
        isDrawer && !isDrawerOpen ? "-translate-x-full" : "translate-x-0"
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-brand-900/30",
          showLabels ? "justify-start px-2" : "justify-center"
        )}
      >
        <BrandLockup showWordmark={showLabels} wordmarkClassName="text-white font-bold tracking-wider" />
      </div>

      <nav
        aria-label="Main navigation"
        className="flex flex-col space-y-4 overflow-y-auto py-4 no-scrollbar"
      >
        {GROUPS.map((group) => (
          <NavGroup
            key={group.id}
            label={group.label}
            items={group.items}
            showLabels={showLabels}
          />
        ))}
      </nav>
    </aside>
  );
};

export default AppSidebar;
