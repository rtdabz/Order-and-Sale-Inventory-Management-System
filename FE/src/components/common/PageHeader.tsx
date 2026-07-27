import React from 'react';
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
  className?: string;
};

/**
 * Consistent page heading used across Orders, Sales and Inventory so every
 * screen shares the same vertical rhythm and type scale.
 *
 * Breadcrumbs are rendered by the app header (`components/shell/BreadcrumbTrail`),
 * not here, so a page never shows two trails.
 */
const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
}) => (
  <header className={cn('mb-4', className)}>
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
