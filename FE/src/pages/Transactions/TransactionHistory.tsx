import { useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { CalendarClock, Eye, Receipt, RefreshCw, TrendingUp, Wallet } from 'lucide-react';

import PageMeta from '../../components/common/PageMeta';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/ui/card/SectionCard';
import StatCard from '../../components/ui/card/StatCard';
import SearchInput from '../../components/ui/input/SearchInput';
import DataTable from '../../components/ui/table/DataTable';
import Button from '../../components/ui/button/Button';
import { SkeletonStatCards, SkeletonTable } from '../../components/ui/skeleton/Skeleton';
import OrderDetailsModal from '../../components/modals/OrderDetailsModal';

import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useShowSkeleton } from '../../context/AppDataContext';
import { CacheKeys } from '../../lib/dataCache';
import { fetchCompletedOrders, RawOrder } from '../../lib/apiResources';
import {
  countOrderItems,
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatTime,
  isTodayBusinessDay,
  resolveOrderTotal,
  sumOrderQuantity,
} from '../../lib/format';

/**
 * Transaction history.
 *
 * Every sale is completed at the POS Terminal, so this page is purely a record
 * of finished transactions — there is no queue, no station and no per-terminal
 * grouping to filter by.
 */
export default function TransactionHistory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewOrderId, setViewOrderId] = useState<number | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const { data, error, isInitialLoading, isRefreshing, refresh } = useCachedQuery<RawOrder[]>(
    CacheKeys.completedOrders,
    fetchCompletedOrders,
    { refreshEvents: ['sale:recorded'] }
  );

  const orders = data ?? [];
  const showSkeleton = useShowSkeleton(isInitialLoading);

  const todayOrders = useMemo(
    () => orders.filter((order) => order.created_at && isTodayBusinessDay(order.created_at)),
    [orders]
  );

  const totals = useMemo(() => {
    const lifetime = orders.reduce((sum, order) => sum + resolveOrderTotal(order), 0);
    const today = todayOrders.reduce((sum, order) => sum + resolveOrderTotal(order), 0);
    return {
      lifetime,
      today,
      itemsToday: todayOrders.reduce((sum, order) => sum + sumOrderQuantity(order), 0),
      average: orders.length > 0 ? lifetime / orders.length : 0,
    };
  }, [orders, todayOrders]);

  const openOrder = (orderId: number) => {
    setViewOrderId(orderId);
    setViewOpen(true);
  };

  const receiptButton = (order: RawOrder) => (
    <Button
      size="xs"
      variant="outline"
      startIcon={<Eye className="h-3.5 w-3.5" />}
      onClick={() => openOrder(order.id)}
    >
      View
    </Button>
  );

  const historyColumns = useMemo<ColumnDef<RawOrder>[]>(
    () => [
      {
        accessorKey: 'transaction_number',
        header: 'Transaction #',
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 dark:text-white">
            {row.original.transaction_number || `#${row.original.id}`}
          </span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Date & time',
        cell: ({ row }) => formatDateTime(row.original.created_at),
      },
      {
        id: 'lines',
        header: 'Lines',
        cell: ({ row }) => formatNumber(countOrderItems(row.original)),
        meta: { align: 'center', hideBelowMd: true },
      },
      {
        id: 'units',
        header: 'Units',
        cell: ({ row }) => formatNumber(sumOrderQuantity(row.original)),
        meta: { align: 'center', hideBelowMd: true },
      },
      {
        accessorKey: 'total_amount',
        header: 'Total',
        cell: ({ row }) => (
          <span className="font-semibold text-gray-900 dark:text-white">
            {formatCurrency(resolveOrderTotal(row.original))}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'actions',
        header: 'Receipt',
        enableSorting: false,
        cell: ({ row }) => receiptButton(row.original),
        meta: { align: 'right' },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const todayColumns = useMemo<ColumnDef<RawOrder>[]>(
    () => [
      {
        accessorKey: 'transaction_number',
        header: 'Transaction #',
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 dark:text-white">
            {row.original.transaction_number || `#${row.original.id}`}
          </span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Time',
        cell: ({ row }) => formatTime(row.original.created_at),
      },
      {
        id: 'units',
        header: 'Units',
        cell: ({ row }) => formatNumber(sumOrderQuantity(row.original)),
        meta: { align: 'center', hideBelowMd: true },
      },
      {
        accessorKey: 'total_amount',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="font-semibold text-gray-900 dark:text-white">
            {formatCurrency(resolveOrderTotal(row.original))}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'actions',
        header: 'Receipt',
        enableSorting: false,
        cell: ({ row }) => receiptButton(row.original),
        meta: { align: 'right' },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const orderFilter = (order: RawOrder, needle: string) =>
    [order.transaction_number, `#${order.id}`, formatDateTime(order.created_at)]
      .join(' ')
      .toLowerCase()
      .includes(needle.trim().toLowerCase());

  return (
    <>
      <PageMeta title="Transactions" />

      <PageHeader
        eyebrow="Sales"
        title="Transactions"
        description="Every completed sale, searchable by transaction number or date."
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Transactions' }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            loading={isRefreshing}
            startIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      <div className="space-y-6">
        {showSkeleton ? (
          <SkeletonStatCards count={4} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Transactions today"
              tone="brand"
              icon={<CalendarClock className="h-5 w-5" />}
              value={formatNumber(todayOrders.length)}
              hint="Business day 8am – 2am"
            />
            <StatCard
              label="Revenue today"
              tone="success"
              icon={<Wallet className="h-5 w-5" />}
              value={formatCurrency(totals.today)}
              hint={`${formatNumber(totals.itemsToday)} items sold`}
            />
            <StatCard
              label="Total transactions"
              tone="info"
              icon={<Receipt className="h-5 w-5" />}
              value={formatNumber(orders.length)}
              hint={`${formatCurrency(totals.lifetime)} lifetime`}
            />
            <StatCard
              label="Average basket"
              tone="violet"
              icon={<TrendingUp className="h-5 w-5" />}
              value={formatCurrency(totals.average)}
            />
          </div>
        )}

        {error && !showSkeleton && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <SectionCard
          title="Today's transactions"
          description="Business day runs from 8:00 AM to 2:00 AM."
          icon={<CalendarClock className="h-4 w-4" />}
        >
          {showSkeleton ? (
            <SkeletonTable rows={4} columns={5} />
          ) : (
            <DataTable<RawOrder>
              data={todayOrders}
              columns={todayColumns}
              initialSorting={[{ id: 'created_at', desc: true }]}
              pageSize={10}
              pageSizeOptions={[10, 25, 50]}
              itemLabel="transactions"
              minWidth={620}
              emptyIcon={<CalendarClock className="h-7 w-7" />}
              emptyTitle="No sales yet for today's business day"
              emptyDescription="Completed sales appear here the moment they are charged."
            />
          )}
        </SectionCard>

        <SectionCard
          title="All transactions"
          description="Search for a specific sale to reprint its receipt."
          icon={<Receipt className="h-4 w-4" />}
          toolbar={
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by transaction # or date…"
              className="w-full sm:max-w-md"
            />
          }
        >
          {showSkeleton ? (
            <SkeletonTable rows={6} columns={6} />
          ) : (
            <DataTable<RawOrder>
              data={orders}
              columns={historyColumns}
              globalFilter={searchQuery}
              globalFilterFn={orderFilter}
              initialSorting={[{ id: 'created_at', desc: true }]}
              pageSize={10}
              pageSizeOptions={[10, 25, 50, 100]}
              itemLabel="transactions"
              minWidth={720}
              emptyIcon={<Receipt className="h-7 w-7" />}
              emptyTitle={
                orders.length === 0 ? 'No transactions recorded yet' : 'No transactions match your search'
              }
              emptyDescription={
                orders.length === 0
                  ? 'Ring up a sale on the POS Terminal to get started.'
                  : 'Try a different transaction number or date.'
              }
            />
          )}
        </SectionCard>
      </div>

      <OrderDetailsModal isOpen={viewOpen} onClose={() => setViewOpen(false)} orderId={viewOrderId} />
    </>
  );
}
