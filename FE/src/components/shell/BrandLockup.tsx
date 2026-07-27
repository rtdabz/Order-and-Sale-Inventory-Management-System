import { Link } from "react-router";

import { DASHBOARD_PATH } from "../../lib/navigation";
import { SHELL_COLOR_TRANSITION } from "../../lib/shellTokens";
import { cn } from "../../lib/utils";

export type BrandLockupProps = {
  /** Show the `MKB` wordmark beside the logo. Hidden in the collapsed rail. */
  showWordmark: boolean;
  className?: string;
  wordmarkClassName?: string;
};

/**
 * The one brand lockup for the shell: used by the Sidebar in all three rail
 * states and by the Header's mobile region, so the logo asset, corner radius
 * and wordmark type are identical between them (Requirement 6.4).
 *
 * The link carries an explicit accessible name, so it stays named when the
 * wordmark is hidden.
 */
const BrandLockup: React.FC<BrandLockupProps> = ({ showWordmark, className, wordmarkClassName }) => (
  <Link
    to={DASHBOARD_PATH}
    aria-label="MKB, go to dashboard"
    className={cn(
      "flex items-center gap-3 rounded-lg outline-none",
      "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
      "dark:focus-visible:ring-brand-400 dark:focus-visible:ring-offset-gray-900",
      SHELL_COLOR_TRANSITION,
      className
    )}
  >
    <img
      src="/images/logo/MKB.jpg"
      alt="MKB logo"
      width={50}
      height={50}
      className="rounded-lg border border-brand-900/50"
    />
    {showWordmark && (
      <span className={cn("text-2xl font-semibold text-gray-800 dark:text-white", wordmarkClassName)}>
        MKB
      </span>
    )}
  </Link>
);

export default BrandLockup;
