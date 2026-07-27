import React, { useEffect, useState } from 'react';
import { Check, ImageOff, Minus, Plus, ShoppingCart } from 'lucide-react';
import StatusPill from '../ui/badge/StatusPill';
import { formatCurrency } from '../../lib/format';
import { cn } from '../../lib/utils';

interface ProductCardProps {
  product: {
    id: number;
    product_name?: string;
    name?: string;
    productName?: string;
    category?: string;
    category_label?: string;
    category_id?: string;
    category_name?: string;
    stock?: number;
    price?: number | string;
    image?: string | null;
    image_url?: string | null;
    is_bundle?: boolean;
    is_stockable?: boolean;
    [key: string]: any;
  };
  availableStock: number;
  onAddToCart: (productId: number, quantity: number, notes?: string) => void;
  initialQuantity?: number;
  showStock?: boolean;
  badge?: string | null;
  onImageError?: (productId: number) => void;
  /** Bundle whose ingredient is archived — the tile is disabled. */
  isRiceUnavailable?: boolean;
}

/**
 * POS product tile.
 *
 * Optimised for speed: tapping the tile adds one unit immediately, while the
 * stepper is there when a cashier needs a specific quantity.
 */
const ProductCard: React.FC<ProductCardProps> = ({
  product,
  availableStock,
  onAddToCart,
  initialQuantity = 1,
  showStock = true,
  badge = null,
  onImageError,
  isRiceUnavailable = false,
}) => {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [justAdded, setJustAdded] = useState(false);

  const isNonStockable = product.is_stockable === false;
  const isTracked = !isNonStockable || Boolean(product.is_bundle);
  const isOutOfStock = isTracked && availableStock <= 0;
  const isDisabled = isOutOfStock || isRiceUnavailable;

  // Keep the requested quantity within what the cart can still reserve.
  useEffect(() => {
    if (!isTracked) return;
    if (availableStock <= 0) setQuantity(1);
    else if (quantity > availableStock) setQuantity(availableStock);
  }, [availableStock, quantity, isTracked]);

  // Brief confirmation flash after adding to the cart.
  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(false), 900);
    return () => clearTimeout(timer);
  }, [justAdded]);

  const canIncrement = isTracked ? quantity < availableStock : true;

  const handleAdd = () => {
    if (isDisabled) return;
    onAddToCart(product.id, quantity, undefined);
    setQuantity(1);
    setJustAdded(true);
  };

  const displayName = product.product_name ?? product.productName ?? product.name ?? '—';
  const displayCategory = product.category_label ?? product.category ?? 'Uncategorized';
  const showStockPill = showStock && isTracked;

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all duration-200 dark:bg-white/[0.03]',
        isDisabled
          ? 'border-gray-200 opacity-70 dark:border-gray-800'
          : 'border-gray-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-gray-800 dark:hover:border-brand-500/40'
      )}
    >
      {/* Tap target: the whole image area adds one unit. */}
      <button
        type="button"
        onClick={handleAdd}
        disabled={isDisabled}
        aria-label={isDisabled ? `${displayName} unavailable` : `Add ${displayName} to cart`}
        className="relative block aspect-square w-full overflow-hidden bg-gray-100 disabled:cursor-not-allowed dark:bg-gray-800"
      >
        {product.image ? (
          <img
            src={product.image}
            alt={displayName}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(event) => {
              const element = event.currentTarget as HTMLImageElement;
              element.onerror = null;
              onImageError?.(product.id);
            }}
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-300 dark:text-gray-600">
            <ImageOff className="h-7 w-7" />
            <span className="text-xs">No image</span>
          </span>
        )}

        {badge && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
            {badge}
          </span>
        )}

        {showStockPill && (
          <span className="absolute right-2 top-2">
            {isOutOfStock ? (
              <StatusPill tone="danger">Out</StatusPill>
            ) : availableStock <= 10 ? (
              <StatusPill tone="warning">{availableStock} left</StatusPill>
            ) : (
              <StatusPill tone="success">{availableStock}</StatusPill>
            )}
          </span>
        )}

        {isRiceUnavailable && (
          <span className="absolute inset-x-0 bottom-0 bg-red-600/90 py-1 text-center text-xs font-semibold text-white">
            Ingredient unavailable
          </span>
        )}

        {justAdded && (
          <span className="absolute inset-0 flex items-center justify-center bg-emerald-500/85 text-white">
            <Check className="h-9 w-9" />
          </span>
        )}
      </button>

      {/* Details */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-gray-900 dark:text-white">
          {displayName}
        </h3>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{displayCategory}</p>
        <p className="mt-0.5 text-base font-bold text-brand-600 dark:text-brand-400">
          {formatCurrency(product.price)}
        </p>

        <div className="mt-auto space-y-2 pt-2">
          {/* Quantity stepper */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              disabled={quantity <= 1 || isDisabled}
              aria-label="Decrease quantity"
              className="flex h-8 w-9 items-center justify-center rounded-l-lg text-gray-500 transition hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/[0.06]"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span
              className="min-w-8 text-center text-sm font-semibold text-gray-900 dark:text-white"
              aria-live="polite"
            >
              {isDisabled ? 0 : quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((value) => value + 1)}
              disabled={!canIncrement || isDisabled}
              aria-label="Increase quantity"
              className="flex h-8 w-9 items-center justify-center rounded-r-lg text-gray-500 transition hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/[0.06]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={isDisabled}
            title={
              isRiceUnavailable
                ? 'Ingredient unavailable'
                : isOutOfStock
                  ? 'Out of stock'
                  : 'Add to cart'
            }
            className={cn(
              'flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all duration-200',
              isDisabled
                ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-white/[0.06] dark:text-gray-500'
                : 'bg-brand-500 text-white hover:bg-brand-600 active:scale-[0.98]'
            )}
          >
            {isRiceUnavailable ? (
              'Unavailable'
            ) : isOutOfStock ? (
              'Out of stock'
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Add
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
