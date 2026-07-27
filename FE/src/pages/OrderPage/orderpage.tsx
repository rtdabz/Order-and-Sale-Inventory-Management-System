import { useEffect, useMemo, useRef, useState } from 'react';
import { Flame, RefreshCw, ShoppingCart, UtensilsCrossed } from 'lucide-react';

import PageMeta from '../../components/common/PageMeta';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/ui/card/SectionCard';
import SearchInput from '../../components/ui/input/SearchInput';
import Button from '../../components/ui/button/Button';
import EmptyState from '../../components/ui/empty/EmptyState';
import { Skeleton, SkeletonProductGrid } from '../../components/ui/skeleton/Skeleton';
import ProductCard from '../../components/card/ProductCard';
import ProductGrid from '../../components/card/ProductGrid';
import PosCart from '../../components/pos/PosCart';
import PosCartDrawer from '../../components/pos/PosCartDrawer';

import { useOrders } from '../../context/OrderContext';
import { useShowSkeleton } from '../../context/AppDataContext';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { usePosCatalog, CatalogProduct } from '../../hooks/usePosCatalog';
import { CacheKeys } from '../../lib/dataCache';
import { fetchBestSellers, fetchCategories, RawCategory, RawProduct } from '../../lib/apiResources';
import { formatCurrency, formatNumber } from '../../lib/format';
import { cn } from '../../lib/utils';

const ALL_CATEGORIES = 'all';

type CategoryOption = { id: string; label: string };

export default function OrderPage() {
  const { orders, addToOrder } = useOrders();
  const catalog = usePosCatalog(orders);

  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const searchRef = useRef<HTMLDivElement>(null);

  const categoriesQuery = useCachedQuery<RawCategory[]>(CacheKeys.categories, fetchCategories);
  const bestSellersQuery = useCachedQuery<RawProduct[]>(CacheKeys.bestSellers, fetchBestSellers, {
    refreshEvents: ['products:refresh'],
  });

  const itemCount = orders.reduce((sum, order) => sum + order.quantity, 0);
  const cartTotal = orders.reduce((sum, order) => sum + order.price * order.quantity, 0);

  /** "Meals" first — it is the category cashiers reach for most. */
  const categories = useMemo<CategoryOption[]>(() => {
    const mapped = (categoriesQuery.data ?? []).map((category) => ({
      id: String(category.id),
      label: category.category_name ?? category.name ?? `#${category.id}`,
    }));
    mapped.sort((a, b) => {
      if (a.label.toLowerCase() === 'meals') return -1;
      if (b.label.toLowerCase() === 'meals') return 1;
      return a.label.localeCompare(b.label);
    });
    return [{ id: ALL_CATEGORIES, label: 'All' }, ...mapped];
  }, [categoriesQuery.data]);

  // The grid listens on the window so the toolbar can live up here.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('products:search', { detail: { query: search } }));
  }, [search]);

  const selectCategory = (option: CategoryOption) => {
    const next = activeCategory === option.id ? ALL_CATEGORIES : option.id;
    setActiveCategory(next);
    window.dispatchEvent(
      new CustomEvent('products:filterCategory', {
        detail: { category: next, label: next === ALL_CATEGORIES ? '' : option.label },
      })
    );
  };

  // Press "/" anywhere to jump to the product search.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      event.preventDefault();
      searchRef.current?.querySelector('input')?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /** Best sellers, enriched with live stock from the shared catalog. */
  const bestSellers = useMemo<CatalogProduct[]>(() => {
    const ranked = bestSellersQuery.data ?? [];
    return ranked
      .map((product) => catalog.products.find((item) => item.id === Number(product.id)))
      .filter((product): product is CatalogProduct => Boolean(product))
      .filter((product) => !catalog.isHiddenFromCatalog(product))
      .slice(0, 12);
  }, [bestSellersQuery.data, catalog]);

  const meals = useMemo<CatalogProduct[]>(
    () =>
      catalog.products.filter(
        (product) =>
          product.category_label.toLowerCase() === 'meals' && !catalog.isHiddenFromCatalog(product)
      ),
    [catalog]
  );

  const showSkeleton = useShowSkeleton(catalog.isInitialLoading);
  const showFeatured = activeCategory === ALL_CATEGORIES && !search.trim();

  /** Shared add-to-cart handler for the featured rows. */
  const addProduct = (product: CatalogProduct, quantity: number) => {
    const item: Parameters<typeof addToOrder>[0] = {
      id: product.id,
      productName: product.product_name,
      category: product.category_label,
      category_id: product.category_id || undefined,
      price: product.price,
      image: product.image ?? '',
      stock: product.stock,
      is_bundle: product.is_bundle,
      is_stockable: product.is_stockable,
    };
    addToOrder(item, quantity);
  };

  return (
    <>
      <PageMeta title="POS Terminal" />

      <PageHeader
        eyebrow="Point of sale"
        title="POS Terminal"
        description="Tap a product to add it, then take payment on the right."
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'POS Terminal' }]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => catalog.refresh()}
              loading={catalog.isRefreshing}
              startIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh stock
            </Button>
            <Button
              size="sm"
              className="xl:hidden"
              onClick={() => setCartOpen(true)}
              startIcon={<ShoppingCart className="h-4 w-4" />}
            >
              Cart · {formatNumber(itemCount)} · {formatCurrency(cartTotal)}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* Catalog */}
        <div className="col-span-12 space-y-5 xl:col-span-8 2xl:col-span-9">
          <SectionCard
            title="Browse products"
            description="Filter by category or search the whole catalog."
            bodyClassName="space-y-4"
          >
            <div ref={searchRef}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search products or categories…"
                hint="/"
                aria-label="Search products"
              />
            </div>

            {categoriesQuery.isInitialLoading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-24 rounded-full" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Product categories">
                {categories.map((option) => {
                  const isActive = activeCategory === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => selectCategory(option)}
                      aria-pressed={isActive}
                      className={cn(
                        'rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'border-brand-500 bg-brand-500 text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-brand-500/40'
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Best sellers */}
          {showFeatured && (
            <SectionCard
              title="Best sellers"
              description="Your fastest-moving items"
              icon={<Flame className="h-4 w-4" />}
            >
              {showSkeleton || bestSellersQuery.isInitialLoading ? (
                <div className="flex gap-3 overflow-hidden">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-64 w-44 shrink-0 rounded-2xl" />
                  ))}
                </div>
              ) : bestSellers.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={<Flame className="h-6 w-6" />}
                  title="No best sellers yet"
                  description="Rankings appear once orders have been completed."
                />
              ) : (
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 custom-scrollbar">
                  {bestSellers.map((product) => (
                    <div key={product.id} className="w-44 shrink-0">
                      <ProductCard
                        product={product}
                        badge="Top"
                        availableStock={catalog.getSellableStock(product)}
                        isRiceUnavailable={catalog.containsArchivedIngredient(product)}
                        onAddToCart={(_id, quantity) => addProduct(product, quantity)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* Meals */}
          {showFeatured && (
            <SectionCard
              title="Meals"
              description="Combo meals and kitchen orders"
              icon={<UtensilsCrossed className="h-4 w-4" />}
            >
              {showSkeleton ? (
                <SkeletonProductGrid count={5} />
              ) : meals.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={<UtensilsCrossed className="h-6 w-6" />}
                  title="No meals available"
                  description="Create a combo meal from Stock management."
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  {meals.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      availableStock={catalog.getSellableStock(product)}
                      isRiceUnavailable={catalog.containsArchivedIngredient(product)}
                      onAddToCart={(_id, quantity) => addProduct(product, quantity)}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* Full catalog */}
          <SectionCard
            title={showFeatured ? 'All products' : 'Products'}
            description="Everything available to sell right now"
          >
            <ProductGrid />
          </SectionCard>
        </div>

        {/* Docked cart (large screens) */}
        <aside className="hidden xl:col-span-4 xl:block 2xl:col-span-3">
          <div className="sticky top-24 h-[calc(100vh-8rem)]">
            <PosCart className="h-full" />
          </div>
        </aside>
      </div>

      {/* Drawer cart (small screens) */}
      <div className="xl:hidden">
        <PosCartDrawer isOpen={cartOpen} toggleSidebar={() => setCartOpen((open) => !open)} />
      </div>
    </>
  );
}
