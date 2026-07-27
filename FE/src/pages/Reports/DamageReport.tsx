import { useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  AlertTriangle,
  FileDown,
  PackageX,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Wallet,
} from 'lucide-react';

import PageMeta from '../../components/common/PageMeta';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/ui/card/SectionCard';
import StatCard from '../../components/ui/card/StatCard';
import StatusPill, { StatusTone } from '../../components/ui/badge/StatusPill';
import SearchInput from '../../components/ui/input/SearchInput';
import DataTable from '../../components/ui/table/DataTable';
import Button from '../../components/ui/button/Button';
import { SkeletonStatCards, SkeletonTable } from '../../components/ui/skeleton/Skeleton';

import api from '../../lib/axios';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useShowSkeleton } from '../../context/AppDataContext';
import { CacheKeys, fetchCached } from '../../lib/dataCache';
import { unwrapList } from '../../lib/apiResources';
import { downloadCsv } from '../../lib/exportData';
import { formatCurrency, formatDate, formatNumber } from '../../lib/format';

type Damage = {
  id: number;
  product_id: number;
  product?: { id: number; product_name?: string; name?: string; price?: number };
  quantity: number;
  cost_per_unit: number;
  reason?: string;
  action_taken?: string;
  notes?: string;
  created_at: string;
};

type DamageByProduct = {
  product_id: number;
  product_name: string;
  total_damaged_quantity: number;
  total_damage_cost: number;
  records_count: number;
};

type DamageSummary = {
  total_damages_recorded: number;
  total_damage_cost: number;
  damages_by_product: DamageByProduct[];
};

const ACTION_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  write_off: { label: 'Write-off', tone: 'danger' },
  return_to_supplier: { label: 'Returned', tone: 'info' },
};

const describeAction = (action?: string) =>
  ACTION_LABELS[action ?? 'write_off'] ?? ACTION_LABELS.write_off;

const fetchDamages = () =>
  fetchCached<Damage[]>(CacheKeys.damages, async () => unwrapList<Damage>((await api.get('/damages')).data));

const fetchDamageSummary = () =>
  fetchCached<DamageSummary>(CacheKeys.damageSummary, async () => {
    const response = await api.get('/damages/report/summary');
    return (
      response.data ?? { total_damages_recorded: 0, total_damage_cost: 0, damages_by_product: [] }
    );
  });

export default function DamageReport() {
  const [search, setSearch] = useState('');

  const damagesQuery = useCachedQuery<Damage[]>(CacheKeys.damages, fetchDamages, {
    refreshEvents: ['products:refresh', 'damages:refresh'],
  });
  const summaryQuery = useCachedQuery<DamageSummary>(CacheKeys.damageSummary, fetchDamageSummary, {
    refreshEvents: ['products:refresh', 'damages:refresh'],
  });

  const damages = damagesQuery.data ?? [];
  const summary = summaryQuery.data;
  const byProduct = summary?.damages_by_product ?? [];

  const stats = useMemo(() => {
    const unitsDamaged = byProduct.reduce((sum, item) => sum + item.total_damaged_quantity, 0);
    let writeOffs = 0;
    let returns = 0;
    for (const damage of damages) {
      if ((damage.action_taken ?? 'write_off') === 'return_to_supplier') returns += 1;
      else writeOffs += 1;
    }
    return {
      incidents: summary?.total_damages_recorded ?? damages.length,
      unitsDamaged,
      cost: Number(summary?.total_damage_cost ?? 0),
      writeOffs,
      returns,
    };
  }, [byProduct, damages, summary]);

  const productColumns = useMemo<ColumnDef<DamageByProduct>[]>(
    () => [
      {
        accessorKey: 'product_name',
        header: 'Product',
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 dark:text-white">
            {row.original.product_name}
          </span>
        ),
      },
      {
        accessorKey: 'total_damaged_quantity',
        header: 'Units damaged',
        cell: ({ row }) => (
          <StatusPill tone="warning">{formatNumber(row.original.total_damaged_quantity)} units</StatusPill>
        ),
        meta: { align: 'center' },
      },
      {
        id: 'unit_cost',
        header: 'Cost per unit',
        cell: ({ row }) => {
          const { total_damage_cost: cost, total_damaged_quantity: quantity } = row.original;
          return formatCurrency(quantity > 0 ? cost / quantity : 0);
        },
        meta: { align: 'right', hideBelowMd: true },
      },
      {
        accessorKey: 'total_damage_cost',
        header: 'Total cost',
        cell: ({ row }) => (
          <span className="font-semibold text-red-600 dark:text-red-400">
            {formatCurrency(row.original.total_damage_cost)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        accessorKey: 'records_count',
        header: 'Incidents',
        cell: ({ row }) => formatNumber(row.original.records_count),
        meta: { align: 'center' },
      },
    ],
    []
  );

  const incidentColumns = useMemo<ColumnDef<Damage>[]>(
    () => [
      {
        id: 'product',
        header: 'Product',
        accessorFn: (row) => row.product?.product_name ?? row.product?.name ?? `#${row.product_id}`,
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 dark:text-white">
            {row.original.product?.product_name ??
              row.original.product?.name ??
              `Product #${row.original.product_id}`}
          </span>
        ),
      },
      {
        accessorKey: 'quantity',
        header: 'Quantity',
        cell: ({ row }) => <StatusPill tone="danger">{row.original.quantity}</StatusPill>,
        meta: { align: 'center' },
      },
      {
        accessorKey: 'reason',
        header: 'Reason',
        cell: ({ row }) => (
          <span className="text-gray-600 dark:text-gray-300">{row.original.reason || '—'}</span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Date',
        cell: ({ row }) => formatDate(row.original.created_at),
        meta: { align: 'center', hideBelowMd: true },
      },
      {
        accessorKey: 'action_taken',
        header: 'Action',
        cell: ({ row }) => {
          const action = describeAction(row.original.action_taken);
          return <StatusPill tone={action.tone}>{action.label}</StatusPill>;
        },
        meta: { align: 'center' },
      },
      {
        id: 'cost',
        header: 'Cost',
        accessorFn: (row) => Number(row.cost_per_unit) * Number(row.quantity),
        cell: ({ row }) => (
          <span className="font-semibold text-red-600 dark:text-red-400">
            {formatCurrency(Number(row.original.cost_per_unit) * Number(row.original.quantity))}
          </span>
        ),
        meta: { align: 'right' },
      },
    ],
    []
  );

  const exportCsv = () =>
    downloadCsv({
      filename: `damage-report-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: ['Product', 'Units damaged', 'Cost per unit', 'Total cost', 'Incidents'],
      rows: byProduct.map((item) => [
        item.product_name,
        item.total_damaged_quantity,
        (item.total_damaged_quantity > 0
          ? item.total_damage_cost / item.total_damaged_quantity
          : 0
        ).toFixed(2),
        Number(item.total_damage_cost).toFixed(2),
        item.records_count,
      ]),
      totalsRow: ['Totals', stats.unitsDamaged, '', stats.cost.toFixed(2), stats.incidents],
    });

  const showSkeleton = useShowSkeleton(damagesQuery.isInitialLoading || summaryQuery.isInitialLoading);
  const error = damagesQuery.error ?? summaryQuery.error;

  return (
    <>
      <PageMeta title="Damage report" />

      <PageHeader
        eyebrow="Reports"
        title="Damage report"
        description="Stock losses by product, with the action taken for each incident."
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Damage report' }]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                damagesQuery.refresh();
                summaryQuery.refresh();
              }}
              loading={damagesQuery.isRefreshing || summaryQuery.isRefreshing}
              startIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={exportCsv}
              disabled={byProduct.length === 0}
              startIcon={<FileDown className="h-4 w-4" />}
            >
              Export CSV
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {showSkeleton ? (
          <SkeletonStatCards count={4} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Incidents"
              tone="brand"
              icon={<ShieldAlert className="h-5 w-5" />}
              value={formatNumber(stats.incidents)}
              hint="Recorded damage reports"
            />
            <StatCard
              label="Units damaged"
              tone="warning"
              icon={<PackageX className="h-5 w-5" />}
              value={formatNumber(stats.unitsDamaged)}
            />
            <StatCard
              label="Total loss"
              tone="danger"
              icon={<Wallet className="h-5 w-5" />}
              value={formatCurrency(stats.cost)}
            />
            <StatCard
              label="Write-offs / returns"
              tone="violet"
              icon={<RotateCcw className="h-5 w-5" />}
              value={`${formatNumber(stats.writeOffs)} / ${formatNumber(stats.returns)}`}
              hint="Salary deduction vs supplier return"
            />
          </div>
        )}

        {error && !showSkeleton && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <SectionCard
          title="Loss by product"
          description="Which products account for the most shrinkage."
          icon={<AlertTriangle className="h-4 w-4" />}
        >
          {showSkeleton ? (
            <SkeletonTable rows={5} columns={5} />
          ) : (
            <DataTable<DamageByProduct>
              data={byProduct}
              columns={productColumns}
              initialSorting={[{ id: 'total_damage_cost', desc: true }]}
              pageSize={10}
              pageSizeOptions={[10, 25, 50]}
              itemLabel="products"
              minWidth={760}
              emptyIcon={<PackageX className="h-7 w-7" />}
              emptyTitle="No damage recorded"
              emptyDescription="Damage incidents logged from Stock management appear here."
            />
          )}
        </SectionCard>

        <SectionCard
          title="All incidents"
          description="Every individual damage record."
          icon={<ShieldAlert className="h-4 w-4" />}
          toolbar={
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by product or reason…"
              className="w-full sm:max-w-md"
            />
          }
        >
          {showSkeleton ? (
            <SkeletonTable rows={5} columns={6} />
          ) : (
            <DataTable<Damage>
              data={damages}
              columns={incidentColumns}
              globalFilter={search}
              globalFilterFn={(row, needle) =>
                `${row.product?.product_name ?? ''} ${row.product?.name ?? ''} ${row.reason ?? ''} ${
                  describeAction(row.action_taken).label
                }`
                  .toLowerCase()
                  .includes(needle.trim().toLowerCase())
              }
              initialSorting={[{ id: 'created_at', desc: true }]}
              pageSize={10}
              pageSizeOptions={[10, 25, 50]}
              itemLabel="incidents"
              minWidth={820}
              emptyIcon={<ShieldAlert className="h-7 w-7" />}
              emptyTitle={search ? 'No incidents match your search' : 'No incidents recorded'}
            />
          )}
        </SectionCard>
      </div>
    </>
  );
}
