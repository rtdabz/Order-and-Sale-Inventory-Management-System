import React from 'react';
import { cn } from '../../../lib/utils';

export type StatusTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'brand'
  | 'violet';

const toneStyles: Record<StatusTone, string> = {
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20',
  warning:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20',
  danger:
    'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/20',
  brand:
    'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/20',
  violet:
    'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/20',
  neutral:
    'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-white/10 dark:text-gray-300 dark:ring-white/10',
};

export type StatusPillProps = {
  children: React.ReactNode;
  tone?: StatusTone;
  icon?: React.ReactNode;
  /** Show a small filled dot instead of an icon. */
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
};

const StatusPill: React.FC<StatusPillProps> = ({
  children,
  tone = 'neutral',
  icon,
  dot = false,
  size = 'sm',
  className,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset',
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      toneStyles[tone],
      className
    )}
  >
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
    {icon && <span aria-hidden="true">{icon}</span>}
    {children}
  </span>
);

/** Maps a stock quantity to the shared stock-status vocabulary. */
export function stockStatus(
  quantity: number | null | undefined,
  options: { unlimited?: boolean; lowThreshold?: number } = {}
): { label: string; tone: StatusTone } {
  const { unlimited = false, lowThreshold = 10 } = options;
  if (unlimited) return { label: 'Unlimited', tone: 'info' };
  const value = Number(quantity ?? 0);
  if (!Number.isFinite(value) || value <= 0) return { label: 'Out of Stock', tone: 'danger' };
  if (value <= lowThreshold) return { label: 'Low Stock', tone: 'warning' };
  return { label: 'In Stock', tone: 'success' };
}

export default StatusPill;
