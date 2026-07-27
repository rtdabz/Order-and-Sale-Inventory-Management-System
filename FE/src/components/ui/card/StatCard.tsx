import React from 'react';
import { cn } from '../../../lib/utils';

export type StatTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'violet';

const toneStyles: Record<StatTone, { icon: string; value: string; ring: string }> = {
  brand: {
    icon: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
    value: 'text-gray-900 dark:text-white',
    ring: 'hover:border-brand-300 dark:hover:border-brand-500/40',
  },
  success: {
    icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    value: 'text-gray-900 dark:text-white',
    ring: 'hover:border-emerald-300 dark:hover:border-emerald-500/40',
  },
  warning: {
    icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    value: 'text-gray-900 dark:text-white',
    ring: 'hover:border-amber-300 dark:hover:border-amber-500/40',
  },
  danger: {
    icon: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
    value: 'text-gray-900 dark:text-white',
    ring: 'hover:border-red-300 dark:hover:border-red-500/40',
  },
  info: {
    icon: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
    value: 'text-gray-900 dark:text-white',
    ring: 'hover:border-sky-300 dark:hover:border-sky-500/40',
  },
  violet: {
    icon: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
    value: 'text-gray-900 dark:text-white',
    ring: 'hover:border-violet-300 dark:hover:border-violet-500/40',
  },
  neutral: {
    icon: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
    value: 'text-gray-900 dark:text-white',
    ring: 'hover:border-gray-300 dark:hover:border-gray-600',
  },
};

export type StatCardProps = {
  label: string;
  value: React.ReactNode;
  /** Secondary line under the value (period, context, …). */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: StatTone;
  /** Small pill on the top right — trend, count, badge, … */
  badge?: React.ReactNode;
  /** Rendered at the bottom, e.g. a menu or a link. */
  footer?: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

/**
 * The single KPI tile used by the dashboard, orders, inventory and reports.
 * One component means one spacing scale and one colour hierarchy everywhere.
 */
const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  badge,
  footer,
  onClick,
  className,
}) => {
  const styles = toneStyles[tone];
  const interactive = typeof onClick === 'function';

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        {icon && (
          <span
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              styles.icon
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        {badge && <span className="shrink-0">{badge}</span>}
      </div>

      <div className={cn(icon || badge ? 'mt-3.5' : '')}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p className={cn('mt-1.5 text-2xl font-bold leading-tight', styles.value)}>{value}</p>
        {hint && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>

      {footer && <div className="mt-3">{footer}</div>}
    </>
  );

  const base = cn(
    'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 dark:border-gray-800 dark:bg-white/[0.03]',
    styles.ring,
    interactive && 'cursor-pointer text-left hover:-translate-y-0.5 hover:shadow-md',
    className
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={cn(base, 'w-full')}>
        {content}
      </button>
    );
  }

  return <div className={base}>{content}</div>;
};

export default StatCard;
