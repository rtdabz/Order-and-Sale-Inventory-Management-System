import { ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router";

import { resolveBreadcrumbs } from "../../lib/navigation";
import { SHELL_COLOR_TRANSITION } from "../../lib/shellTokens";
import { cn } from "../../lib/utils";

/**
 * The header's page context (Requirement 8.8): a Breadcrumb_Trail derived from
 * Route_Registry, whose final crumb *is* the current-page label.
 *
 * Three crumb shapes (Requirement 8.6):
 * - a crumb with `to` is a `Link` to an ancestor route;
 * - the final crumb is plain text carrying `aria-current="page"`;
 * - a group crumb (no `to`, not final) is plain text with neither a link nor
 *   `aria-current` — it is a labelled separator, not a navigable ancestor.
 *   Recorded in the design as a deliberate reading.
 *
 * No props: the trail reads the location itself, so the header mounts it once
 * and every route gets the right trail.
 */

/** Link colours, both themes (Requirements 6.1, 6.3). */
const LINK_CLASS = cn(
  "rounded-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:focus-visible:ring-brand-400",
  SHELL_COLOR_TRANSITION
);

/** A group crumb reads as secondary: present, but not a destination. */
const GROUP_CLASS = "text-gray-400 dark:text-gray-500";

/** The current page is the emphasised end of the trail. */
const CURRENT_CLASS = "font-medium text-gray-800 dark:text-white";

const BreadcrumbTrail: React.FC = () => {
  const { pathname } = useLocation();
  const crumbs = resolveBreadcrumbs(pathname);
  const lastIndex = crumbs.length - 1;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === lastIndex;

          return (
            <li
              key={`${crumb.label}-${index}`}
              className={cn(
                "min-w-0 items-center gap-1.5",
                // Below `md` only the final crumb survives, so what remains is
                // the current-page label (Requirements 7.4, 10.2).
                isLast ? "flex" : "hidden md:flex"
              )}
            >
              {index > 0 && (
                <ChevronRight
                  aria-hidden="true"
                  className="hidden h-4 w-4 shrink-0 text-gray-300 md:block dark:text-gray-600"
                  strokeWidth={2}
                />
              )}

              {crumb.to && !isLast ? (
                <Link to={crumb.to} className={cn("truncate", LINK_CLASS)}>
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn("truncate", isLast ? CURRENT_CLASS : GROUP_CLASS)}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default BreadcrumbTrail;
