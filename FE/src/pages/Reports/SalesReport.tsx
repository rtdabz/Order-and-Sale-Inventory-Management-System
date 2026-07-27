import { useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import {
  BarChart3,
  CalendarRange,
  FileDown,
  FileText,
  Package,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import PageMeta from '../../components/common/PageMeta';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/ui/card/SectionCard';
import StatCard from '../../components/ui/card/StatCard';
import SegmentedTabs from '../../components/ui/tabs/SegmentedTabs';
import DataTable from '../../components/ui/table/DataTable';
import EmptyState from '../../components/ui/empty/EmptyState';
import Button from '../../components/ui/button/Button';
import { Modal } from '../../components/ui/modal';
import { SkeletonChart, SkeletonStatCards, SkeletonTable } from '../../components/ui/skeleton/Skeleton';

import api from '../../lib/axios';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useShowSkeleton } from '../../context/AppDataContext';
import { CacheKeys, fetchCached } from '../../lib/dataCache';
import { fetchOrders, RawOrder } from '../../lib/apiResources';
import { downloadCsv, downloadPdfTable } from '../../lib/exportData';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getBusinessDayKey,
  getWeekStartKey,
  sumOrderQuantity,
} from '../../lib/format';

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'annual';

type PeriodGroup = {
  key: string;
  label: string;
  /** Weekday name, only meaningful for the daily view. */
  dayName: string;
  orders: number;
  items: number;
  total: number;
};

type MonthlyDetail = { month: number; total_amount: number; order_count: number };

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const fetchMonthlyDetails = (year: number) =>
  fetchCached<MonthlyDetail[]>(CacheKeys.monthlySalesDetails(year), async () => {
    const response = await api.get(`/sales/monthly-details?year=${year}`);
    return Array.isArray(response?.data?.data) ? response.data.data : [];
  });

const isCompleted = (order: RawOrder) =>
  Boolean(order.sale) || String(order.status ?? '').toLowerCase() === 'completed';

const orderDateOf = (order: RawOrder) => String(order.order_date || order.created_at || '');

/** Period bucket an order belongs to, for the active view mode. */
function bucketOf(order: RawOrder, viewMode: ViewMode): { key: string; label: string } {
  const raw = orderDateOf(order);
  const dateOnly = raw.split('T')[0];

  if (viewMode === 'daily') {
    const key = getBusinessDayKey(raw);
    const [year, month, day] = key.split('-');
    return { key, label: `${day}/${month}/${year}` };
  }
  if (viewMode === 'weekly') {
    const key = getWeekStartKey(dateOnly);
    return { key, label: `Week of ${formatDate(key)}` };
  }
  if (viewMode === 'monthly') {
    const [year, month] = dateOnly.split('-');
    return {
      key: `${year}-${month}`,
      label: `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`,
    };
  }
  const year = dateOnly.slice(0, 4);
  return { key: year, label: `Year ${year}` };
}

export default function SalesReport() {
  const currentYear = new Date().getFullYear();
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [detailPeriod, setDetailPeriod] = useState<PeriodGroup | null>(null);

  const ordersQuery = useCachedQuery<RawOrder[]>(CacheKeys.orders, fetchOrders, {
    refreshEvents: ['sale:recorded'],
  });
  const annualQuery = useCachedQuery<MonthlyDetail[]>(
    CacheKeys.monthlySalesDetails(currentYear),
    () => fetchMonthlyDetails(currentYear),
    { refreshEvents: ['sale:recorded'] }
  );

  const orders = ordersQuery.data ?? [];
  const annualData = annualQuery.data ?? [];

  /** Completed orders inside the selected date range. */
  const completedInRange = useMemo(
    () =>
      orders.filter((order) => {
        if (!isCompleted(order)) return false;
        if (!fromDate && !toDate) return true;
        const day = orderDateOf(order).split('T')[0];
        if (fromDate && day < fromDate) return false;
        if (toDate && day > toDate) return false;
        return true;
      }),
    [orders, fromDate, toDate]
  );

  const totals = useMemo(() => {
    const revenue = completedInRange.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
    const items = completedInRange.reduce((sum, order) => sum + sumOrderQuantity(order), 0);
    return {
      revenue,
      items,
      orders: completedInRange.length,
      average: completedInRange.length > 0 ? revenue / completedInRange.length : 0,
    };
  }, [completedInRange]);

  /** Orders belonging to one period bucket — used by exports and the modal. */
  const ordersForPeriod = (periodKey: string) =>
    completedInRange.filter((order) => bucketOf(order, viewMode).key === periodKey);

  const groups = useMemo<PeriodGroup[]>(() => {
    // Annual with no date filter uses the backend monthly summary, which also
    // covers months that have been archived out of the orders endpoint.
    if (viewMode === 'annual' && annualData.length > 0 && !fromDate && !toDate) {
      const orderCount = annualData.reduce((sum, month) => sum + month.order_count, 0);
      const revenue = annualData.reduce((sum, month) => sum + Number(month.total_amount ?? 0), 0);
      return [
        {
          key: String(currentYear),
          label: `Year ${currentYear}`,
          dayName: '',
          orders: orderCount,
          items: totals.items,
          total: revenue,
        },
      ];
    }

    const buckets = new Map<string, PeriodGroup>();
    for (const order of completedInRange) {
      const { key, label } = bucketOf(order, viewMode);
      const existing =
        buckets.get(key) ?? { key, label, dayName: '', orders: 0, items: 0, total: 0 };
      existing.orders += 1;
      existing.items += sumOrderQuantity(order);
      existing.total += Number(order.total_amount ?? 0);
      buckets.set(key, existing);
    }

    const list = Array.from(buckets.values()).map((group) => {
      if (viewMode !== 'daily') return group;
      const [year, month, day] = group.key.split('-').map(Number);
      const dayName = new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString('en-PH', {
        weekday: 'long',
      });
      return { ...group, dayName };
    });

    // Newest first for day-level views, chronological for the wider ones.
    list.sort((a, b) => (viewMode === 'daily' ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key)));
    return list;
  }, [viewMode, annualData, fromDate, toDate, completedInRange, totals.items, currentYear]);

  /** Chart series: oldest → newest, capped so labels stay readable. */
  const chartData = useMemo(() => {
    const ordered = [...groups].sort((a, b) => a.key.localeCompare(b.key)).slice(-14);
    return {
      categories: ordered.map((group) => group.label),
      values: ordered.map((group) => Number(group.total.toFixed(2))),
    };
  }, [groups]);

  const chartOptions: ApexOptions = {
    colors: ['#465fff'],
    chart: {
      fontFamily: 'Outfit, sans-serif',
      type: 'bar',
      height: 240,
      toolbar: { show: false },
    },
    plotOptions: { bar: { columnWidth: '45%', borderRadius: 6, borderRadiusApplication: 'end' } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: chartData.categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#98a2b3', fontSize: '11px' }, rotate: -35, trim: true },
    },
    yaxis: {
      labels: {
        style: { colors: '#98a2b3', fontSize: '11px' },
        formatter: (value: number) => formatCurrency(value),
      },
    },
    grid: { borderColor: 'rgba(148, 163, 184, 0.18)', strokeDashArray: 4 },
    tooltip: { y: { formatter: (value: number) => formatCurrency(value) } },
  };

  // ------------------------------------------------------------------ exports

  const exportPeriodCsv = (group: PeriodGroup) => {
    if (viewMode === 'annual' && annualData.length > 0 && !fromDate && !toDate) {
      downloadCsv({
        filename: `sales-annual-${currentYear}.csv`,
        columns: ['Month', 'Orders', 'Total'],
        rows: annualData.map((month) => [
          MONTH_NAMES[month.month - 1] ?? String(month.month),
          month.order_count,
          Number(month.total_amount).toFixed(2),
        ]),
        totalsRow: [
          'Totals',
          annualData.reduce((sum, month) => sum + month.order_count, 0),
          annualData.reduce((sum, month) => sum + Number(month.total_amount ?? 0), 0).toFixed(2),
        ],
      });
      return;
    }

    const periodOrders = ordersForPeriod(group.key);
    downloadCsv({
      filename: `sales-${viewMode}-${group.key}.csv`,
      columns: ['Order #', 'Date', 'Items', 'Total'],
      rows: periodOrders.map((order) => [
        order.transaction_number || `#${order.id}`,
        new Date(orderDateOf(order)).toLocaleString('en-PH'),
        sumOrderQuantity(order),
        Number(order.total_amount ?? 0).toFixed(2),
      ]),
      totalsRow: ['Totals', '', group.items, group.total.toFixed(2)],
    });
  };

  const exportPeriodPdf = async (group: PeriodGroup) => {
    if (viewMode === 'annual' && annualData.length > 0 && !fromDate && !toDate) {
      await downloadPdfTable({
        filename: `sales-annual-${currentYear}.pdf`,
        title: `Annual sales report — ${currentYear}`,
        columns: ['Month', { header: 'Orders', align: 'right' }, { header: 'Total', align: 'right' }],
        rows: annualData.map((month) => [
          MONTH_NAMES[month.month - 1] ?? String(month.month),
          month.order_count,
          formatCurrency(month.total_amount),
        ]),
        totalsRow: [
          'Totals',
          annualData.reduce((sum, month) => sum + month.order_count, 0),
          formatCurrency(annualData.reduce((sum, month) => sum + Number(month.total_amount ?? 0), 0)),
        ],
      });
      return;
    }

    const periodOrders = ordersForPeriod(group.key);
    await downloadPdfTable({
      filename: `sales-${viewMode}-${group.key}.pdf`,
      title: `Sales report — ${group.label}`,
      subtitle: fromDate || toDate ? `Range: ${fromDate || 'start'} to ${toDate || 'today'}` : undefined,
      columns: [
        'Order #',
        'Date',
        { header: 'Items', align: 'right' },
        { header: 'Total', align: 'right' },
      ],
      rows: periodOrders.map((order) => [
        order.transaction_number || `#${order.id}`,
        new Date(orderDateOf(order)).toLocaleString('en-PH'),
        sumOrderQuantity(order),
        formatCurrency(order.total_amount),
      ]),
      totalsRow: ['Totals', '', group.items, formatCurrency(group.total)],
    });
  };

  const exportRangeCsv = () =>
    downloadCsv({
      filename: `sales-report-${fromDate || 'all'}-to-${toDate || 'today'}.csv`,
      columns: ['Order #', 'Date', 'Items', 'Total'],
      rows: completedInRange.map((order) => [
        order.transaction_number || `#${order.id}`,
        new Date(orderDateOf(order)).toLocaleString('en-PH'),
        sumOrderQuantity(order),
        Number(order.total_amount ?? 0).toFixed(2),
      ]),
      totalsRow: ['Totals', '', totals.items, totals.revenue.toFixed(2)],
    });

  const exportRangePdf = () =>
    downloadPdfTable({
      filename: `sales-report-${fromDate || 'all'}-to-${toDate || 'today'}.pdf`,
      title: 'Sales report',
      subtitle: fromDate || toDate ? `${fromDate || 'start'} to ${toDate || 'today'}` : 'All dates',
      columns: [
        'Order #',
        'Date',
        { header: 'Items', align: 'right' },
        { header: 'Total', align: 'right' },
      ],
      rows: completedInRange.map((order) => [
        order.transaction_number || `#${order.id}`,
        new Date(orderDateOf(order)).toLocaleString('en-PH'),
        sumOrderQuantity(order),
        formatCurrency(order.total_amount),
      ]),
      totalsRow: ['Totals', '', totals.items, formatCurrency(totals.revenue)],
    });

  // ------------------------------------------------------------------ columns

  const columns = useMemo<ColumnDef<PeriodGroup>[]>(() => {
    const base: ColumnDef<PeriodGroup>[] = [
      {
        accessorKey: 'label',
        header: 'Period',
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 dark:text-white">{row.original.label}</span>
        ),
      },
      {
        accessorKey: 'orders',
        header: 'Orders',
        cell: ({ row }) => formatNumber(row.original.orders),
        meta: { align: 'right' },
      },
      {
        accessorKey: 'items',
        header: 'Items',
        cell: ({ row }) => formatNumber(row.original.items),
        meta: { align: 'right', hideBelowMd: true },
      },
      {
        accessorKey: 'total',
        header: 'Revenue',
        cell: ({ row }) => (
          <span className="font-semibold text-gray-900 dark:text-white">
            {formatCurrency(row.original.total)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => exportPeriodCsv(row.original)}
              startIcon={<FileDown className="h-3.5 w-3.5" />}
            >
              CSV
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => exportPeriodPdf(row.original)}
              startIcon={<FileText className="h-3.5 w-3.5" />}
            >
              PDF
            </Button>
            <Button size="xs" onClick={() => setDetailPeriod(row.original)}>
              Details
            </Button>
          </div>
        ),
        meta: { align: 'right' },
      },
    ];

    if (viewMode === 'daily') {
      base.unshift({
        accessorKey: 'dayName',
        header: 'Day',
        cell: ({ row }) => (
          <span className="text-gray-600 dark:text-gray-300">{row.original.dayName}</span>
        ),
        meta: { hideBelowMd: true },
      });
    }

    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, completedInRange, annualData, fromDate, toDate]);

  /** Product-level breakdown for the period opened in the modal. */
  const detailProducts = useMemo(() => {
    if (!detailPeriod) return [];
    const aggregate = new Map<string, { name: string; quantity: number; revenue: number }>();

    for (const order of ordersForPeriod(detailPeriod.key)) {
      for (const item of order.order_items ?? order.orderItems ?? []) {
        const name =
          item.product?.product_name ||
          item.product?.name ||
          item.product_name ||
          item.name ||
          `Product #${item.product_id ?? item.id}`;
        const entry = aggregate.get(name) ?? { name, quantity: 0, revenue: 0 };
        entry.quantity += Number(item.quantity ?? 0);
        entry.revenue += Number(item.price ?? 0) * Number(item.quantity ?? 0);
        aggregate.set(name, entry);
      }
    }

    return Array.from(aggregate.values()).sort((a, b) => b.quantity - a.quantity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailPeriod, completedInRange, viewMode]);

  const showSkeleton = useShowSkeleton(ordersQuery.isInitialLoading);
  const hasRange = Boolean(fromDate || toDate);

  return (
    <>
      <PageMeta title="Sales report" />

      <PageHeader
        eyebrow="Reports"
        title="Sales report"
        description="Revenue, orders and items sold grouped by day, week, month or year."
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Sales report' }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              ordersQuery.refresh();
              annualQuery.refresh();
            }}
            loading={ordersQuery.isRefreshing}
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
              label="Revenue"
              tone="success"
              icon={<Wallet className="h-5 w-5" />}
              value={formatCurrency(totals.revenue)}
              hint={hasRange ? 'Selected range' : 'All time'}
            />
            <StatCard
              label="Completed orders"
              tone="brand"
              icon={<Receipt className="h-5 w-5" />}
              value={formatNumber(totals.orders)}
            />
            <StatCard
              label="Items sold"
              tone="info"
              icon={<Package className="h-5 w-5" />}
              value={formatNumber(totals.items)}
            />
            <StatCard
              label="Average basket"
              tone="violet"
              icon={<TrendingUp className="h-5 w-5" />}
              value={formatCurrency(totals.average)}
            />
          </div>
        )}

        <SectionCard
          title="Filters"
          description="Narrow the report to a date range, then export the result."
          icon={<CalendarRange className="h-4 w-4" />}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-md">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  From date
                </span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  To date
                </span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasRange && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                >
                  Clear
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={exportRangeCsv}
                disabled={completedInRange.length === 0}
                startIcon={<FileDown className="h-4 w-4" />}
              >
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={exportRangePdf}
                disabled={completedInRange.length === 0}
                startIcon={<FileText className="h-4 w-4" />}
              >
                Export PDF
              </Button>
            </div>
          </div>

          {hasRange && (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Showing {formatNumber(completedInRange.length)} completed order
              {completedInRange.length === 1 ? '' : 's'} between {fromDate || 'the beginning'} and{' '}
              {toDate || 'today'}.
            </p>
          )}
        </SectionCard>

        <SegmentedTabs<ViewMode>
          aria-label="Report grouping"
          value={viewMode}
          onChange={setViewMode}
          items={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'annual', label: 'Annual' },
          ]}
        />

        <SectionCard
          title="Revenue trend"
          description={`${viewMode === 'annual' ? 'Yearly' : `Last ${chartData.categories.length}`} periods`}
          icon={<BarChart3 className="h-4 w-4" />}
        >
          {showSkeleton ? (
            <SkeletonChart height={240} />
          ) : chartData.values.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<BarChart3 className="h-6 w-6" />}
              title="No sales in this range"
              description="Adjust the date filter to see the revenue trend."
            />
          ) : (
            <div className="max-w-full overflow-x-auto custom-scrollbar">
              <div className="min-w-[560px]">
                <Chart
                  options={chartOptions}
                  series={[{ name: 'Revenue', data: chartData.values }]}
                  type="bar"
                  height={240}
                />
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Breakdown"
          description="Export a period or open it to see which products sold."
          icon={<Receipt className="h-4 w-4" />}
        >
          {showSkeleton ? (
            <SkeletonTable rows={6} columns={5} />
          ) : (
            <DataTable<PeriodGroup>
              data={groups}
              columns={columns}
              error={ordersQuery.error}
              resetPageKey={`${viewMode}-${fromDate}-${toDate}`}
              pageSize={10}
              pageSizeOptions={[10, 25, 50]}
              itemLabel="periods"
              minWidth={820}
              emptyIcon={<Receipt className="h-7 w-7" />}
              emptyTitle="No completed sales found"
              emptyDescription="Confirm orders in the billing queue to populate this report."
            />
          )}
        </SectionCard>
      </div>

      {/* Product breakdown */}
      <Modal isOpen={Boolean(detailPeriod)} onClose={() => setDetailPeriod(null)} className="m-4 max-w-3xl">
        <div className="rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-8">
          <div className="pr-12">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Products sold</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detailPeriod?.label}</p>
          </div>

          <div className="mt-6 max-h-[60vh] overflow-y-auto">
            {detailProducts.length === 0 ? (
              <EmptyState
                size="sm"
                icon={<Package className="h-6 w-6" />}
                title="No products sold"
                description="There were no sales recorded in this period."
              />
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-white/[0.02]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {detailProducts.map((product) => (
                    <tr key={product.name}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {product.name}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                        {formatNumber(product.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(product.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-white/[0.02]">
                  <tr>
                    <td className="px-4 py-3 text-sm font-bold uppercase text-gray-700 dark:text-gray-200">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-brand-600 dark:text-brand-400">
                      {formatNumber(detailProducts.reduce((sum, item) => sum + item.quantity, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-brand-600 dark:text-brand-400">
                      {formatCurrency(detailProducts.reduce((sum, item) => sum + item.revenue, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
