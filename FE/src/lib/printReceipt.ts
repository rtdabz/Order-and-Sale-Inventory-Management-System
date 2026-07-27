/**
 * Opens a print window sized for an 80mm thermal roll and prints the markup of
 * the given element. The inlined stylesheet mirrors the Tailwind utilities used
 * by `OrderReceipt`, because the print window does not load the app CSS.
 */
const RECEIPT_PRINT_STYLES = `
@page { margin: 0; size: 80mm auto; }
* {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font-family: 'Segoe UI', Arial, sans-serif; padding: 8mm; }
#order-receipt { width: 100%; max-width: 80mm; margin: 0 auto; background: #fff; color: #000; padding: 0; }

.flex { display: flex !important; }
.flex-col { flex-direction: column !important; }
.items-center { align-items: center !important; }
.items-start { align-items: flex-start !important; }
.items-end { align-items: flex-end !important; }
.justify-between { justify-content: space-between !important; }
.gap-3 { gap: 3mm !important; }
.gap-4 { gap: 4mm !important; }
.mb-6 { margin-bottom: 4mm !important; }
.mb-4 { margin-bottom: 3mm !important; }
.mb-3 { margin-bottom: 2mm !important; }
.mt-4 { margin-top: 3mm !important; }
.pb-3 { padding-bottom: 2mm !important; }
.pb-4 { padding-bottom: 3mm !important; }
.pt-2 { padding-top: 2mm !important; }
.px-2 { padding-left: 1.5mm !important; padding-right: 1.5mm !important; }
.py-1 { padding-top: 1mm !important; padding-bottom: 1mm !important; }
.border-b { border-bottom: 1px solid #d1d5db !important; }
.border-t { border-top: 1px solid #d1d5db !important; }
.border-b-2 { border-bottom: 2px solid #9ca3af !important; }
.border-t-2 { border-top: 2px solid #9ca3af !important; }
.border-solid { border-style: solid !important; }
.border-dashed { border-style: dashed !important; }
.border-gray-200, .border-gray-300 { border-color: #d1d5db !important; }
.border-gray-400 { border-color: #9ca3af !important; }
.text-center { text-align: center !important; }
.text-right { text-align: right !important; }
.text-xs { font-size: 18px !important; }
.text-sm { font-size: 20px !important; }
.text-base { font-size: 22px !important; }
.text-lg { font-size: 24px !important; }
.text-3xl { font-size: 32px !important; }
.text-4xl { font-size: 40px !important; }
.font-bold { font-weight: bold !important; }
.font-semibold { font-weight: 600 !important; }
.font-medium { font-weight: 500 !important; }
.uppercase { text-transform: uppercase !important; }
.tracking-widest { letter-spacing: 0.15em !important; }
.tracking-wider { letter-spacing: 0.05em !important; }
.tracking-wide { letter-spacing: 0.025em !important; }
.italic { font-style: italic !important; }
.grid { display: grid !important; }
.grid-cols-2 { grid-template-columns: 1fr 1fr !important; }
.space-y-4 > * + * { margin-top: 3mm !important; }
.space-y-2 > * + * { margin-top: 2mm !important; }
.space-y-1 > * + * { margin-top: 1mm !important; }
.text-gray-900 { color: #111827 !important; }
.text-gray-800 { color: #1f2937 !important; }
.text-gray-600 { color: #4b5563 !important; }
.text-gray-500 { color: #6b7280 !important; }
.text-gray-400 { color: #9ca3af !important; }
.object-contain { object-fit: contain !important; }
.tabular-nums { font-variant-numeric: tabular-nums !important; }
.leading-tight { line-height: 1.25 !important; }
.rounded { border-radius: 2px !important; }
.bg-gray-50, .bg-gray-100 { background: #f9fafb !important; }

button { display: none !important; }
img { max-width: 100%; height: auto; }
`;

export function printReceipt(elementId = 'order-receipt'): void {
  const source = document.getElementById(elementId);
  if (!source) {
    console.warn('[printReceipt] element not found:', elementId);
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.warn('[printReceipt] popup blocked');
    return;
  }

  printWindow.document.write(
    `<!doctype html><html><head><meta charset="utf-8" /><title></title><style>${RECEIPT_PRINT_STYLES}</style></head><body>${source.innerHTML}</body></html>`
  );
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

export default printReceipt;
