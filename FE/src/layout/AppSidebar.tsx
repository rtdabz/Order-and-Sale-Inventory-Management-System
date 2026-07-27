import { useCallback } from "react";
import { Link, useLocation } from "react-router";

import {
  GridIcon,
  HorizontaLDots,
  ShoppingBasketIcon,
  OrderIcon,
  HistoryIcon,
  CategoryIcon,
  ReportIcon,
  InventoryIcon,
  DamageIcon,
} from "../icons";
import { useSidebar } from "../context/SidebarContext";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

/**
 * Sidebar navigation for the single-terminal POS.
 *
 * There is no billing queue: sales are completed at the POS Terminal, so the
 * menu goes straight from selling to reviewing completed transactions.
 */
const navSections: NavSection[] = [
  {
    title: "Menu",
    items: [
      { name: "Dashboard", icon: <GridIcon />, path: "/dashboard" },
      { name: "POS Terminal", icon: <OrderIcon />, path: "/orderpage" },
      { name: "Transactions", icon: <HistoryIcon />, path: "/transactions" },
    ],
  },
  {
    title: "Product Catalog",
    items: [
      { name: "Products", icon: <ShoppingBasketIcon />, path: "/products" },
      { name: "Categories", icon: <CategoryIcon />, path: "/category" },
    ],
  },
  {
    title: "Reports",
    items: [
      { name: "Sales Report", icon: <ReportIcon />, path: "/reports/sales" },
      { name: "Inventory Report", icon: <InventoryIcon />, path: "/inventory" },
      { name: "Damage Report", icon: <DamageIcon />, path: "/reports/damage" },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  const showLabels = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      className={`fixed left-0 top-0 z-50 mt-16 flex h-screen flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out lg:mt-0
        ${isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex py-8 ${!showLabels ? "lg:justify-center" : "justify-start"}`}>
        <Link to="/dashboard" className="flex items-center gap-3">
          <img
            src="/images/logo/MKB.jpg"
            alt="MKB logo"
            width={50}
            height={50}
            className="rounded-lg"
          />
          {showLabels && (
            <span className="text-2xl font-semibold text-gray-800">MKB</span>
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto no-scrollbar duration-300 ease-linear">
        <nav className="mb-6 flex flex-col gap-4">
          {navSections.map((section) => (
            <div key={section.title}>
              <h2
                className={`mb-4 flex text-xs uppercase leading-[20px] text-gray-400 ${
                  !showLabels ? "lg:justify-center" : "justify-start"
                }`}
              >
                {showLabels ? section.title : <HorizontaLDots className="size-6" />}
              </h2>

              <ul className="flex flex-col gap-4">
                {section.items.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.path}
                      className={`menu-item group ${
                        isActive(item.path) ? "menu-item-active" : "menu-item-inactive"
                      }`}
                    >
                      <span
                        className={`menu-item-icon-size ${
                          isActive(item.path)
                            ? "menu-item-icon-active"
                            : "menu-item-icon-inactive"
                        } ${
                          item.name === "Damage Report"
                            ? "[&_svg]:fill-black [&_svg]:dark:fill-gray-900"
                            : ""
                        }`}
                      >
                        {item.icon}
                      </span>
                      {showLabels && <span className="menu-item-text">{item.name}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
