import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import api from '../../lib/axios';
import SectionCard from '../ui/card/SectionCard';
import { SkeletonChart, Skeleton } from '../ui/skeleton/Skeleton';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useShowSkeleton } from '../../context/AppDataContext';
import { CacheKeys } from '../../lib/dataCache';
import { fetchCached } from '../../lib/dataCache';
import { formatCurrency, formatCurrencyCompact } from '../../lib/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fetchMonthlySales = (year: number) =>
  fetchCached<number[]>(CacheKeys.monthlySales(year), async () => {
    const response = await api.get(`/sales/monthly?year=${year}`);
    const data = response?.data?.data;
    return Array.isArray(data) ? data.map((value: any) => Number(value) || 0) : Array(12).fill(0);
  });

/** Monthly revenue bars with a year picker and a running total for the year. */
export default function MonthlySalesChart() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);

  const { data, isInitialLoading, isRefreshing } = useCachedQuery<number[]>(
    CacheKeys.monthlySales(year),
    () => fetchMonthlySales(year),
    { refreshEvents: ['sale:recorded'] }
  );

  const series = useMemo(() => {
    const raw = data ?? Array(12).fill(0);
    // Preserved heuristic: some years are reported in thousands by the API, so
    // very small maxima are scaled up to keep charts comparable year to year.
    const max = raw.length ? Math.max(...raw) : 0;
    const scale = max > 0 && max < 10 ? 1000 : 1;
    return raw.map((value) => Number(value) * scale);
  }, [data]);

  const yearTotal = series.reduce((total, value) => total + value, 0);
  const bestMonthIndex = series.reduce(
    (best, value, index) => (value > series[best] ? index : best),
    0
  );

  const options: ApexOptions = {
    colors: ['#465fff'],
    chart: {
      fontFamily: 'Outfit, sans-serif',
      type: 'bar',
      height: 220,
      toolbar: { show: false },
      animations: { enabled: true, speed: 400 },
    },
    plotOptions: {
      bar: { horizontal: false, columnWidth: '45%', borderRadius: 6, borderRadiusApplication: 'end' },
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 4, colors: ['transparent'] },
    xaxis: {
      categories: MONTHS,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#98a2b3', fontSize: '12px' } },
    },
    legend: { show: false },
    yaxis: {
      labels: {
        style: { colors: '#98a2b3', fontSize: '12px' },
        formatter: (value: number) => formatCurrencyCompact(value),
      },
    },
    grid: {
      borderColor: 'rgba(148, 163, 184, 0.18)',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    fill: { opacity: 1 },
    tooltip: {
      x: { show: true },
      y: { formatter: (value: number) => formatCurrency(value) },
    },
  };

  const showSkeleton = useShowSkeleton(isInitialLoading);

  return (
    <SectionCard
      title="Monthly sales"
      description={
        showSkeleton ? undefined : `${formatCurrency(yearTotal)} total · peak in ${MONTHS[bestMonthIndex]}`
      }
      icon={<BarChart3 className="h-4 w-4" />}
      actions={
        showSkeleton ? (
          <Skeleton className="h-9 w-24 rounded-lg" />
        ) : (
          <div className="flex items-center gap-2">
            {isRefreshing && (
              <span className="text-xs text-gray-400" aria-live="polite">
                Updating…
              </span>
            )}
            <label>
              <span className="sr-only">Year</span>
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-700 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                {Array.from({ length: 5 }).map((_, index) => {
                  const option = currentYear - index;
                  return (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        )
      }
    >
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="min-w-[620px] xl:min-w-full">
          {showSkeleton ? (
            <SkeletonChart height={220} />
          ) : (
            <Chart options={options} series={[{ name: 'Sales', data: series }]} type="bar" height={220} />
          )}
        </div>
      </div>
    </SectionCard>
  );
}
