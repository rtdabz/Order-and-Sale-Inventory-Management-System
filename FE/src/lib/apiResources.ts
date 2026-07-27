import api from './axios';
import { CacheKeys, fetchCached, invalidate, invalidatePrefix } from './dataCache';

/**
 * Shared fetchers for the datasets the POS uses on more than one screen.
 * Everything funnels through `fetchCached` so the first screen that needs a
 * dataset pays for it and every later screen renders instantly from cache.
 */

/** Laravel endpoints return either a bare array or `{ data: [...] }`. */
export function unwrapList<T = any>(payload: any): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray(payload?.data)) return payload.data as T[];
  return [];
}

export type RawProduct = {
  id: number;
  product_name?: string;
  name?: string;
  price?: number | string;
  status?: string;
  image?: string | null;
  image_url?: string | null;
  image_path?: string | null;
  category?: any;
  category_id?: number | string | null;
  category_name?: string;
  is_bundle?: boolean;
  is_stockable?: boolean | number;
  calculated_stock?: number;
  bundle_items?: any[];
  total_sold?: number;
  [key: string]: any;
};

export type RawInventory = {
  id?: number;
  product_id?: number;
  product?: { id?: number };
  productId?: number;
  quantity?: number | string;
  qty?: number | string;
  amount?: number | string;
  created_at?: string;
  type?: string;
  source?: string;
  [key: string]: any;
};

export type RawCategory = { id?: number | string; category_name?: string; name?: string };

export type RawOrder = {
  id: number;
  transaction_number?: string;
  created_at: string;
  order_date?: string;
  total_amount: number | string;
  order_items?: any[];
  orderItems?: any[];
  sale?: any;
  status?: string;
  [key: string]: any;
};

/** Normalise any backend image reference into a browser-usable URL. */
export function normalizeImage(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value);
  if (raw.startsWith('http') || raw.startsWith('//') || raw.startsWith('/')) return raw;
  if (raw.startsWith('storage/')) return `/${raw}`;
  return `/storage/${raw}`;
}

export function productImage(product: RawProduct): string | null {
  return (
    normalizeImage(product.image_url) ??
    normalizeImage(product.image) ??
    normalizeImage(product.image_path)
  );
}

export function productName(product: RawProduct): string {
  return String(product.product_name ?? product.name ?? product.productName ?? '—');
}

export function categoryLabel(product: RawProduct): string {
  const category = product.category;
  if (typeof category === 'string' && category) return category;
  if (category && typeof category === 'object') {
    return String(category.category_name ?? category.name ?? product.category_name ?? 'Uncategorized');
  }
  return String(product.category_name ?? 'Uncategorized');
}

/** Sum every inventory row per product into a single stock number. */
export function buildStockMap(inventories: RawInventory[]): Record<number, number> {
  const map: Record<number, number> = {};
  for (const inventory of inventories) {
    const productId = inventory.product_id ?? inventory.product?.id ?? inventory.productId ?? null;
    if (productId === null || productId === undefined) continue;
    const quantity = Number(inventory.quantity ?? inventory.qty ?? inventory.amount ?? 0) || 0;
    map[Number(productId)] = (map[Number(productId)] || 0) + quantity;
  }
  return map;
}

/** Components (id + quantity) for every bundle product, keyed by bundle id. */
export function buildBundleComponents(
  products: RawProduct[]
): Record<number, Array<{ id: number; quantity: number }>> {
  const bundles: Record<number, Array<{ id: number; quantity: number }>> = {};
  for (const product of products) {
    if (!product.is_bundle || !Array.isArray(product.bundle_items)) continue;
    const components: Array<{ id: number; quantity: number }> = [];
    for (const item of product.bundle_items) {
      const bundledId = item.bundled_product?.id ?? item.bundled_product_id;
      if (bundledId) components.push({ id: Number(bundledId), quantity: Number(item.quantity ?? 1) });
    }
    bundles[Number(product.id)] = components;
  }
  return bundles;
}

export const fetchProducts = () =>
  fetchCached<RawProduct[]>(CacheKeys.products, async () => unwrapList<RawProduct>((await api.get('/products')).data));

export const fetchInventories = () =>
  fetchCached<RawInventory[]>(CacheKeys.inventories, async () =>
    unwrapList<RawInventory>((await api.get('/inventories')).data)
  );

export const fetchCategories = () =>
  fetchCached<RawCategory[]>(CacheKeys.categories, async () =>
    unwrapList<RawCategory>((await api.get('/categories')).data)
  );

export const fetchOrders = () =>
  fetchCached<RawOrder[]>(CacheKeys.orders, async () => unwrapList<RawOrder>((await api.get('/orders')).data));

export const fetchCompletedOrders = () =>
  fetchCached<RawOrder[]>(CacheKeys.completedOrders, async () =>
    unwrapList<RawOrder>((await api.get('/orders/completed')).data)
  );

export const fetchBestSellers = () =>
  fetchCached<RawProduct[]>(CacheKeys.bestSellers, async () =>
    unwrapList<RawProduct>((await api.get('/products/best-sellers')).data)
  );

/** Drop every cached dataset touched by recording or voiding a sale. */
export function invalidateOrderData() {
  invalidate(CacheKeys.orders, CacheKeys.completedOrders, CacheKeys.inventories, CacheKeys.products);
  invalidatePrefix('sales:');
}

export function announceSaleRecorded() {
  window.dispatchEvent(new CustomEvent('sale:recorded'));
  window.dispatchEvent(new CustomEvent('products:refresh'));
  
  // Pre-warm the cache immediately in the background so navigating to
  // other pages (like dashboard/transactions) reads fresh data instantly
  void fetchCompletedOrders();
  void fetchInventories();
  void fetchProducts();
  void fetchOrders();
}

/** Drop every cached dataset touched by a product or stock change. */
export function invalidateProductData() {
  invalidate(
    CacheKeys.products,
    CacheKeys.archivedProducts,
    CacheKeys.inventories,
    CacheKeys.bestSellers
  );
}
