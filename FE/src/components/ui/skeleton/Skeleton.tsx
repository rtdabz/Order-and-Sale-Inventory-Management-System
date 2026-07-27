import React from 'react';
import { cn } from '../../../lib/utils';

/**
 * Skeleton primitives.
 *
 * These are intentionally dumb: deciding *whether* to render a skeleton is the
 * caller's job (see `useShowSkeleton`), which is what keeps loaders from
 * flashing on every navigation.
 */

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div
    aria-hidden="true"
    className={cn('animate-pulse rounded-md bg-gray-200 dark:bg-gray-700/60', className)}
  />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className,
}) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton key={index} className={cn('h-3.5', index === lines - 1 ? 'w-2/3' : 'w-full')} />
    ))}
  </div>
);

export const SkeletonStatCards: React.FC<{ count?: number; className?: string }> = ({
  count = 4,
  className,
}) => (
  <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <div className="flex items-start justify-between">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="mt-5 h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-28" />
      </div>
    ))}
  </div>
);

export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
}> = ({ rows = 6, columns = 5, className }) => (
  <div
    className={cn(
      'overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800',
      className
    )}
  >
    <div className="flex items-center gap-4 border-b border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-800 dark:bg-white/[0.02]">
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={index} className="h-3 flex-1" />
      ))}
    </div>
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-5 py-4">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn('h-3.5 flex-1', columnIndex === 0 && 'max-w-[40%]')}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const SkeletonProductGrid: React.FC<{ count?: number; className?: string }> = ({
  count = 12,
  className,
}) => (
  <div
    className={cn(
      'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
      className
    )}
  >
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <Skeleton className="aspect-square w-full rounded-none" />
        <div className="space-y-2 p-3">
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonChart: React.FC<{ height?: number; bars?: number; className?: string }> = ({
  height = 200,
  bars = 12,
  className,
}) => (
  <div className={cn('w-full', className)} style={{ height }}>
    <div className="flex h-full items-end justify-between gap-2">
      {Array.from({ length: bars }).map((_, index) => (
        <Skeleton
          key={index}
          className="flex-1 rounded-t-md"
          // Deterministic pseudo-random heights keep the shape stable between renders.
          {...{ style: { height: `${35 + ((index * 37) % 60)}%` } }}
        />
      ))}
    </div>
  </div>
);

/**
 * The single full-screen loader shown while the session performs its initial
 * data load right after login.
 */
export const AppBootstrapSkeleton: React.FC<{ label?: string }> = ({
  label = 'Preparing your workspace',
}) => (
  <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3.5 w-80" />
      </div>
      <Skeleton className="h-10 w-40 rounded-lg" />
    </div>

    <SkeletonStatCards />

    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12 xl:col-span-7">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <Skeleton className="h-4 w-32" />
          <SkeletonChart className="mt-6" />
        </div>
      </div>
      <div className="col-span-12 xl:col-span-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <Skeleton className="h-4 w-28" />
          <div className="mt-6 flex items-center justify-center">
            <Skeleton className="h-40 w-40 rounded-full" />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    <SkeletonTable rows={5} columns={4} />

    <p className="text-center text-sm text-gray-500 dark:text-gray-400">{label}…</p>
  </div>
);

export default Skeleton;
