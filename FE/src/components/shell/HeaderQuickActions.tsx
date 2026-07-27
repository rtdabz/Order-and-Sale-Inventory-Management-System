import { ShoppingCart } from "lucide-react";
import { Link, useLocation } from "react-router";

import Button from "../ui/button/Button";

/** The POS terminal route. `navigation.ts` exports no constant for it. */
const POS_TERMINAL_PATH = "/orderpage";

const QUICK_ACTION_LABEL = "New sale";

/**
 * The header's single primary quick action (decision D3). Hidden on the POS
 * terminal itself, where "start a new sale" is what the page already is.
 *
 * Reuses `ui/button/Button` wrapped in a `Link` (`Button` has no `href`), the
 * same pattern the dashboard already uses (Requirement 11.3).
 *
 * Degradation: the label drops below `xl` while `aria-label` keeps the
 * icon-only form named (Requirement 12.5); the whole action is absent below
 * `md`, where the header row carries only navigation and account controls
 * (Requirement 10.1).
 */
const HeaderQuickActions: React.FC = () => {
  const { pathname } = useLocation();

  if (pathname === POS_TERMINAL_PATH) {
    return null;
  }

  return (
    <Link to={POS_TERMINAL_PATH} className="hidden shrink-0 md:inline-flex">
      <Button
        size="sm"
        aria-label={QUICK_ACTION_LABEL}
        startIcon={<ShoppingCart className="h-4 w-4" aria-hidden="true" />}
      >
        <span className="hidden xl:inline">{QUICK_ACTION_LABEL}</span>
      </Button>
    </Link>
  );
};

export default HeaderQuickActions;
