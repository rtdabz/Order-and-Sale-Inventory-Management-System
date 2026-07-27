import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { useMemo } from 'react';
import { Target } from 'lucide-react';
import SectionCard from '../ui/card/SectionCard';
import { Skeleton } from '../ui/skeleton/Skeleton';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useShowSkeleton } from '../../context/AppDataContext';
import { CacheKeys } from '../../lib/dataCache';
import { fetchCompletedOrders, RawOrder } from '../../lib/apiResources';
import {
  formatCurrency,
  formatCurrencyCompact,
  getBusinessDayWindow,
  resolveOrderTotal,
} from '../../lib/format';

/** Annual target used to fill the progress arc. */
const ANNUAL_TARGET = 100_000;

type SalesTotals = { annual: number; monthly: number; weekly: number; today: number };

function computeTotals(orders: RawOrder[]): SalesTotals {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);

  const { start: businessDayStart, end: businessDayEnd } = getBusinessDayWindow(now);

  const totals: SalesTotals = { annual: 0, monthly: 0, weekly: 0, today: 0 };

  for (const order of orders) {
    const raw = order.sale?.sale_date || order.order_date || order.created_at;
    const date = new Date(raw ?? '');
    if (Number.isNaN(date.getTime())) continue;

    const amount = Number(order.total_amount ?? order.sale?.total_amount ?? 0) || resolveOrderTotal(order);

    if (date >= startOfYear) totals.annual += amount;
    if (date >= startOfMonth) totals.monthly += amount;
    if (date >= startOfWeek) totals.weekly += amount;
    if (date >= businessDayStart && date < businessDayEnd) totals.today += amount;
  }

  return totals;
}

/** Annual sales progress plus today/week/month breakdown. */
export default function SalesBoard() {
  const { data, isInitialLoading } = useCachedQuery<RawOrder[]>(
    CacheKeys.completedOrders,
    fetchCompletedOrders,
    { refreshEvents: ['sale:recorded'] }
  );

  const totals = useMemo(() => computeTotals(data ?? []), [data]);
  const progress = Math.min((totals.annual / ANNUAL_TARGET) * 100, 100);

  const options: ApexOptions = {
    colors: ['#465FFF'],
    chart: {
      fontFamily: 'Outfit, sans-serif',
      type: 'radialBar',
      height: 300,
      sparkline: { enabled: true },
    },
    plotOptions: {
      radialBar: {
        startAngle: -110,
        endAngle: 110,
        hollow: { size: '72%' },
        track: { background: 'rgba(148, 163, 184, 0.2)', strokeWidth: '100%', margin: 6 },
        dataLabels: {
          name: { show: false },
          value: {
            fontSize: '30px',
            fontWeight: '700',
            offsetY: -12,
            color: '#465FFF',
            formatter: () => formatCurrencyCompact(totals.annual),
          },
        },
      },
    },
    fill: { type: 'solid', colors: ['#465FFF'] },
    stroke: { lineCap: 'round' },
    labels: ['Annual sales'],
  };

  const showSkeleton = useShowSkeleton(isInitialLoading);

  const breakdown = [
    { label: 'Today', value: totals.today },
    { label: 'This week', value: totals.weekly },
    { label: 'This month', value: totals.monthly },
  ];

  return (
    <SectionCard
      title="Annual sales"
      description="Revenue booked this year against target"
      icon={<Target className="h-4 w-4" />}
      className="h-full"
      footer={
        showSkeleton ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <dl className="grid grid-cols-3 gap-4">
            {breakdown.map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="truncate text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {item.label}
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {formatCurrencyCompact(item.value)}
                </dd>
              </div>
            ))}
          </dl>
        )
      }
    >
      {showSkeleton ? (
        <div className="flex flex-col items-center gap-6 py-4">
          <Skeleton className="h-40 w-40 rounded-full" />
          <Skeleton className="h-3.5 w-48" />
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[320px]">
            <Chart options={options} series={[progress]} type="radialBar" height={300} />
          </div>
          <p className="-mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {progress >= 100 ? (
              <>Annual target reached. Outstanding work.</>
            ) : (
              <>
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  {progress.toFixed(1)}%
                </span>{' '}
                of the {formatCurrencyCompact(ANNUAL_TARGET)} target ·{' '}
                {formatCurrency(totals.today)} earned today
              </>
            )}
          </p>
        </div>
      )}
    </SectionCard>
  );
}
