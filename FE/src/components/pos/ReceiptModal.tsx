import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import OrderReceipt from '../common/OrderReceipt';
import printReceipt from '../../lib/printReceipt';

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
  if (!open || !receipt) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-[100050] flex h-screen w-screen items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      style={{ margin: 0 }}
    >
      <div className="relative my-auto" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close receipt"
          className="absolute -right-3 -top-3 z-10 rounded-full bg-white p-2 shadow-lg transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>
        <OrderReceipt
          orderNumber={receipt.orderNumber}
          items={receipt.items}
          total={receipt.total}
          orderDate={receipt.orderDate}
          paymentMethod={receipt.paymentMethod ?? undefined}
          amountPaid={receipt.amountPaid ?? undefined}
          changeDue={receipt.changeDue ?? undefined}
          footerNote={footerNote}
          onPrint={() => printReceipt('order-receipt')}
        />
      </div>
    </div>,
    document.body
  );
};

export default ReceiptModal;
