import React from 'react';
import { cn } from '../../../lib/utils';

export type SegmentedTabItem<T extends string = string> = {
  value: T;
  label: React.ReactNode;
  /** Optional count rendered as a pill next to the label. */
  count?: number;
  icon?: React.ReactNode;
};

export type SegmentedTabsProps<T extends string = string> = {
  items: Array<SegmentedTabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
};

/**
 * Segmented control used for Billing Queue / Order History, report view modes,
 * inventory tabs, and so on. Replaces four different hand-rolled tab styles.
 */
function SegmentedTabs<T extends string = string>({
  items,
  value,
  onChange,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-100/80 p-1 dark:border-gray-800 dark:bg-white/[0.04]',
        className
      )}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.value)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg font-medium transition-all duration-200',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
              isActive
                ? 'bg-white text-brand-700 shadow-sm dark:bg-gray-800 dark:text-brand-300'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            )}
          >
            {item.icon && <span aria-hidden="true">{item.icon}</span>}
            <span>{item.label}</span>
            {typeof item.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none',
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
                    : 'bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedTabs;
