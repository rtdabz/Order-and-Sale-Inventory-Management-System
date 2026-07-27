import React from 'react';
import { cn } from '../../../lib/utils';

export type SectionCardProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Leading icon shown beside the title. */
  icon?: React.ReactNode;
  /** Right-aligned header controls. */
  actions?: React.ReactNode;
  /** Row rendered between the header and the body (filters, tabs, search). */
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Remove body padding — useful when the body is a full-bleed table. */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
};

/**
 * Standard surface for a block of content. Replaces the ad-hoc mix of
 * `ComponentCard`, raw divs and gradient panels that the pages used before.
 */
const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  icon,
  actions,
  toolbar,
  footer,
  children,
  flush = false,
  className,
  bodyClassName,
}) => {
  const hasHeader = Boolean(title || description || actions || icon);

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]',
        className
      )}
    >
      {hasHeader && (
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                aria-hidden="true"
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
              )}
              {description && (
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}

      {toolbar && (
        <div className="border-b border-gray-100 bg-gray-50/60 px-4 py-2.5 dark:border-gray-800 dark:bg-white/[0.02] sm:px-5">
          {toolbar}
        </div>
      )}

      <div className={cn(flush ? '' : 'p-4 sm:p-5', bodyClassName)}>{children}</div>

      {footer && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02] sm:px-5">
          {footer}
        </div>
      )}
    </section>
  );
};

export default SectionCard;
