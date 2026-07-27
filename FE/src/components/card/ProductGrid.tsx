import React, { useEffect, useMemo, useState } from 'react';
import { PackageSearch } from 'lucide-react';
import ProductCard from './ProductCard';
import EmptyState from '../ui/empty/EmptyState';
import Pagination from '../ui/pagination/Pagination';
import { SkeletonProductGrid } from '../ui/skeleton/Skeleton';
import { useOrders } from '../../context/OrderContext';
import { useShowSkeleton } from '../../context/AppDataContext';
import { usePosCatalog } from '../../hooks/usePosCatalog';

export type ProductGridProps = {
  /** Items per page. 30 fills a 6-column grid six rows deep. */
  itemsPerPage?: number;
};

/**
 * The main POS catalog grid.
 *
 * Search and category filtering arrive as window events (`products:search`,
 * `products:filterCategory`) so the toolbar can live in the page header while
 * the grid stays self-contained.
 */
const ProductGrid: React.FC<ProductGridProps> = ({ itemsPerPage = 24 }) => {
  const { addToOrder, orders } = useOrders();
  const [failedImageIds, setFailedImageIds] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const catalog = usePosCatalog(orders);

  // Toolbar events from the POS page header.
  useEffect(() => {
    const onSearch = (event: Event) => {
      const detail = (event as CustomEvent)?.detail ?? {};
      setQuery(String(detail.query ?? '').trim());
    };

    const onCategory = (event: Event) => {
      const detail = (event as CustomEvent)?.detail ?? {};
      const category = String(detail.category ?? '').trim();
      const label = String(detail.label ?? '').trim();
      setActiveCategory(category === 'all' || category === '' ? null : category);
      setActiveCategoryLabel(label === '' ? null : label.toLowerCase());
    };

    window.addEventListener('products:search', onSearch as EventListener);
    window.addEventListener('products:filterCategory', onCategory as EventListener);
    return () => {
      window.removeEventListener('products:search', onSearch as EventListener);
      window.removeEventListener('products:filterCategory', onCategory as EventListener);
    };
  }, []);

  // Retry broken images shortly after they fail (covers storage-link fixes).
  useEffect(() => {
    if (failedImageIds.size === 0) return;
    const timer = setTimeout(() => setFailedImageIds(new Set()), 3000);
    return () => clearTimeout(timer);
  }, [failedImageIds]);

  const filteredProducts = useMemo(() => {
    const needle = query.toLowerCase();
    const label = (activeCategoryLabel ?? '').toLowerCase();

    return catalog.products.filter((product) => {
      if (catalog.isHiddenFromCatalog(product)) return false;

      if (needle) {
        const matches =
          product.product_name.toLowerCase().includes(needle) ||
          product.category_label.toLowerCase().includes(needle);
        if (!matches) return false;
      }

      if (!activeCategory) return true;
      if (product.category_id && product.category_id === activeCategory) return true;
      if (label && product.category_label.toLowerCase() === label) return true;
      return false;
    });
  }, [catalog, query, activeCategory, activeCategoryLabel]);

  useEffect(() => {
    setPageIndex(0);
  }, [query, activeCategory]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const visibleProducts = filteredProducts.slice(
    pageIndex * itemsPerPage,
    (pageIndex + 1) * itemsPerPage
  );

  const showSkeleton = useShowSkeleton(catalog.isInitialLoading);
  if (showSkeleton) return <SkeletonProductGrid count={12} />;

  if (catalog.error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
        {catalog.error}
      </div>
    );
  }

  if (filteredProducts.length === 0) {
    return (
      <EmptyState
        icon={<PackageSearch className="h-7 w-7" />}
        title={query || activeCategory ? 'No products match this filter' : 'No products available'}
        description={
          query || activeCategory
            ? 'Try a different search term or pick another category.'
            : 'Add products from Stock management to start selling.'
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {visibleProducts.map((product) => {
          const availableStock = catalog.getSellableStock(product);
          const image = failedImageIds.has(product.id) ? null : product.image;

          return (
            <ProductCard
              key={product.id}
              product={{ ...product, image }}
              availableStock={availableStock}
              isRiceUnavailable={catalog.containsArchivedIngredient(product)}
              onImageError={(productId) =>
                setFailedImageIds((current) => new Set(Array.from(current).concat([productId])))
              }
              onAddToCart={(_productId, quantity) => {
                const item = {
                  id: product.id,
                  productName: product.product_name,
                  category: product.category_label,
                  category_id: product.category_id || undefined,
                  price: product.price,
                  image: product.image ?? '',
                  // On-hand stock (not the cart-adjusted figure): OrderContext
                  // uses this as the absolute ceiling for the line quantity.
                  stock: product.stock,
                  is_bundle: product.is_bundle,
                  is_stockable: product.is_stockable,
                };
                addToOrder(item, quantity);
              }}
            />
          );
        })}
      </div>

      {filteredProducts.length > itemsPerPage && (
        <Pagination
          pageIndex={pageIndex}
          pageCount={pageCount}
          onPageChange={setPageIndex}
          totalItems={filteredProducts.length}
          pageSize={itemsPerPage}
          itemLabel="products"
        />
      )}
    </div>
  );
};

export default ProductGrid;
