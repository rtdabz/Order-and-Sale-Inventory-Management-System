import { useMemo, useState } from 'react';
import { Banknote, Receipt, ShoppingBasket, TrendingUp } from 'lucide-react';
import StatCard from '../ui/card/StatCard';
import { SkeletonStatCards } from '../ui/skeleton/Skeleton';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useShowSkeleton } from '../../context/AppDataContext';
import { CacheKeys } from '../../lib/dataCache';
import { fetchCompletedOrders, RawOrder } from '../../lib/apiResources';
import {
  formatCurrency,
  formatNumber,
  getWeekStartKey,
  isTodayBusinessDay,
  resolveOrderTotal,
  sumOrderQuantity,
} from '../../lib/format';

type TimePeriod = 'day' | 'week' | 'month' | 'year';

const PERIOD_OPTIONS: Array<{ value: TimePeriod; label: string }> = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

const PERIOD_HINT: Record<TimePeriod, string> = {
  day: "Today's business day (8am–2am)",
  week: 'Week to date',
  month: 'Month to date',
  year: 'Year to date',
};

/** Inline period switcher rendered inside a KPI tile. */
function PeriodSelect({
  value,
  onChange,
  label,
}: {
  value: TimePeriod;
  onChange: (value: TimePeriod) => void;
  label: string;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as TimePeriod)}
        className="h-8 py-0 cursor-pointer rounded-lg border border-gray-200 bg-white px-2 text-xs font-medium text-gray-600 transition hover:border-gray-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
      >
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Does an order fall inside the selected period? */
function matchesPeriod(order: RawOrder, period: TimePeriod, now: Date): boolean {
  const raw = order.order_date || order.created_at;
  if (!raw) return false;
  if (period === 'day') return isTodayBusinessDay(raw);

  const dateOnly = String(raw).split('T')[0];
  if (period === 'week') {
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    return getWeekStartKey(dateOnly) === getWeekStartKey(todayKey);
  }
  if (period === 'month') {
    return dateOnly.slice(0, 7) === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return dateOnly.slice(0, 4) === String(now.getFullYear());
}

/**
 * Top-of-dashboard KPI strip. Reads the shared completed-orders cache, so it
 * renders instantly on every visit after the initial load.
 */
export default function EcommerceMetrics() {
  const [itemsPeriod, setItemsPeriod] = useState<TimePeriod>('day');
  const [ordersPeriod, setOrdersPeriod] = useState<TimePeriod>('day');

  const { data, isInitialLoading } = useCachedQuery<RawOrder[]>(
    CacheKeys.completedOrders,
    fetchCompletedOrders,
    { refreshEvents: ['sale:recorded'] }
  );

  const orders = data ?? [];

  const itemsSold = useMemo(() => {
    const now = new Date();
    return orders.reduce(
      (total, order) => (matchesPeriod(order, itemsPeriod, now) ? total + sumOrderQuantity(order) : total),
      0
    );
  }, [orders, itemsPeriod]);

  const orderStats = useMemo(() => {
    const now = new Date();
    const matched = orders.filter((order) => matchesPeriod(order, ordersPeriod, now));
    const revenue = matched.reduce((total, order) => total + resolveOrderTotal(order), 0);
    return {
      count: matched.length,
      revenue,
      average: matched.length > 0 ? revenue / matched.length : 0,
    };
  }, [orders, ordersPeriod]);

  const showSkeleton = useShowSkeleton(isInitialLoading);
  if (showSkeleton) return <SkeletonStatCards count={4} />;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Revenue"
        tone="success"
        icon={<Banknote className="h-5 w-5" />}
        value={formatCurrency(orderStats.revenue)}
        hint={PERIOD_HINT[ordersPeriod]}
        badge={
          <PeriodSelect value={ordersPeriod} onChange={setOrdersPeriod} label="Revenue period" />
        }
      />
      <StatCard
        label="Completed orders"
        tone="brand"
        icon={<Receipt className="h-5 w-5" />}
        value={formatNumber(orderStats.count)}
        hint={PERIOD_HINT[ordersPeriod]}
      />
      <StatCard
        label="Items sold"
        tone="info"
        icon={<ShoppingBasket className="h-5 w-5" />}
        value={formatNumber(itemsSold)}
        hint={PERIOD_HINT[itemsPeriod]}
        badge={<PeriodSelect value={itemsPeriod} onChange={setItemsPeriod} label="Items period" />}
      />
      <StatCard
        label="Average basket"
        tone="violet"
        icon={<TrendingUp className="h-5 w-5" />}
        value={formatCurrency(orderStats.average)}
        hint={
          orderStats.count > 0
            ? `Across ${formatNumber(orderStats.count)} orders`
            : 'No orders in this period'
        }
      />
    </div>
  );
}
