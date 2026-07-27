import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import { AppDataProvider, useAppData } from "../context/AppDataContext";
import { AppBootstrapSkeleton } from "../components/ui/skeleton/Skeleton";
import {
  CONTENT_OFFSET_COLLAPSED,
  CONTENT_OFFSET_EXPANDED,
  CONTENT_OFFSET_NONE,
  SHELL_TRANSITION,
} from "../lib/shellTokens";
import { cn } from "../lib/utils";

/**
 * Renders the single post-login skeleton, then hands over to the routed page.
 *
 * Pages are intentionally not mounted until the initial prefetch resolves: by
 * the time they render, the shared cache already holds products, inventories,
 * categories and orders, so no page shows a skeleton of its own and navigation
 * is instant.
 */
const PageArea: React.FC = () => {
  const { bootstrapped } = useAppData();

  return (
    <div id="main-content" className="w-full p-5 md:p-6">
      {bootstrapped ? <Outlet /> : <AppBootstrapSkeleton />}
    </div>
  );
};

const LayoutContent: React.FC = () => {
  const { railState } = useSidebar();

  /**
   * One derived value drives the offset, so the rail and the content region
   * cannot disagree while a breakpoint is being crossed. `min-w-0` is what
   * keeps a wide child shrinking instead of pushing the page sideways.
   */
  const offset =
    railState === "drawer"
      ? CONTENT_OFFSET_NONE
      : railState === "expanded"
        ? CONTENT_OFFSET_EXPANDED
        : CONTENT_OFFSET_COLLAPSED;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppSidebar />
      <Backdrop />
      <div className={cn("flex min-w-0 flex-1 flex-col", offset, SHELL_TRANSITION)}>
        <AppHeader />
        <PageArea />
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <AppDataProvider>
      <SidebarProvider>
        <LayoutContent />
      </SidebarProvider>
    </AppDataProvider>
  );
};

export default AppLayout;
