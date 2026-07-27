/** Shared formatting + business-day helpers used across the POS modules. */

export const PESO = '₱';

/** `1234.5` → `₱1,234.50` */
export function formatCurrency(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${PESO}${safe.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Abbreviated currency for KPI tiles: `₱1.25K`, `₱3.40M`. */
export function formatCurrencyCompact(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return `${PESO}0.00`;
  if (Math.abs(amount) >= 1_000_000) return `${PESO}${(amount / 1_000_000).toFixed(2)}M`;
  if (Math.abs(amount) >= 1_000) return `${PESO}${(amount / 1_000).toFixed(2)}K`;
  return `${PESO}${amount.toFixed(2)}`;
}

export function formatNumber(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toLocaleString('en-PH') : '0';
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

/** Receipt-friendly stamp: `07/27/26 08:15 AM`. */
export function formatReceiptDate(value: string | Date | null | undefined): string {
  const date = value ? (value instanceof Date ? value : new Date(value)) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const hours24 = date.getHours();
  const hours12 = String(hours24 % 12 || 12).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  return `${month}/${day}/${year} ${hours12}:${minutes} ${meridiem}`;
}

/**
 * Business day window: 8:00 AM through 2:00 AM the next calendar day.
 * Shared by the dashboard, orders queue, order history and inventory report so
 * "today" means the same thing everywhere.
 */
export function getBusinessDayWindow(reference: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(reference);
  if (reference.getHours() < 2) start.setDate(reference.getDate() - 1);
  start.setHours(8, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  end.setHours(2, 0, 0, 0);

  return { start, end };
}

export function isTodayBusinessDay(value: string | Date | null | undefined): boolean {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const { start, end } = getBusinessDayWindow();
  return date >= start && date < end;
}

/**
 * The business day (YYYY-MM-DD) a timestamp belongs to. Anything before 8 AM
 * rolls back into the previous day so late-night sales stay grouped together.
 */
export function getBusinessDayKey(value: string | Date): string {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (date.getHours() < 8) date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Monday-based week start as YYYY-MM-DD. */
export function getWeekStartKey(value: string | Date): string {
  const source = value instanceof Date ? value : new Date(String(value).split('T')[0]);
  const date = new Date(source.getFullYear(), source.getMonth(), source.getDate());
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Order total, falling back to the sum of its line items when the backend
 * reports 0 (which happens for orders created before the sale is recorded).
 */
export function resolveOrderTotal(order: {
  total_amount?: number | string;
  order_items?: any[];
  orderItems?: any[];
}): number {
  const direct = Number(order.total_amount ?? 0);
  if (Number.isFinite(direct) && direct !== 0) return direct;
  const items = order.order_items ?? order.orderItems ?? [];
  return items.reduce(
    (sum: number, item: any) => sum + Number(item.quantity ?? 0) * Number(item.price ?? 0),
    0
  );
}

export function countOrderItems(order: { order_items?: any[]; orderItems?: any[] }): number {
  return (order.order_items ?? order.orderItems ?? []).length;
}

export function sumOrderQuantity(order: { order_items?: any[]; orderItems?: any[] }): number {
  return (order.order_items ?? order.orderItems ?? []).reduce(
    (sum: number, item: any) => sum + Number(item.quantity ?? 0),
    0
  );
}
