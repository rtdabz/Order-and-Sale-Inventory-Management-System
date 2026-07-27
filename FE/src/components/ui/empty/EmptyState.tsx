import React from 'react';
import { cn } from '../../../lib/utils';

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Compact variant for use inside table bodies. */
  size?: 'sm' | 'md';
};

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className,
  size = 'md',
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center text-center',
      size === 'sm' ? 'px-4 py-8' : 'px-6 py-14',
      className
    )}
  >
    {icon && (
      <span
        className={cn(
          'mb-4 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/[0.06] dark:text-gray-500',
          size === 'sm' ? 'h-12 w-12' : 'h-16 w-16'
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
    )}
    <h3
      className={cn(
        'font-semibold text-gray-900 dark:text-white',
        size === 'sm' ? 'text-sm' : 'text-base'
      )}
    >
      {title}
    </h3>
    {description && (
      <p className="mt-1.5 max-w-md text-sm text-gray-500 dark:text-gray-400">{description}</p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
