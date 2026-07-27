import { useMemo } from 'react';
import { Link } from 'react-router';
import { Flame, PackageSearch } from 'lucide-react';
import SectionCard from '../ui/card/SectionCard';
import EmptyState from '../ui/empty/EmptyState';
import StatusPill from '../ui/badge/StatusPill';
import Button from '../ui/button/Button';
import { SkeletonTable } from '../ui/skeleton/Skeleton';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useShowSkeleton } from '../../context/AppDataContext';
import { CacheKeys } from '../../lib/dataCache';
import {
  categoryLabel,
  fetchCompletedOrders,
  fetchProducts,
  normalizeImage,
  productName,
  RawOrder,
  RawProduct,
} from '../../lib/apiResources';
import { formatCurrency, formatNumber } from '../../lib/format';

type TopProduct = {
  id: number;
  name: string;
  image: string | null;
  category: string;
  quantitySold: number;
  revenue: number;
};

/** Aggregate completed order line items into a ranked product list. */
function buildTopProducts(orders: RawOrder[], products: RawProduct[], limit: number): TopProduct[] {
  const productsById = new Map<number, RawProduct>();
  for (const product of products) productsById.set(Number(product.id), product);

  const totals = new Map<number, TopProduct>();

  for (const order of orders) {
    const items = order.order_items ?? order.orderItems ?? [];
    for (const item of items) {
      const id = Number(item.product_id ?? item.product?.id ?? item.id);
      if (!Number.isFinite(id)) continue;

      const fromCatalog = productsById.get(id);
      const existing = totals.get(id);
      const entry: TopProduct =
        existing ??
        {
          id,
          name:
            item.product?.product_name ??
            item.product?.name ??
            item.product_name ??
            (fromCatalog ? productName(fromCatalog) : 'Unknown product'),
          image:
            normalizeImage(item.product?.image_url ?? item.product?.image) ??
            (fromCatalog
              ? normalizeImage(fromCatalog.image_url ?? fromCatalog.image ?? fromCatalog.image_path)
              : null),
          category: fromCatalog ? categoryLabel(fromCatalog) : 'Uncategorized',
          quantitySold: 0,
          revenue: 0,
        };

      const quantity = Number(item.quantity ?? 0);
      const price = Number(item.price ?? item.product?.price ?? 0);
      entry.quantitySold += quantity;
      entry.revenue += quantity * price;
      totals.set(id, entry);
    }
  }

  return Array.from(totals.values())
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, limit);
}

/** Ranked best sellers derived from completed orders. */
export default function RecentOrders({ limit = 6 }: { limit?: number }) {
  const orders = useCachedQuery<RawOrder[]>(CacheKeys.completedOrders, fetchCompletedOrders, {
    refreshEvents: ['sale:recorded'],
  });
  const products = useCachedQuery<RawProduct[]>(CacheKeys.products, fetchProducts, {
    refreshEvents: ['products:refresh'],
  });

  const topProducts = useMemo(
    () => buildTopProducts(orders.data ?? [], products.data ?? [], limit),
    [orders.data, products.data, limit]
  );

  const maxQuantity = topProducts[0]?.quantitySold ?? 0;
  const showSkeleton = useShowSkeleton(orders.isInitialLoading, products.isInitialLoading);
  const error = orders.error ?? products.error;

  return (
    <SectionCard
      title="Best selling products"
      description="Ranked by units sold across all completed orders"
      icon={<Flame className="h-4 w-4" />}
      actions={
        <Link to="/reports/sales">
          <Button size="sm" variant="outline">
            View sales report
          </Button>
        </Link>
      }
      flush
    >
      {showSkeleton ? (
        <div className="p-5 sm:p-6">
          <SkeletonTable rows={5} columns={4} />
        </div>
      ) : error ? (
        <div className="p-5 text-sm text-red-600 dark:text-red-400 sm:p-6">{error}</div>
      ) : topProducts.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-7 w-7" />}
          title="No sales recorded yet"
          description="Once orders are confirmed, your best sellers will show up here."
        />
      ) : (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full" style={{ minWidth: 640 }}>
            <thead className="bg-gray-50 dark:bg-white/[0.02]">
              <tr>
                <th
                  scope="col"
                  className="border-b border-gray-200 px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400"
                >
                  Product
                </th>
                <th
                  scope="col"
                  className="hidden border-b border-gray-200 px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400 md:table-cell"
                >
                  Category
                </th>
                <th
                  scope="col"
                  className="border-b border-gray-200 px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400"
                >
                  Units sold
                </th>
                <th
                  scope="col"
                  className="border-b border-gray-200 px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400"
                >
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {topProducts.map((product, index) => (
                <tr key={product.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-white/10 dark:text-gray-400">
                        {index + 1}
                      </span>
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(event) => {
                              (event.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-400">
                            {product.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">
                        {product.name}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-5 py-4 md:table-cell">
                    <StatusPill tone="neutral">{product.category}</StatusPill>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="w-10 shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
                        {formatNumber(product.quantitySold)}
                      </span>
                      <span
                        className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
                        aria-hidden="true"
                      >
                        <span
                          className="block h-full rounded-full bg-brand-500"
                          style={{
                            width: `${maxQuantity ? (product.quantitySold / maxQuantity) * 100 : 0}%`,
                          }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(product.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
