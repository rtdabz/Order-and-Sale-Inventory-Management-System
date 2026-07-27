import { useCallback, useMemo } from 'react';
import { useCachedQuery } from './useCachedQuery';
import { CacheKeys } from '../lib/dataCache';
import {
  buildBundleComponents,
  buildStockMap,
  categoryLabel,
  fetchInventories,
  fetchProducts,
  productImage,
  productName,
  RawInventory,
  RawProduct,
} from '../lib/apiResources';

export type CatalogProduct = RawProduct & {
  id: number;
  product_name: string;
  category_label: string;
  category_id: string;
  price: number;
  image: string | null;
  /** On-hand stock: inventory sum for simple products, computed for bundles. */
  stock: number;
  is_bundle: boolean;
  is_stockable: boolean;
};

/**
 * Ingredients that gate whole meals. When one is archived every bundle that
 * uses it has to be disabled in the POS, so we resolve them once here instead
 * of re-fetching `/products` on three different screens.
 */
const KEY_INGREDIENTS = ['egg', 'rice', 'pancit canton', 'corned beef', 'beef loaf'];

/** Products never sold on their own — only as part of a combo meal. */
const COMBO_ONLY_PRODUCTS = ['corned beef', 'beef loaf'];

/**
 * Stand-in ceiling for products that are not inventory-tracked (rice, and
 * bundles built only from untracked components). Large enough to never block a
 * sale, small enough to render sensibly in the UI.
 */
export const UNLIMITED_STOCK = 9999;

export type CartLine = {
  id: number;
  quantity: number;
  is_bundle?: boolean;
};

export type PosCatalog = {
  products: CatalogProduct[];
  /** Bundle id → component product ids and quantities. */
  bundleComponents: Record<number, Array<{ id: number; quantity: number }>>;
  /** Lower-cased names of archived key ingredients. */
  archivedIngredients: Set<string>;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** On-hand stock minus what the cart already reserves (bundles included). */
  getAvailableStock: (productId: number, baseStock: number) => number;
  /** Sellable quantity for a product, resolving bundles through components. */
  getSellableStock: (product: CatalogProduct) => number;
  /** True when the product (or one of its ingredients) is archived. */
  containsArchivedIngredient: (product: RawProduct) => boolean;
  /** Should this product be hidden from the customer-facing grid? */
  isHiddenFromCatalog: (product: RawProduct) => boolean;
};

/**
 * Single source of truth for POS catalog data: products joined with inventory,
 * bundle stock resolution and cart-aware availability.
 */
export function usePosCatalog(cart: CartLine[] = []): PosCatalog {
  const productsQuery = useCachedQuery<RawProduct[]>(CacheKeys.products, fetchProducts, {
    refreshEvents: ['products:refresh'],
  });
  const inventoriesQuery = useCachedQuery<RawInventory[]>(CacheKeys.inventories, fetchInventories, {
    refreshEvents: ['products:refresh'],
  });

  const rawProducts = productsQuery.data ?? [];
  const inventories = inventoriesQuery.data ?? [];

  const bundleComponents = useMemo(() => buildBundleComponents(rawProducts), [rawProducts]);

  const products = useMemo<CatalogProduct[]>(() => {
    const stockMap = buildStockMap(inventories);

    return rawProducts
      .map((product) => {
        const isBundle = Boolean(product.is_bundle);
        const isStockable =
          product.is_stockable === undefined || product.is_stockable === null
            ? true
            : Boolean(product.is_stockable);

        const stock = isBundle
          ? Number(product.calculated_stock ?? 0)
          : Number(stockMap[Number(product.id)] ?? product.quantity ?? product.stock ?? 0);

        return {
          ...product,
          id: Number(product.id),
          product_name: productName(product),
          category_label: categoryLabel(product),
          category_id:
            product.category && typeof product.category === 'object' && product.category.id
              ? String(product.category.id)
              : product.category_id
                ? String(product.category_id)
                : '',
          category: categoryLabel(product),
          price: Number(product.price ?? 0),
          image: productImage(product),
          stock,
          is_bundle: isBundle,
          is_stockable: isStockable,
        } as CatalogProduct;
      })
      .sort((a, b) => a.product_name.toLowerCase().localeCompare(b.product_name.toLowerCase()));
  }, [rawProducts, inventories]);

  const productsById = useMemo(() => {
    const map = new Map<number, CatalogProduct>();
    for (const product of products) map.set(product.id, product);
    return map;
  }, [products]);

  const archivedIngredients = useMemo(() => {
    const archived = new Set<string>();
    for (const ingredient of KEY_INGREDIENTS) {
      const match = rawProducts.find(
        (product) => productName(product).toLowerCase().trim() === ingredient && product.status === 'archived'
      );
      if (match) archived.add(ingredient);
    }
    return archived;
  }, [rawProducts]);

  /** Sum of cart reservations for a product, counting bundle components. */
  const getReserved = useCallback(
    (productId: number) => {
      let reserved = 0;
      for (const line of cart) {
        if (line.id === productId) reserved += line.quantity;
        if (line.is_bundle) {
          const component = bundleComponents[line.id]?.find((item) => item.id === productId);
          if (component) reserved += component.quantity * line.quantity;
        }
      }
      return reserved;
    },
    [cart, bundleComponents]
  );

  const getAvailableStock = useCallback(
    (productId: number, baseStock: number) => Math.max(0, baseStock - getReserved(productId)),
    [getReserved]
  );

  const getSellableStock = useCallback(
    (product: CatalogProduct) => {
      if (product.is_bundle) {
        const components = bundleComponents[product.id];
        if (!components || components.length === 0) {
          return Number(product.calculated_stock ?? product.stock ?? 0);
        }
        let minimum = Infinity;
        let hasTrackedComponent = false;
        for (const component of components) {
          const componentProduct = productsById.get(component.id);
          if (!componentProduct || !componentProduct.is_stockable) continue;
          hasTrackedComponent = true;
          const available = getAvailableStock(component.id, componentProduct.stock);
          minimum = Math.min(minimum, Math.floor(available / Math.max(1, component.quantity)));
        }
        // A bundle made only of untracked components (e.g. rice) never runs out.
        if (!hasTrackedComponent) return UNLIMITED_STOCK;
        return minimum === Infinity ? 0 : Math.max(0, minimum);
      }

      if (!product.is_stockable) return UNLIMITED_STOCK;
      return getAvailableStock(product.id, product.stock);
    },
    [bundleComponents, productsById, getAvailableStock]
  );

  const containsArchivedIngredient = useCallback(
    (product: RawProduct) => {
      if (!product) return false;
      const name = productName(product).toLowerCase().trim();
      if (archivedIngredients.has(name)) return true;
      if (!product.is_bundle || !Array.isArray(product.bundle_items)) return false;

      return product.bundle_items.some((item: any) => {
        if (item.status === 'archived') return true;
        const bundled = item.bundled_product || item.product;
        const bundledName = String(
          bundled?.product_name ?? bundled?.name ?? item.product_name ?? ''
        )
          .toLowerCase()
          .trim();
        if (bundled?.status === 'archived') return true;
        return bundledName ? archivedIngredients.has(bundledName) : false;
      });
    },
    [archivedIngredients]
  );

  const isHiddenFromCatalog = useCallback((product: RawProduct) => {
    const name = productName(product).toLowerCase().trim();
    if (COMBO_ONLY_PRODUCTS.includes(name)) return true;
    // Archived stand-alone products disappear; archived bundles stay visible but
    // disabled so cashiers understand why a meal cannot be sold.
    if (product.status === 'archived' && !product.is_bundle) return true;
    return false;
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([productsQuery.refresh(), inventoriesQuery.refresh()]);
  }, [productsQuery, inventoriesQuery]);

  return {
    products,
    bundleComponents,
    archivedIngredients,
    isInitialLoading: productsQuery.isInitialLoading || inventoriesQuery.isInitialLoading,
    isRefreshing: productsQuery.isRefreshing || inventoriesQuery.isRefreshing,
    error: productsQuery.error ?? inventoriesQuery.error,
    refresh,
    getAvailableStock,
    getSellableStock,
    containsArchivedIngredient,
    isHiddenFromCatalog,
  };
}

export default usePosCatalog;
