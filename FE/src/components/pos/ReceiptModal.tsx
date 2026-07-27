import React, { useEffect, useRef } from 'react';
import { Check, Printer, X } from 'lucide-react';
import OrderReceipt from '../common/OrderReceipt';
import printReceipt from '../../lib/printReceipt';
import Portal from '../ui/portal/Portal';
import Button from '../ui/button/Button';
import { formatCurrency } from '../../lib/format';

export type ReceiptData = {
  orderNumber: string;
  items: Array<{ productName: string; quantity: number; price: number; notes?: string }>;
  total: number;
  orderDate: string;
  paymentMethod?: string | null;
  amountPaid?: number | null;
  changeDue?: number | null;
};

export type ReceiptModalProps = {
  open: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
  /** Text under the total, e.g. to mark the receipt as a preview. */
  footerNote?: string;
  title?: string;
};

/** Overlay that renders the printable receipt for a completed POS sale. */
const ReceiptModal: React.FC<ReceiptModalProps> = ({
  open,
  onClose,
  receipt,
  footerNote,
  title = 'Receipt',
}) => {
  const printActionRef = useRef<HTMLDivElement>(null);

  // Every effect sits above the early return so hook order stays stable across renders.
  useEffect(() => {
    if (!open) return;
    // Restore whatever was there before: a page-level modal may hold its own lock.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    // Button does not forward refs, so reach the rendered element through its wrapper.
    printActionRef.current?.querySelector('button')?.focus();
  }, [open, receipt]);

  if (!open || !receipt) return null;

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={onClose}
        className="fixed inset-0 z-[100050] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
        style={{ margin: 0 }}
      >
        <div
          className="my-auto w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
          onClick={(event) => event.stopPropagation()}
        >
          {/* Header strip: the outcome, not the document. */}
          <div className="flex items-start gap-3 border-b border-gray-200 p-4 dark:border-gray-800">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-gray-900 dark:text-white">Sale complete</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatCurrency(receipt.total)} charged
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt"
              className="shrink-0 rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.06]"
            >
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* The receipt paper — the only region carrying #order-receipt. */}
          <div className="p-4">
            <OrderReceipt
              orderNumber={receipt.orderNumber}
              items={receipt.items}
              total={receipt.total}
              orderDate={receipt.orderDate}
              paymentMethod={receipt.paymentMethod ?? undefined}
              amountPaid={receipt.amountPaid ?? undefined}
              changeDue={receipt.changeDue ?? undefined}
              footerNote={footerNote}
            />
          </div>

          {/* Action bar, outside the printed markup. */}
          <div className="flex items-center gap-3 border-t border-gray-200 p-4 dark:border-gray-800">
            <div ref={printActionRef} className="flex-1">
              <Button
                fullWidth
                variant="primary"
                startIcon={<Printer className="h-4 w-4" />}
                onClick={() => printReceipt('order-receipt')}
              >
                Print receipt
              </Button>
            </div>
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ReceiptModal;
