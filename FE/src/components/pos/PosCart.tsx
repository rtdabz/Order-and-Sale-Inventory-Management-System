import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CreditCard,
  Minus,
  Plus,
  Receipt,
  ShoppingCart,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from 'sonner';

import Button from '../ui/button/Button';
import StatusPill from '../ui/badge/StatusPill';
import EmptyState from '../ui/empty/EmptyState';
import ConfirmDialog from '../ui/dialog/ConfirmDialog';
import ReceiptModal, { ReceiptData } from './ReceiptModal';
import { useOrders, OrderItem } from '../../context/OrderContext';
import { usePosCatalog } from '../../hooks/usePosCatalog';
import api from '../../lib/axios';
import { announceSaleRecorded, invalidateOrderData, invalidateProductData } from '../../lib/apiResources';
import { formatCurrency, formatReceiptDate } from '../../lib/format';
import { cn } from '../../lib/utils';

type PaymentMethod = 'cash' | 'gcash' | 'card';

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string; icon: React.ReactNode }> = [
  { value: 'cash', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
  { value: 'gcash', label: 'GCash', icon: <Smartphone className="h-4 w-4" /> },
  { value: 'card', label: 'Card', icon: <CreditCard className="h-4 w-4" /> },
];

const QUICK_CASH = [100, 200, 500, 1000];

const EGG_STYLES = ['Sunny Side Up', 'Boiled', 'Scrambled'] as const;

export type PosCartProps = {
  /** Rendered as a close button in the drawer variant. */
  onClose?: () => void;
  className?: string;
};

/** Total of the egg cooking-style breakdown for a line. */
function preferenceTotal(order: OrderItem): number {
  const preferences = order.cookingPreferences ?? order.cooking_preferences;
  if (!preferences) return 0;
  return EGG_STYLES.reduce((sum, style) => sum + Number(preferences[style] ?? 0), 0);
}

/**
 * The POS cart: line items, egg cooking preferences, payment capture and order
 * submission. Rendered docked beside the catalog on large screens and inside a
 * drawer on smaller ones.
 */
const PosCart: React.FC<PosCartProps> = ({ onClose, className }) => {
  const { orders, updateQuantity, updateNotes, updateCookingPreferences, removeFromOrder, clearOrders } =
    useOrders();
  const catalog = usePosCatalog(orders);

  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const hasOrders = orders.length > 0;
  const itemCount = orders.reduce((sum, order) => sum + order.quantity, 0);
  const total = orders.reduce((sum, order) => sum + order.price * order.quantity, 0);

  const tenderedAmount = Number.parseFloat(tendered);
  const hasTendered = Number.isFinite(tenderedAmount) && tenderedAmount > 0;
  const changeDue = hasTendered ? tenderedAmount - total : 0;
  const cashShort = paymentMethod === 'cash' && hasTendered && tenderedAmount < total;

  // Reset the tendered amount whenever the cart empties out.
  useEffect(() => {
    if (!hasOrders) setTendered('');
  }, [hasOrders]);

  /** Does this line involve eggs (directly or through a bundle component)? */
  const isEggLine = (order: OrderItem): boolean => {
    if (order.productName?.toLowerCase().includes('egg')) return true;
    if (!order.is_bundle) return false;
    const components = catalog.bundleComponents[order.id];
    if (!components) return false;
    return components.some((component) => {
      const product = catalog.products.find((item) => item.id === component.id);
      return product?.product_name?.toLowerCase().includes('egg');
    });
  };

  /**
   * Egg lines must specify how they are cooked: a per-style breakdown when the
   * quantity is 2+, otherwise a single note.
   */
  const missingPreferences = useMemo(
    () =>
      orders.filter((order) => {
        if (!isEggLine(order)) return false;
        if (order.quantity >= 2) return preferenceTotal(order) !== order.quantity;
        return !order.notes;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, catalog.bundleComponents, catalog.products]
  );

  const canCheckout = hasOrders && missingPreferences.length === 0 && !cashShort;

  const canIncreaseQuantity = (order: OrderItem): boolean => {
    if (!order.is_stockable && !order.is_bundle) return true;
    const ceiling = order.stock ?? 0;
    return order.quantity < ceiling;
  };

  const resetPayment = () => {
    setPaymentMethod('cash');
    setTendered('');
  };

  /**
   * Submit the sale, then surface a printable receipt preview.
   *
   * The backend records the order and its sale in one transaction, so the
   * transaction is complete the moment this resolves — there is no queue to
   * confirm afterwards.
   */
  const placeOrder = async () => {
    if (!hasOrders) return;
    setSubmitting(true);

    // Philippine time (UTC+8) so the business day matches the backend.
    const philippineTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const payload = {
      order_date: philippineTime.toISOString().split('T')[0],
      order_items: orders.map((order) => ({
        product_id: order.id,
        quantity: order.quantity,
        price: order.price,
        category_id: (order as any).category_id ?? null,
        notes: order.notes ?? null,
        cookingPreferences: order.cookingPreferences ?? null,
      })),
    };

    const snapshot = {
      items: orders.map((order) => ({
        productName: order.productName,
        quantity: order.quantity,
        price: order.price,
        notes: order.notes,
      })),
      total,
      paidAmount: paymentMethod === 'cash' && hasTendered ? tenderedAmount : total,
      change: paymentMethod === 'cash' && hasTendered ? Math.max(0, changeDue) : 0,
      method: paymentMethod,
    };

    try {
      const response = await api.post('/orders', payload);
      const created = response?.data?.data ?? response?.data ?? {};

      setConfirmOpen(false);
      onClose?.();

      // Refresh stock, order and sales caches across the app.
      invalidateOrderData();
      invalidateProductData();
      announceSaleRecorded();

      const orderRef = created?.transaction_number || (created?.id ? `#${created.id}` : '');
      toast.success(
        orderRef
          ? `Order ${orderRef} placed successfully!`
          : 'Order placed successfully!'
      );

      setReceipt({
        orderNumber: created?.transaction_number || `#${created?.id ?? '—'}`,
        items: snapshot.items,
        total: snapshot.total,
        orderDate: formatReceiptDate(new Date()),
        paymentMethod: snapshot.method,
        amountPaid: snapshot.paidAmount,
        changeDue: snapshot.change,
      });

      clearOrders();
      resetPayment();
      setReceiptOpen(true);
    } catch (error: any) {
      console.error('[PosCart] order failed', error);
      await Swal.fire({
        title: 'Order failed',
        text: error?.response?.data?.message || 'Failed to place order. Please try again.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        willOpen: () => {
          const container = document.querySelector('.swal2-container') as HTMLElement | null;
          if (container) container.style.zIndex = '300000';
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section
        className={cn(
          'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]',
          className
        )}
        aria-label="Current sale"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
              <ShoppingCart className="h-4 w-4 text-brand-500" />
              Current sale
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Counter order · {itemCount} item{itemCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {hasOrders && (
              <button
                type="button"
                onClick={() => setClearConfirmOpen(true)}
                aria-label="Clear cart"
                title="Clear cart"
                className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close cart"
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        {/* Lines */}
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          {!hasOrders ? (
            <EmptyState
              icon={<ShoppingCart className="h-7 w-7" />}
              title="Cart is empty"
              description="Tap a product to start a new counter sale."
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {orders.map((order) => {
                const needsPreference = missingPreferences.some((item) => item.id === order.id);
                const assigned = preferenceTotal(order);

                return (
                  <li key={order.id} className="px-4 py-3.5">
                    <div className="flex gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                        {order.image ? (
                          <img
                            src={order.image}
                            alt={order.productName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-base font-semibold text-gray-400">
                            {String(order.productName || '—').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                              {order.productName}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                              {order.category || 'Uncategorized'} · {formatCurrency(order.price)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromOrder(order.id)}
                            aria-label={`Remove ${order.productName}`}
                            className="shrink-0 rounded-md p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700">
                            <button
                              type="button"
                              onClick={() => updateQuantity(order.id, -1)}
                              disabled={order.quantity <= 1}
                              aria-label="Decrease quantity"
                              className="flex h-7 w-8 items-center justify-center rounded-l-lg text-gray-500 transition hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/[0.06]"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-7 text-center text-sm font-semibold text-gray-900 dark:text-white">
                              {order.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(order.id, 1)}
                              disabled={!canIncreaseQuantity(order)}
                              aria-label="Increase quantity"
                              className="flex h-7 w-8 items-center justify-center rounded-r-lg text-gray-500 transition hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/[0.06]"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {formatCurrency(order.price * order.quantity)}
                          </span>
                        </div>

                        {/* Egg cooking preferences */}
                        {isEggLine(order) && (
                          <div className="mt-3 rounded-lg bg-amber-50 p-2.5 dark:bg-amber-500/10">
                            {order.quantity >= 2 ? (
                              <>
                                <p className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                                  Cooking style breakdown ({assigned}/{order.quantity})
                                </p>
                                <div className="space-y-1.5">
                                  {EGG_STYLES.map((style) => {
                                    const current = Number(order.cookingPreferences?.[style] ?? 0);
                                    const remaining = order.quantity - assigned + current;
                                    return (
                                      <div key={style} className="flex items-center gap-2">
                                        <label
                                          className="w-24 shrink-0 text-xs text-amber-800 dark:text-amber-300"
                                          htmlFor={`egg-${order.id}-${style}`}
                                        >
                                          {style}
                                        </label>
                                        <input
                                          id={`egg-${order.id}-${style}`}
                                          type="number"
                                          min={0}
                                          max={remaining}
                                          value={current}
                                          onChange={(event) => {
                                            const next = Math.max(
                                              0,
                                              Math.min(remaining, Number.parseInt(event.target.value, 10) || 0)
                                            );
                                            updateCookingPreferences(order.id, {
                                              ...order.cookingPreferences,
                                              [style]: next,
                                            });
                                          }}
                                          className="h-7 flex-1 rounded-md border border-amber-200 bg-white px-2 text-xs text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300 dark:border-amber-500/30 dark:bg-gray-900 dark:text-gray-100"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            ) : (
                              <>
                                <label
                                  className="mb-1.5 block text-xs font-semibold text-amber-800 dark:text-amber-300"
                                  htmlFor={`egg-style-${order.id}`}
                                >
                                  Egg cooking preference
                                </label>
                                <select
                                  id={`egg-style-${order.id}`}
                                  value={order.notes || ''}
                                  onChange={(event) => updateNotes(order.id, event.target.value)}
                                  className="h-8 w-full rounded-md border border-amber-200 bg-white px-2 text-xs text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300 dark:border-amber-500/30 dark:bg-gray-900 dark:text-gray-100"
                                >
                                  <option value="">Select cooking style…</option>
                                  {EGG_STYLES.map((style) => (
                                    <option key={style} value={style}>
                                      {style}
                                    </option>
                                  ))}
                                </select>
                              </>
                            )}
                            {needsPreference && (
                              <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                                Required before checkout
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Payment + checkout */}
        <footer className="shrink-0 space-y-4 border-t border-gray-100 bg-gray-50/70 px-5 py-4 dark:border-gray-800 dark:bg-white/[0.02]">
          <dl className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
              <dt>Items</dt>
              <dd className="font-medium text-gray-700 dark:text-gray-200">{itemCount}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-gray-200 pt-2 dark:border-gray-700">
              <dt className="text-base font-semibold text-gray-900 dark:text-white">Total</dt>
              <dd className="text-xl font-bold text-brand-600 dark:text-brand-400">
                {formatCurrency(total)}
              </dd>
            </div>
          </dl>

          {/* Payment method */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Payment method
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  aria-pressed={paymentMethod === method.value}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition',
                    paymentMethod === method.value
                      ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/15 dark:text-brand-300'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                  )}
                >
                  {method.icon}
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cash tendered */}
          {paymentMethod === 'cash' && (
            <div className="space-y-2">
              <label
                htmlFor="pos-tendered"
                className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
              >
                Amount tendered
              </label>
              <input
                id="pos-tendered"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={tendered}
                onChange={(event) => setTendered(event.target.value)}
                placeholder={total > 0 ? total.toFixed(2) : '0.00'}
                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-right text-lg font-semibold tabular-nums text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTendered(total.toFixed(2))}
                  disabled={!hasOrders}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  Exact
                </button>
                {QUICK_CASH.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setTendered(String(amount))}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>

              {hasTendered && (
                <div
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                    cashShort
                      ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  )}
                  aria-live="polite"
                >
                  <span className="font-medium">{cashShort ? 'Still due' : 'Change'}</span>
                  <span className="text-base font-bold tabular-nums">
                    {formatCurrency(Math.abs(changeDue))}
                  </span>
                </div>
              )}
            </div>
          )}

          {missingPreferences.length > 0 && (
            <StatusPill tone="warning" className="w-full justify-center">
              Set the cooking preference for {missingPreferences.length} item
              {missingPreferences.length === 1 ? '' : 's'}
            </StatusPill>
          )}

          <Button
            fullWidth
            size="lg"
            disabled={!canCheckout}
            loading={submitting}
            onClick={() => setConfirmOpen(true)}
            startIcon={<Receipt className="h-4 w-4" />}
          >
            {hasOrders ? `Charge ${formatCurrency(total)}` : 'Add items to continue'}
          </Button>
        </footer>
      </section>

      {/* Checkout confirmation */}
      <ConfirmDialog
        open={confirmOpen}
        title="Complete this sale?"
        tone="success"
        confirmLabel={submitting ? 'Placing…' : 'Place order'}
        loading={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={placeOrder}
        message={
          <div className="space-y-3">
            <p>
              Counter order for {itemCount} item{itemCount === 1 ? '' : 's'}.
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs dark:bg-white/[0.04]">
              {orders.map((order) => (
                <li key={order.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    {order.productName} × {order.quantity}
                  </span>
                  <span className="shrink-0 font-medium text-gray-700 dark:text-gray-200">
                    {formatCurrency(order.price * order.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>Total</dt>
                <dd className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(total)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Payment</dt>
                <dd className="font-medium uppercase text-gray-700 dark:text-gray-200">
                  {paymentMethod}
                </dd>
              </div>
              {paymentMethod === 'cash' && hasTendered && (
                <div className="flex justify-between">
                  <dt>Change</dt>
                  <dd className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(Math.max(0, changeDue))}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        }
      />

      {/* Clear cart confirmation */}
      <ConfirmDialog
        open={clearConfirmOpen}
        title="Clear the cart?"
        message="All items in the current sale will be removed."
        tone="danger"
        confirmLabel="Clear cart"
        onCancel={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          clearOrders();
          resetPayment();
          setClearConfirmOpen(false);
        }}
      />

      {/* Receipt preview */}
      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        receipt={receipt}
        title="Sale receipt"
      />
    </>
  );
};

export default PosCart;
