import { useSidebar } from "../context/SidebarContext";
import { SHELL_TRANSITION } from "../lib/shellTokens";

/**
 * Drawer scrim, mobile only. Purely decorative — `aria-hidden` keeps it out of
 * the accessibility tree while the drawer itself owns the modal semantics
 * (Requirement 1.10).
 *
 * `z-40` sits between the header (`z-30`) and the drawer (`z-50`).
 */
const Backdrop: React.FC = () => {
  const { railState, isDrawerOpen, closeDrawer } = useSidebar();

  if (railState !== "drawer" || !isDrawerOpen) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-40 bg-gray-900/50 dark:bg-black/60 lg:hidden ${SHELL_TRANSITION}`}
      onClick={closeDrawer}
    />
  );
};

export default Backdrop;
