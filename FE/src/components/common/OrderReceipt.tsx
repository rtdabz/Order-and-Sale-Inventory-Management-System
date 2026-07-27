import React from 'react';
import { formatCurrency } from '../../lib/format';

interface OrderReceiptItem {
  productName: string;
  quantity: number;
  price: number;
  notes?: string;
}

interface OrderReceiptProps {
  orderNumber: string;
  items: OrderReceiptItem[];
  total: number;
  orderDate: string;
  /** Optional payment block, shown when the sale was tendered at the counter. */
  paymentMethod?: string | null;
  amountPaid?: number | null;
  changeDue?: number | null;
  /** Optional footer note (e.g. "Preview — not yet printed"). */
  footerNote?: string;
}

/**
 * 80mm-style sales receipt shown after a POS Terminal checkout.
 *
 * The paper stays white in both themes: it is what prints, and `printReceipt`
 * forces `background: #fff; color: #000` on the print window. Interactive
 * controls live in the overlay shell, never inside this element.
 */
const OrderReceipt: React.FC<OrderReceiptProps> = ({
  orderNumber,
  items,
  total,
  orderDate,
  paymentMethod,
  amountPaid,
  changeDue,
  footerNote = 'Thank you for your purchase',
}) => {
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const showPayment =
    !!paymentMethod || (amountPaid !== null && amountPaid !== undefined && amountPaid > 0);
  // The method arrives as a lowercase string from PosCart's snapshot; compare
  // case-insensitively so the gate survives a differently-cased source.
  const isCash = (paymentMethod ?? '').trim().toLowerCase() === 'cash';
  const showAmountTendered = isCash && amountPaid !== null && amountPaid !== undefined;
  const showChangeDue =
    isCash && changeDue !== null && changeDue !== undefined && Number(changeDue) > 0;

  return (
    <div
      id="order-receipt"
      className="mx-auto w-[420px] max-w-full rounded-lg border-2 border-gray-300 bg-white p-6 shadow-2xl"
    >
      {/* Brand header — compact: logo inline with the wordmark, caption beneath. */}
      <div className="mb-4 flex flex-col items-center gap-1 border-b-2 border-solid border-gray-400 pb-3">
        <div className="flex items-center justify-center gap-3">
          <img
            src="/images/logo/MKB.jpg"
            alt="MKB logo"
            style={{ height: '40px', width: '40px' }}
            className="object-contain"
          />
          <h1 className="text-2xl font-bold tracking-widest text-gray-900">MKB</h1>
        </div>
        <p className="text-xs uppercase tracking-wider text-gray-500">Sales receipt</p>
      </div>

      {/* Meta */}
      <div className="mb-4 space-y-2 border-b border-solid border-gray-300 pb-3">
        <div className="flex justify-between text-xs">
          <span className="font-medium text-gray-500">Transaction #:</span>
          <span className="font-bold text-gray-900">{orderNumber}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="font-medium text-gray-500">Date:</span>
          <span className="font-bold text-gray-900">{orderDate}</span>
        </div>
      </div>

      {/* Items */}
      <div className="mb-4">
        <div className="mb-3 grid grid-cols-2 items-end gap-4 border-b border-gray-200 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Product</span>
          <span className="text-right text-xs font-bold uppercase tracking-wider text-gray-600">
            Amount
          </span>
        </div>
        {/* Long baskets scroll here so the brand block, total and the overlay's
            action bar stay on screen on a short till display. */}
        <div className="max-h-[32vh] space-y-4 overflow-y-auto">
          {items.map((item, index) => (
            <div key={`${item.productName}-${index}`} className="space-y-1">
              <div className="grid grid-cols-2 items-center gap-4">
                <p className="text-sm font-semibold leading-tight text-gray-900">
                  {item.productName}
                </p>
                <span className="text-right text-sm font-bold tabular-nums text-gray-900">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </div>
              <p className="text-xs font-medium text-gray-500">
                {item.quantity} × {formatCurrency(item.price)}
              </p>
              {item.notes && (
                <p className="rounded bg-gray-50 px-2 py-1 text-xs italic text-gray-500">
                  {item.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="border-t-2 border-solid border-gray-400 pt-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-500">Items</span>
          <span className="font-semibold tabular-nums text-gray-800">{itemCount}</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-base font-bold uppercase tracking-wide text-gray-800">Total</span>
          <span className="text-3xl font-bold tabular-nums text-gray-900">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {/* Change due — the cashier's next physical action, so it sits directly
          under the total at the largest remaining type size. Cash only, and only
          when there is change to hand back. */}
      {showChangeDue && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-solid border-emerald-300 bg-emerald-50 px-3 py-2">
          <span className="text-sm font-bold uppercase tracking-wide text-emerald-700">
            Change due
          </span>
          <span className="text-2xl font-bold tabular-nums text-emerald-700">
            {formatCurrency(Number(changeDue))}
          </span>
        </div>
      )}

      {/* Payment */}
      {showPayment && (
        <div className="mt-4 space-y-2 border-t border-dashed border-gray-300 pt-2">
          {paymentMethod && (
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-500">Payment</span>
              <span className="font-semibold uppercase text-gray-800">{paymentMethod}</span>
            </div>
          )}
          {showAmountTendered && (
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-500">Amount tendered</span>
              <span className="font-semibold tabular-nums text-gray-800">
                {formatCurrency(Number(amountPaid))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 border-t border-dashed border-gray-300 pt-2 text-center">
        <p className="text-xs text-gray-500">{footerNote}</p>
      </div>
    </div>
  );
};

export default OrderReceipt;
