import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type PaginationProps = {
  /** Zero-based current page. */
  pageIndex: number;
  pageCount: number;
  onPageChange: (pageIndex: number) => void;
  /** Total row count, used for the "showing x–y of z" summary. */
  totalItems?: number;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
};

/** Compact page list with ellipses, so 40 pages don't render 40 buttons. */
function buildPageList(pageIndex: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index);

  const pages = new Set<number>([0, pageCount - 1, pageIndex]);
  if (pageIndex - 1 >= 0) pages.add(pageIndex - 1);
  if (pageIndex + 1 <= pageCount - 1) pages.add(pageIndex + 1);
  if (pageIndex <= 2) pages.add(1).add(2).add(3);
  if (pageIndex >= pageCount - 3) pages.add(pageCount - 2).add(pageCount - 3).add(pageCount - 4);

  const sorted = Array.from(pages)
    .filter((page) => page >= 0 && page < pageCount)
    .sort((a, b) => a - b);

  const result: Array<number | 'gap'> = [];
  let previous: number | null = null;
  for (const page of sorted) {
    if (previous !== null && page - previous > 1) result.push('gap');
    result.push(page);
    previous = page;
  }
  return result;
}

const Pagination: React.FC<PaginationProps> = ({
  pageIndex,
  pageCount,
  onPageChange,
  totalItems,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'items',
  className,
}) => {
  const safePageCount = Math.max(1, pageCount);
  const pages = buildPageList(pageIndex, safePageCount);
  const canPrevious = pageIndex > 0;
  const canNext = pageIndex < safePageCount - 1;

  const from =
    totalItems !== undefined && pageSize ? Math.min(totalItems, pageIndex * pageSize + 1) : null;
  const to =
    totalItems !== undefined && pageSize ? Math.min(totalItems, (pageIndex + 1) * pageSize) : null;

  const navButton =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        {totalItems !== undefined && pageSize ? (
          <span>
            {totalItems === 0 ? (
              <>No {itemLabel}</>
            ) : (
              <>
                Showing <span className="font-medium text-gray-700 dark:text-gray-200">{from}</span>–
                <span className="font-medium text-gray-700 dark:text-gray-200">{to}</span> of{' '}
                <span className="font-medium text-gray-700 dark:text-gray-200">{totalItems}</span>{' '}
                {itemLabel}
              </>
            )}
          </span>
        ) : (
          <span>
            Page {pageIndex + 1} of {safePageCount}
          </span>
        )}

        {onPageSizeChange && pageSize !== undefined && (
          <label className="flex items-center gap-2">
            <span className="sr-only">Rows per page</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option} / page
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          type="button"
          className={navButton}
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={!canPrevious}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((page, index) =>
          page === 'gap' ? (
            <span
              key={`gap-${index}`}
              className="px-1.5 text-sm text-gray-400"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              aria-current={page === pageIndex ? 'page' : undefined}
              className={cn(
                'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition',
                page === pageIndex
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
              )}
            >
              {page + 1}
            </button>
          )
        )}

        <button
          type="button"
          className={navButton}
          onClick={() => onPageChange(pageIndex + 1)}
          disabled={!canNext}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
};

export default Pagination;
