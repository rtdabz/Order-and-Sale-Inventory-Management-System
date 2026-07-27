import { useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  Boxes,
  CalendarRange,
  Clock,
  FileDown,
  History,
  PackagePlus,
  RefreshCw,
  Wallet,
} from 'lucide-react';

import PageMeta from '../../components/common/PageMeta';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/ui/card/SectionCard';
import StatCard from '../../components/ui/card/StatCard';
import StatusPill from '../../components/ui/badge/StatusPill';
import SegmentedTabs from '../../components/ui/tabs/SegmentedTabs';
import DataTable from '../../components/ui/table/DataTable';
import EmptyState from '../../components/ui/empty/EmptyState';
import Button from '../../components/ui/button/Button';
import { Modal } from '../../components/ui/modal';
import { SkeletonStatCards, SkeletonTable } from '../../components/ui/skeleton/Skeleton';

import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useShowSkeleton } from '../../context/AppDataContext';
import { CacheKeys } from '../../lib/dataCache';
import {
  categoryLabel,
  fetchInventories,
  fetchProducts,
  productName,
  RawInventory,
  RawProduct,
} from '../../lib/apiResources';
import { downloadCsv } from '../../lib/exportData';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getBusinessDayWindow,
  getWeekStartKey,
} from '../../lib/format';

type Tab = 'today' | 'historical';
type ViewMode = 'daily' | 'weekly' | 'monthly' | 'annual';

type StockMovement = {
  id?: number;
  productId: number;
  quantity: number;
  createdAt: string;
  /** True for stock returned by a cancelled order — not a new delivery. */
  isReturn: boolean;
};

type TodayRow = {
  productId: number;
  name: string;
  stockAtOpen: number;
  addedToday: number;
  currentStock: number;
  oldStockRemaining: number;
  price: number;
  value: number;
};

type PeriodProduct = {
  productId: number;
  name: string;
  oldQty: number;
  newQty: number;
  totalQty: number;
  price: number;
  totalValue: number;
};

type PeriodRow = {
  key: string;
  label: string;
  totalQty: number;
  totalValue: number;
  products: PeriodProduct[];
};

const RETURN_TYPES = ['return', 'cancellation'];
const RETURN_SOURCES = ['cancellation', 'order_cancelled'];

function toMovement(row: RawInventory): StockMovement {
  return {
    id: row.id,
    productId: Number(row.product_id ?? row.product?.id ?? row.productId ?? 0),
    quantity: Number(row.quantity ?? row.qty ?? row.amount ?? 0),
    createdAt: String(row.created_at ?? row.date ?? new Date().toISOString()),
    isReturn:
      RETURN_TYPES.includes(String(row.type ?? '')) || RETURN_SOURCES.includes(String(row.source ?? '')),
  };
}

/** Period bucket for a stock movement, per the selected view mode. */
function bucketOf(date: Date, viewMode: ViewMode): { key: string; label: string } {
  if (viewMode === 'daily') {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
    return { key, label: formatDate(key) };
  }
  if (viewMode === 'weekly') {
    const key = getWeekStartKey(date);
    return { key, label: `Week of ${formatDate(key)}` };
  }
  if (viewMode === 'monthly') {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: `${date.toLocaleString('en-PH', { month: 'long' })} ${date.getFullYear()}`,
    };
  }
  return { key: String(date.getFullYear()), label: String(date.getFullYear()) };
}

/** Start and end timestamps for a period key. */
function periodBounds(key: string, viewMode: ViewMode): { start: Date; end: Date } {
  if (viewMode === 'monthly') {
    const [year, month] = key.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (viewMode === 'annual') {
    const year = Number(key);
    return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) };
  }

  const start = new Date(`${key}T00:00:00`);
  const end = new Date(start);
  if (viewMode === 'weekly') end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default function InventoryReport() {
  const [tab, setTab] = useState<Tab>('today');
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [detailPeriod, setDetailPeriod] = useState<PeriodRow | null>(null);

  const productsQuery = useCachedQuery<RawProduct[]>(CacheKeys.products, fetchProducts, {
    refreshEvents: ['products:refresh'],
  });
  const inventoriesQuery = useCachedQuery<RawInventory[]>(CacheKeys.inventories, fetchInventories, {
    refreshEvents: ['products:refresh'],
  });

  const products = productsQuery.data ?? [];
  const movements = useMemo(
    () => (inventoriesQuery.data ?? []).map(toMovement).filter((movement) => movement.quantity > 0),
    [inventoriesQuery.data]
  );

  const movementsByProduct = useMemo(() => {
    const map = new Map<number, StockMovement[]>();
    for (const movement of movements) {
      const list = map.get(movement.productId) ?? [];
      list.push(movement);
      map.set(movement.productId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return map;
  }, [movements]);

  // ------------------------------------------------------- today's summary

  /**
   * Business-day stock picture per product: what was on hand when the day
   * opened at 8 AM versus what has been delivered since.
   */
  const todayRows = useMemo<TodayRow[]>(() => {
    const { start: dayStart } = getBusinessDayWindow();

    return products
      .filter((product) => {
        // Combo meals have no physical inventory of their own.
        const category = categoryLabel(product).toLowerCase();
        const name = productName(product).toLowerCase();
        return category !== 'meals' && !name.includes('combo');
      })
      .map((product) => {
        const productId = Number(product.id);
        const price = Number(product.price ?? 0);
        let stockAtOpen = 0;
        let addedToday = 0;

        for (const movement of movementsByProduct.get(productId) ?? []) {
          const at = new Date(movement.createdAt);
          if (at < dayStart) stockAtOpen += movement.quantity;
          // Returns booked today restore yesterday's stock, so they count as opening stock.
          else if (movement.isReturn) stockAtOpen += movement.quantity;
          else addedToday += movement.quantity;
        }

        const currentStock = stockAtOpen + addedToday;
        return {
          productId,
          name: productName(product),
          stockAtOpen,
          addedToday,
          currentStock,
          oldStockRemaining: Math.min(stockAtOpen, currentStock),
          price,
          value: currentStock * price,
        };
      })
      .filter((row) => row.stockAtOpen > 0 || row.addedToday > 0)
      .sort((a, b) => b.oldStockRemaining - a.oldStockRemaining);
  }, [products, movementsByProduct]);

  const todayTotals = useMemo(
    () =>
      todayRows.reduce(
        (totals, row) => ({
          stockAtOpen: totals.stockAtOpen + row.stockAtOpen,
          addedToday: totals.addedToday + row.addedToday,
          currentStock: totals.currentStock + row.currentStock,
          oldStockRemaining: totals.oldStockRemaining + row.oldStockRemaining,
          value: totals.value + row.value,
        }),
        { stockAtOpen: 0, addedToday: 0, currentStock: 0, oldStockRemaining: 0, value: 0 }
      ),
    [todayRows]
  );

  // ----------------------------------------------------- historical grouping

  /** Opening vs incoming stock for a product inside one period. */
  const stockChange = (productId: number, periodKey: string) => {
    const list = movementsByProduct.get(productId) ?? [];
    if (list.length === 0) return { oldQty: 0, newQty: 0 };

    const { start, end } = periodBounds(periodKey, viewMode);
    let oldQty = 0;
    let newQty = 0;

    for (const movement of list) {
      const at = new Date(movement.createdAt);
      // Annual view starts from zero — we do not carry prior years forward.
      if (at < start) {
        if (viewMode !== 'annual' && !movement.isReturn) oldQty += movement.quantity;
        continue;
      }
      if (at > end) continue;
      if (movement.isReturn) oldQty += movement.quantity;
      else newQty += movement.quantity;
    }

    return { oldQty, newQty };
  };

  const periodRows = useMemo<PeriodRow[]>(() => {
    if (products.length === 0 || movements.length === 0) return [];

    const priceById = new Map<number, number>();
    const nameById = new Map<number, string>();
    for (const product of products) {
      priceById.set(Number(product.id), Number(product.price ?? 0));
      nameById.set(Number(product.id), productName(product));
    }

    const groups = new Map<string, PeriodRow>();

    for (const movement of movements) {
      // Returns are restored stock, not new stock movement for this report.
      if (movement.isReturn) continue;

      const day = movement.createdAt.split('T')[0];
      if (fromDate && day < fromDate) continue;
      if (toDate && day > toDate) continue;

      const at = new Date(movement.createdAt);
      if (Number.isNaN(at.getTime())) continue;

      const { key, label } = bucketOf(at, viewMode);
      const group =
        groups.get(key) ?? { key, label, totalQty: 0, totalValue: 0, products: [] as PeriodProduct[] };
      group.totalQty += movement.quantity;

      if (!group.products.some((entry) => entry.productId === movement.productId)) {
        const { oldQty, newQty } = stockChange(movement.productId, key);
        const price = priceById.get(movement.productId) ?? 0;
        const resolvedNew = newQty > 0 ? newQty : movement.quantity;
        const resolvedOld = viewMode === 'annual' ? 0 : oldQty;
        const totalQty = resolvedOld + resolvedNew;

        group.products.push({
          productId: movement.productId,
          name: nameById.get(movement.productId) ?? `Product #${movement.productId}`,
          oldQty: resolvedOld,
          newQty: resolvedNew,
          totalQty,
          price,
          totalValue: totalQty * price,
        });
      }

      groups.set(key, group);
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        totalValue: group.products.reduce((sum, entry) => sum + entry.totalValue, 0),
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, movements, movementsByProduct, viewMode, fromDate, toDate]);

  // ------------------------------------------------------------------ exports

  const exportToday = () =>
    downloadCsv({
      filename: `todays-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        'Product',
        'Stock at 8am',
        'Added today',
        'Current stock',
        'Old stock left',
        'Unit price',
        'Total value',
      ],
      rows: todayRows.map((row) => [
        row.name,
        row.stockAtOpen,
        row.addedToday,
        row.currentStock,
        row.oldStockRemaining,
        row.price.toFixed(2),
        row.value.toFixed(2),
      ]),
      totalsRow: [
        'Totals',
        todayTotals.stockAtOpen,
        todayTotals.addedToday,
        todayTotals.currentStock,
        todayTotals.oldStockRemaining,
        '',
        todayTotals.value.toFixed(2),
      ],
    });

  const exportPeriods = () => {
    const rows: Array<Array<string | number>> = [];
    let overall = 0;
    for (const period of periodRows) {
      for (const product of period.products) {
        rows.push([
          period.label,
          product.name,
          product.oldQty,
          product.newQty,
          product.totalQty,
          product.price.toFixed(2),
          product.totalValue.toFixed(2),
        ]);
        overall += product.totalValue;
      }
    }

    downloadCsv({
      filename: `inventory-report-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: ['Period', 'Product', 'Old stock', 'New stock', 'Total stock', 'Unit price', 'Total value'],
      rows,
      totalsRow: ['Overall total', '', '', '', '', '', overall.toFixed(2)],
    });
  };

  const exportPeriodDetail = (period: PeriodRow) =>
    downloadCsv({
      filename: `inventory-${period.key}.csv`,
      columns: ['Product', 'Old stock', 'New stock', 'Total stock', 'Unit price', 'Total value'],
      rows: period.products.map((product) => [
        product.name,
        product.oldQty,
        product.newQty,
        product.totalQty,
        product.price.toFixed(2),
        product.totalValue.toFixed(2),
      ]),
      totalsRow: [
        'Total',
        '',
        '',
        '',
        '',
        period.products.reduce((sum, product) => sum + product.totalValue, 0).toFixed(2),
      ],
    });

  // ------------------------------------------------------------------ columns

  const todayColumns = useMemo<ColumnDef<TodayRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Product',
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 dark:text-white">{row.original.name}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.oldStockRemaining > 0 ? (
            <StatusPill tone="warning" dot>
              Carried over
            </StatusPill>
          ) : (
            <StatusPill tone="success" dot>
              New stock
            </StatusPill>
          ),
        meta: { align: 'center' },
      },
      {
        accessorKey: 'stockAtOpen',
        header: 'At 8am',
        cell: ({ row }) => formatNumber(row.original.stockAtOpen),
        meta: { align: 'right' },
      },
      {
        accessorKey: 'addedToday',
        header: 'Added today',
        cell: ({ row }) => (
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            +{formatNumber(row.original.addedToday)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        accessorKey: 'currentStock',
        header: 'Current',
        cell: ({ row }) => (
          <span className="font-semibold text-gray-900 dark:text-white">
            {formatNumber(row.original.currentStock)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        accessorKey: 'oldStockRemaining',
        header: 'Old stock left',
        cell: ({ row }) => (
          <span
            className={
              row.original.oldStockRemaining > 0
                ? 'font-semibold text-amber-600 dark:text-amber-400'
                : 'text-gray-400'
            }
          >
            {formatNumber(row.original.oldStockRemaining)}
          </span>
        ),
        meta: { align: 'right', hideBelowMd: true },
      },
      {
        accessorKey: 'price',
        header: 'Unit price',
        cell: ({ row }) => formatCurrency(row.original.price),
        meta: { align: 'right', hideBelowMd: true },
      },
      {
        accessorKey: 'value',
        header: 'Value',
        cell: ({ row }) => (
          <span className="font-semibold text-gray-900 dark:text-white">
            {formatCurrency(row.original.value)}
          </span>
        ),
        meta: { align: 'right' },
      },
    ],
    []
  );

  const periodColumns = useMemo<ColumnDef<PeriodRow>[]>(
    () => [
      {
        accessorKey: 'label',
        header: 'Period',
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 dark:text-white">{row.original.label}</span>
        ),
      },
      {
        accessorKey: 'totalQty',
        header: 'Items received',
        cell: ({ row }) => formatNumber(row.original.totalQty),
        meta: { align: 'right' },
      },
      {
        id: 'productCount',
        header: 'Products',
        cell: ({ row }) => formatNumber(row.original.products.length),
        meta: { align: 'right', hideBelowMd: true },
      },
      {
        accessorKey: 'totalValue',
        header: 'Stock value',
        cell: ({ row }) => (
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(row.original.totalValue)}
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
              onClick={() => exportPeriodDetail(row.original)}
              startIcon={<FileDown className="h-3.5 w-3.5" />}
            >
              CSV
            </Button>
            <Button size="xs" onClick={() => setDetailPeriod(row.original)}>
              Details
            </Button>
          </div>
        ),
        meta: { align: 'right' },
      },
    ],
    []
  );

  const showSkeleton = useShowSkeleton(
    productsQuery.isInitialLoading || inventoriesQuery.isInitialLoading
  );
  const error = productsQuery.error ?? inventoriesQuery.error;

  return (
    <>
      <PageMeta title="Inventory report" />

      <PageHeader
        eyebrow="Reports"
        title="Inventory report"
        description="Track today's stock movement and review historical deliveries."
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Inventory report' }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              productsQuery.refresh();
              inventoriesQuery.refresh();
            }}
            loading={productsQuery.isRefreshing || inventoriesQuery.isRefreshing}
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
              label="Stock at 8am"
              tone="info"
              icon={<Clock className="h-5 w-5" />}
              value={formatNumber(todayTotals.stockAtOpen)}
              hint="Carried into today's business day"
            />
            <StatCard
              label="Added today"
              tone="success"
              icon={<PackagePlus className="h-5 w-5" />}
              value={formatNumber(todayTotals.addedToday)}
              hint="New deliveries since 8am"
            />
            <StatCard
              label="Current stock"
              tone="brand"
              icon={<Boxes className="h-5 w-5" />}
              value={formatNumber(todayTotals.currentStock)}
              hint={`${formatNumber(todayRows.length)} tracked products`}
            />
            <StatCard
              label="Stock value"
              tone="violet"
              icon={<Wallet className="h-5 w-5" />}
              value={formatCurrency(todayTotals.value)}
            />
          </div>
        )}

        <SegmentedTabs<Tab>
          aria-label="Inventory views"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'today', label: "Today's summary", icon: <Clock className="h-4 w-4" /> },
            { value: 'historical', label: 'Historical', icon: <History className="h-4 w-4" /> },
          ]}
        />

        {error && !showSkeleton && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {tab === 'today' ? (
          <SectionCard
            title="Today's business day"
            description="Business day starts at 8:00 AM. Carried-over stock is highlighted."
            icon={<Clock className="h-4 w-4" />}
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={exportToday}
                disabled={todayRows.length === 0}
                startIcon={<FileDown className="h-4 w-4" />}
              >
                Export CSV
              </Button>
            }
          >
            {showSkeleton ? (
              <SkeletonTable rows={6} columns={7} />
            ) : (
              <DataTable<TodayRow>
                data={todayRows}
                columns={todayColumns}
                pageSize={10}
                pageSizeOptions={[10, 25, 50]}
                itemLabel="products"
                minWidth={960}
                emptyIcon={<Boxes className="h-7 w-7" />}
                emptyTitle="No inventory activity today"
                emptyDescription="Add stock from Stock management to see it here."
              />
            )}
          </SectionCard>
        ) : (
          <SectionCard
            title="Historical stock movement"
            description="Deliveries grouped by period, excluding stock returned by cancellations."
            icon={<History className="h-4 w-4" />}
            toolbar={
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-2xl">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
                      Group by
                    </span>
                    <select
                      value={viewMode}
                      onChange={(event) => setViewMode(event.target.value as ViewMode)}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
                      From
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
                      To
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
                  {(fromDate || toDate) && (
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
                    onClick={exportPeriods}
                    disabled={periodRows.length === 0}
                    startIcon={<FileDown className="h-4 w-4" />}
                  >
                    Export all
                  </Button>
                </div>
              </div>
            }
          >
            {showSkeleton ? (
              <SkeletonTable rows={6} columns={5} />
            ) : (
              <DataTable<PeriodRow>
                data={periodRows}
                columns={periodColumns}
                resetPageKey={`${viewMode}-${fromDate}-${toDate}`}
                pageSize={10}
                pageSizeOptions={[10, 25, 50]}
                itemLabel="periods"
                minWidth={760}
                emptyIcon={<CalendarRange className="h-7 w-7" />}
                emptyTitle="No stock movement in this range"
                emptyDescription="Try widening the date filter or switching the grouping."
              />
            )}
          </SectionCard>
        )}
      </div>

      {/* Period detail */}
      <Modal
        isOpen={Boolean(detailPeriod)}
        onClose={() => setDetailPeriod(null)}
        className="m-4 max-w-4xl"
      >
        <div className="rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-8">
          <div className="pr-12">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Inventory details</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detailPeriod?.label}</p>
          </div>

          <div className="mt-6 max-h-[60vh] overflow-x-auto overflow-y-auto">
            {!detailPeriod || detailPeriod.products.length === 0 ? (
              <EmptyState
                size="sm"
                icon={<Boxes className="h-6 w-6" />}
                title="No products in this period"
              />
            ) : (
              <table className="w-full" style={{ minWidth: 640 }}>
                <thead className="bg-gray-50 dark:bg-white/[0.02]">
                  <tr>
                    {['Product', 'Old stock', 'New stock', 'Total', 'Unit price', 'Value'].map(
                      (header, index) => (
                        <th
                          key={header}
                          className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 ${
                            index === 0 ? 'text-left' : 'text-right'
                          }`}
                        >
                          {header}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {detailPeriod.products.map((product) => (
                    <tr key={product.productId}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {product.name}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                        {formatNumber(product.oldQty)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-brand-600 dark:text-brand-400">
                        {formatNumber(product.newQty)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                        {formatNumber(product.totalQty)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(product.totalValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-white/[0.02]">
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-3 text-sm font-bold uppercase text-gray-700 dark:text-gray-200"
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-brand-600 dark:text-brand-400">
                      {formatCurrency(
                        detailPeriod.products.reduce((sum, product) => sum + product.totalValue, 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              size="sm"
              onClick={() => detailPeriod && exportPeriodDetail(detailPeriod)}
              startIcon={<FileDown className="h-4 w-4" />}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
