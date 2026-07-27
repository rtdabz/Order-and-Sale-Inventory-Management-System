import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  PackagePlus,
  Receipt,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react';
import PageMeta from '../../components/common/PageMeta';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/ui/button/Button';
import SectionCard from '../../components/ui/card/SectionCard';
import StatusPill, { stockStatus } from '../../components/ui/badge/StatusPill';
import EmptyState from '../../components/ui/empty/EmptyState';
import EcommerceMetrics from '../../components/ecommerce/EcommerceMetrics';
import MonthlySalesChart from '../../components/ecommerce/MonthlySalesChart';
import SalesBoard from '../../components/ecommerce/SalesBoard';
import RecentOrders from '../../components/ecommerce/RecentOrders';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useAppData } from '../../context/AppDataContext';
import { CacheKeys } from '../../lib/dataCache';
import {
  buildStockMap,
  fetchCompletedOrders,
  fetchInventories,
  fetchProducts,
  productName,
  RawInventory,
  RawOrder,
  RawProduct,
} from '../../lib/apiResources';
import {
  formatCurrency,
  formatTime,
  isTodayBusinessDay,
  resolveOrderTotal,
  sumOrderQuantity,
} from '../../lib/format';

/** Live clock shown in the page header. */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const QUICK_ACTIONS = [
  {
    to: '/orderpage',
    label: 'Open POS terminal',
    description: 'Ring up a new sale',
    icon: <ShoppingCart className="h-5 w-5" />,
    tone: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
  },
  {
    to: '/transactions',
    label: 'Transactions',
    description: 'Review completed sales',
    icon: <Receipt className="h-5 w-5" />,
    tone: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  },
  {
    to: '/products',
    label: 'Stock management',
    description: 'Add or adjust inventory',
    icon: <PackagePlus className="h-5 w-5" />,
    tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  {
    to: '/inventory',
    label: 'Inventory report',
    description: 'Review stock movement',
    icon: <Boxes className="h-5 w-5" />,
    tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  },
];

export default function Home() {
  const now = useNow();
  const { refreshAll } = useAppData();
  const [refreshing, setRefreshing] = useState(false);

  const salesQuery = useCachedQuery<RawOrder[]>(CacheKeys.completedOrders, fetchCompletedOrders, {
    refreshEvents: ['sale:recorded'],
  });
  const productsQuery = useCachedQuery<RawProduct[]>(CacheKeys.products, fetchProducts, {
    refreshEvents: ['products:refresh'],
  });
  const inventoriesQuery = useCachedQuery<RawInventory[]>(CacheKeys.inventories, fetchInventories, {
    refreshEvents: ['products:refresh'],
  });

  /** Most recent sales, newest first. */
  const recentSales = useMemo(
    () =>
      [...(salesQuery.data ?? [])]
        .sort(
          (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        )
        .slice(0, 6),
    [salesQuery.data]
  );

  const todayCount = useMemo(
    () => (salesQuery.data ?? []).filter((order) => isTodayBusinessDay(order.created_at)).length,
    [salesQuery.data]
  );

  /** Stockable, non-bundle products at or below the low-stock threshold. */
  const lowStockItems = useMemo(() => {
    const products = productsQuery.data ?? [];
    const stockMap = buildStockMap(inventoriesQuery.data ?? []);

    return products
      .filter((product) => {
        if (product.status === 'archived') return false;
        if (product.is_bundle) return false;
        return product.is_stockable !== false && product.is_stockable !== 0;
      })
      .map((product) => ({
        id: Number(product.id),
        name: productName(product),
        quantity: stockMap[Number(product.id)] ?? 0,
      }))
      .filter((item) => item.quantity <= 10)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 6);
  }, [productsQuery.data, inventoriesQuery.data]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <PageMeta title="Dashboard" />

      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Live snapshot of sales and stock for the terminal."
        actions={
          <>
            <div className="mr-1 hidden text-right sm:block">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {now.toLocaleDateString('en-PH', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {now.toLocaleTimeString('en-PH', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              loading={refreshing}
              startIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <EcommerceMetrics />

        {/* Quick actions */}
        <nav aria-label="Quick actions" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-500/40"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.tone}`}
                aria-hidden="true"
              >
                {action.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {action.label}
                </span>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {action.description}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
            </Link>
          ))}
        </nav>

        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <div className="col-span-12 xl:col-span-7">
            <MonthlySalesChart />
          </div>
          <div className="col-span-12 xl:col-span-5">
            <SalesBoard />
          </div>

          {/* Recent transactions */}
          <div className="col-span-12 xl:col-span-7">
            <SectionCard
              title="Recent transactions"
              description={
                todayCount > 0
                  ? `${todayCount} sale${todayCount === 1 ? '' : 's'} so far today`
                  : 'No sales yet today'
              }
              icon={<Receipt className="h-4 w-4" />}
              actions={
                <Link to="/transactions">
                  <Button size="sm" variant="outline" endIcon={<ArrowRight className="h-4 w-4" />}>
                    View all
                  </Button>
                </Link>
              }
              flush
            >
              {recentSales.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={<Receipt className="h-6 w-6" />}
                  title="No transactions yet"
                  description="Completed sales from the POS Terminal will appear here."
                />
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {recentSales.map((order) => (
                    <li
                      key={order.id}
                      className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {order.transaction_number || `#${order.id}`}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(order.created_at)} · {sumOrderQuantity(order)} item(s)
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(resolveOrderTotal(order))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* Low stock */}
          <div className="col-span-12 xl:col-span-5">
            <SectionCard
              title="Stock alerts"
              description="Items at or below the low-stock threshold"
              icon={<AlertTriangle className="h-4 w-4" />}
              actions={
                <Link to="/products">
                  <Button size="sm" variant="outline" endIcon={<ArrowRight className="h-4 w-4" />}>
                    Manage
                  </Button>
                </Link>
              }
              flush
            >
              {lowStockItems.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={<Boxes className="h-6 w-6" />}
                  title="Stock levels look healthy"
                  description="Nothing is running low right now."
                />
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {lowStockItems.map((item) => {
                    const status = stockStatus(item.quantity);
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6"
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            {item.quantity}
                          </span>
                          <StatusPill tone={status.tone} dot>
                            {status.label}
                          </StatusPill>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          </div>

          <div className="col-span-12">
            <RecentOrders />
          </div>
        </div>
      </div>
    </>
  );
}
