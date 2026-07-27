import React, { useEffect, useMemo, useState } from 'react';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import Pagination from '../pagination/Pagination';
import EmptyState from '../empty/EmptyState';
import { SkeletonTable } from '../skeleton/Skeleton';

export type ColumnAlign = 'left' | 'center' | 'right';

/** Column-level extras consumed by this table (set through `meta`). */
export type DataTableColumnMeta = {
  align?: ColumnAlign;
  /** Hide the column below the `md` breakpoint. */
  hideBelowMd?: boolean;
  className?: string;
  headerClassName?: string;
};

export type DataTableProps<T> = {
  data: T[];
  columns: Array<ColumnDef<T, any>>;
  /** Show a skeleton instead of the table body. */
  loading?: boolean;
  error?: string | null;
  /** Free-text filter applied through TanStack's global filter. */
  globalFilter?: string;
  /** Custom global filter predicate; defaults to a case-insensitive row scan. */
  globalFilterFn?: (row: T, query: string) => boolean;
  initialSorting?: SortingState;
  pageSize?: number;
  pageSizeOptions?: number[];
  /** Set false for short lists that never need paging. */
  paginated?: boolean;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  /** Extra DOM attributes per row (e.g. `data-product-id` for deep links). */
  rowAttributes?: (row: T) => Record<string, string | number | undefined>;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;
  itemLabel?: string;
  /** Minimum table width before horizontal scrolling kicks in. */
  minWidth?: number;
  className?: string;
  /** Reset to the first page whenever this value changes (e.g. active filters). */
  resetPageKey?: string | number;
};

const alignClasses: Record<ColumnAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

function defaultFilter<T>(row: T, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const scan = (value: unknown, depth = 0): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).toLowerCase().includes(needle);
    }
    if (depth >= 2) return false;
    if (Array.isArray(value)) return value.some((item) => scan(item, depth + 1));
    if (typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).some((item) => scan(item, depth + 1));
    }
    return false;
  };
  return scan(row);
}

/**
 * The one table used across Orders, Sales and Inventory. Handles sorting,
 * paging, filtering, loading, empty and error states so pages only describe
 * their columns.
 */
export default function DataTable<T>({
  data,
  columns,
  loading = false,
  error = null,
  globalFilter = '',
  globalFilterFn,
  initialSorting = [],
  pageSize: initialPageSize = 10,
  pageSizeOptions,
  paginated = true,
  onRowClick,
  rowClassName,
  rowAttributes,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  emptyIcon,
  emptyAction,
  itemLabel = 'records',
  minWidth = 780,
  className,
  resetPageKey,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filterFn = useMemo(
    () => globalFilterFn ?? ((row: T, query: string) => defaultFilter(row, query)),
    [globalFilterFn]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination: { pageIndex, pageSize: paginated ? pageSize : Math.max(data.length, 1) },
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, value) => filterFn(row.original as T, String(value ?? '')),
    manualPagination: false,
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();

  // Keep the page index inside range when data or filters shrink the list.
  useEffect(() => {
    if (pageIndex > 0 && pageIndex > pageCount - 1) setPageIndex(Math.max(0, pageCount - 1));
  }, [pageCount, pageIndex]);

  useEffect(() => {
    setPageIndex(0);
  }, [globalFilter, resetPageKey]);

  if (loading) {
    return <SkeletonTable rows={Math.min(pageSize, 6)} columns={Math.min(columns.length, 6)} />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (filteredCount === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800">
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          icon={emptyIcon}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth }}>
            <thead className="bg-gray-50 dark:bg-white/[0.02]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const meta = (header.column.columnDef.meta ?? {}) as DataTableColumnMeta;
                    const align = meta.align ?? 'left';
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        className={cn(
                          'whitespace-nowrap border-b border-gray-200 px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400',
                          alignClasses[align],
                          meta.hideBelowMd && 'hidden md:table-cell',
                          meta.headerClassName
                        )}
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              'inline-flex items-center gap-1.5 transition-colors hover:text-gray-700 dark:hover:text-gray-200',
                              align === 'right' && 'flex-row-reverse',
                              align === 'center' && 'justify-center'
                            )}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sorted === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : sorted === 'desc' ? (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-transparent">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  {...(rowAttributes?.(row.original as T) ?? {})}
                  onClick={onRowClick ? () => onRowClick(row.original as T) : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer',
                    'hover:bg-gray-50 dark:hover:bg-white/[0.03]',
                    rowClassName?.(row.original as T)
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = (cell.column.columnDef.meta ?? {}) as DataTableColumnMeta;
                    const align = meta.align ?? 'left';
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          'px-5 py-4 text-sm text-gray-600 dark:text-gray-300',
                          alignClasses[align],
                          meta.hideBelowMd && 'hidden md:table-cell',
                          meta.className
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {paginated && filteredCount > pageSize && (
        <Pagination
          pageIndex={pageIndex}
          pageCount={pageCount}
          onPageChange={setPageIndex}
          totalItems={filteredCount}
          pageSize={pageSize}
          onPageSizeChange={
            pageSizeOptions
              ? (size) => {
                  setPageSize(size);
                  setPageIndex(0);
                }
              : undefined
          }
          pageSizeOptions={pageSizeOptions}
          itemLabel={itemLabel}
        />
      )}
    </div>
  );
}
