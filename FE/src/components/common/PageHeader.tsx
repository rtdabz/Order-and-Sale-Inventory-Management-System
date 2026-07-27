import React from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/utils';

export type PageHeaderProps = {
  title: string;
  description?: string;
  /** Small label rendered above the title (module name, section, …). */
  eyebrow?: string;
  /** Right-aligned actions: buttons, filters, refresh, … */
  actions?: React.ReactNode;
  /** Extra content rendered under the title (tabs, KPI strip, …). */
  children?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; to?: string }>;
  className?: string;
};

/**
 * Consistent page heading used across Orders, Sales and Inventory so every
 * screen shares the same vertical rhythm and type scale.
 */
const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  eyebrow,
  actions,
  children,
  breadcrumbs,
  className,
}) => (
  <header className={cn('mb-6', className)}>
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                {crumb.to && !isLast ? (
                  <Link
                    to={crumb.to}
                    className="transition-colors hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={isLast ? 'font-medium text-gray-700 dark:text-gray-200' : undefined}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
                {!isLast && (
                  <svg
                    className="h-3.5 w-3.5 text-gray-400"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 12l4-4-4-4"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    )}

    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            {eyebrow}
          </p>
        )}
        <h1 className="truncate text-2xl font-bold tracking-tight text-gray-900 dark:text-white lg:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-3xl text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>

    {children && <div className="mt-5">{children}</div>}
  </header>
);

export default PageHeader;
