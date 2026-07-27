import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import { AppDataProvider, useAppData } from "../context/AppDataContext";
import { AppBootstrapSkeleton } from "../components/ui/skeleton/Skeleton";

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
    <div id="main-content" className="mx-auto max-w-screen-2xl p-4 md:p-6">
      {bootstrapped ? <Outlet /> : <AppBootstrapSkeleton />}
    </div>
  );
};

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 xl:flex">
      <div>
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
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
