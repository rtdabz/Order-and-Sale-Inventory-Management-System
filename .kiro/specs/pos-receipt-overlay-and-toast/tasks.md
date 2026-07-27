# Implementation Plan: POS receipt overlay and checkout toast

## Overview

Frontend-only change across five files. The shared `Portal` primitive lands first, then its two
consumers (`Modal`, `ReceiptModal`) are routed through it, then the receipt shell/paper split is
made — shell first with the in-paper print control suppressed, so no step leaves the overlay with
two print buttons or none. Notification changes in `PosCart` are independent of the overlay work and
can land alongside it.

Language: TypeScript / React (existing `FE/` Vite app). No new dependencies.

Requirement references use the seven numbered requirements in `requirements.md`
(`R{requirement}.{criterion}`, e.g. `R2.4` = Requirement 2, acceptance criterion 4).

Per the design's "Correctness properties" section there are **no property-based tests** in this
plan: the change is a DOM-mounting correction, two notification calls and a presentation
restructure, with no pure function or input space to quantify over. Verification is the two build
commands (task 6) plus the manual browser checklist (task 7).

## Tasks

- [x] 1. Shared Portal primitive
  - [x] 1.1 Create `FE/src/components/ui/portal/Portal.tsx`
    - New file. Default-export a `Portal` component taking `{ children: ReactNode }` and returning
      `createPortal(children, document.body)` from `react-dom`.
    - No `typeof document` guard — this is a client-only Vite app with no SSR.
    - Add the doc comment explaining *why* it exists: overlays opened from inside a transformed
      container (the POS cart drawer animates with `transition-transform`) would otherwise resolve
      `position: fixed` against that container instead of the viewport.
    - Nothing consumes it yet; it is wired up in tasks 2.1 and 3.1.
    - _Requirements: R1.5_

- [x] 2. Route the shared Modal through the portal
  - [x] 2.1 Portal the returned tree in `FE/src/components/ui/modal/index.tsx`
    - Import `Portal` and wrap the returned overlay tree in `<Portal>`, replacing the existing
      inline `createPortal(..., document.body)` call so the mounting reason lives in one place.
    - Leave the existing Escape handler, scroll lock, `isFullscreen` branch and close button exactly
      as they are.
    - This is what makes `ConfirmDialog` (checkout confirmation and clear-cart confirmation) render
      full-page when opened from the drawer, with no change to `ConfirmDialog` itself.
    - _Requirements: R1.5, R1.6_

- [x] 3. Receipt overlay shell
  - [x] 3.1 Portal, overlay hygiene, scroll lock and Escape in `FE/src/components/pos/ReceiptModal.tsx`
    - Wrap the overlay in `<Portal>` in place of the inline `createPortal(..., document.body)` call.
    - On the overlay root, drop `h-screen w-screen` and keep `fixed inset-0`; `w-screen` (`100vw`)
      includes the scrollbar gutter and can force horizontal overflow. Keep `overflow-y-auto` on the
      overlay as the outer scroll fallback.
    - Add a scroll-lock `useEffect`: save the previous `document.body.style.overflow`, set it to
      `hidden`, restore the saved value on cleanup (do not hardcode a default).
    - Add an Escape `useEffect` that calls `onClose` on `Escape`, with listener removal on cleanup.
    - **Both hooks must sit ABOVE the `if (!open || !receipt) return null;` early return**, each
      guarded with `if (!open) return;` inside the effect body, so hook order stays stable across
      renders.
    - Keep the backdrop `onClick={onClose}` and the inner `onClick={(e) => e.stopPropagation()}`.
    - _Requirements: R1.1, R1.2, R1.3, R1.4, R1.5, R2.1, R2.2, R2.3, R2.4, R2.5, R2.6, R6.3_
  - [x] 3.2 Header strip and footer action bar in `FE/src/components/pos/ReceiptModal.tsx`
    - Restructure the centred card into three regions: header strip, the `OrderReceipt` paper,
      footer action bar. Only the paper carries `#order-receipt` (task 4), so controls live outside
      the printed markup.
    - Header strip: success check icon in an emerald circle, `Sale complete` heading, and the amount
      charged (`formatCurrency(receipt.total)`) as the supporting line. Move the existing close
      button into this strip and delete the floating `absolute -right-3 -top-3` variant; keep its
      `aria-label="Close receipt"`.
    - Footer action bar: primary `Print receipt` button calling `printReceipt('order-receipt')`, and
      a secondary `Done` button calling `onClose`.
    - Autofocus `Print receipt` when the overlay opens (`autoFocus`, or a ref focused in an effect
      that also sits above the early return) so `Enter` prints.
    - Pass `showPrintButton={false}` to `OrderReceipt` in this task so the in-paper button
      disappears at the same moment the footer button appears — no step with two print controls.
      Task 4.1 removes both the prop and the paper's button branch.
    - Header strip and action bar keep their `dark:` styling; the paper does not (task 4.2).
    - _Requirements: R5.1, R5.2, R5.6, R5.7, R5.8, R6.1_

- [x] 4. Receipt paper
  - [x] 4.1 Remove the print control from the paper in `FE/src/components/common/OrderReceipt.tsx`
    - Delete the trailing `showPrintButton && onPrint` button block, the `onPrint` and
      `showPrintButton` props from `OrderReceiptProps`/destructuring, and the now-unused `Printer`
      import.
    - Remove the temporary `showPrintButton={false}` prop from the `OrderReceipt` call in
      `ReceiptModal.tsx` (added in 3.2) so no orphan prop is left behind.
    - Check for other `OrderReceipt` consumers passing `onPrint`/`showPrintButton` and update them
      to render their own print control outside the paper, so type checking stays clean.
    - **Keep the root element's `id="order-receipt"`** — `printReceipt('order-receipt')` looks the
      paper up by that id and must continue to work unchanged.
    - **Leave the `button { display: none !important; }` rule in `FE/src/lib/printReceipt.ts` IN
      PLACE.** It becomes redundant now that no control sits inside the paper, but it is the only
      defence against a future in-paper control (reprint link, void button, barcode toggle) being
      printed on a customer's receipt. Do not remove it.
    - All receipt data stays: transaction number, date, every line item with
      `quantity × unit price`, item count, total, payment method, amount tendered, footer note.
    - _Requirements: R6.4, R6.5, R6.6, R6.7, R7.2, R7.3_
  - [x] 4.2 Compact layout, change-due callout and conditional rows in `FE/src/components/common/OrderReceipt.tsx`
    - Brand block: reduce the logo to ~40px and set it inline beside a `text-2xl` wordmark (down
      from a 60px logo above a `text-4xl` wordmark), with the `Sales receipt` caption beneath.
    - Change-due callout: render a prominent emerald block directly below the total showing
      `Change due` and the amount at the largest type size in the paper after the total. Gate it on
      the payment method being cash **AND** `changeDue > 0` — suppressed entirely for non-cash, and
      for cash with zero or absent change. Remove the old small `Change` row it replaces.
    - `Amount tendered` row: render only when the method is cash and `amountPaid` is present;
      suppress it for non-cash sales.
    - Bounded item list: wrap the line-item list in a container with a `max-h` plus
      `overflow-y-auto` so long baskets scroll inside the paper while brand block, total and the
      overlay's action bar stay visible.
    - Paper stays paper: drop the `dark:bg-gray-800` / `dark:border-gray-600` recolouring of the
      receipt surface and the `dark:` text/border overrides inside it, so the paper is white in both
      themes and matches print output (the print stylesheet forces `background: #fff; color: #000`).
    - Keep `id="order-receipt"` on the root; keep the `Items` count row and the footer note.
    - _Requirements: R5.3, R5.4, R5.5, R5.8, R6.1, R6.2, R7.2, R7.3_

- [x] 5. Checkout notifications in `FE/src/components/pos/PosCart.tsx`
  - [x] 5.1 Success toast fired with the receipt
    - Replace the current generic `Order … placed successfully!` toast with one that states the
      amount charged: title `Sale recorded · ${formatCurrency(snapshot.total)}`.
    - Description: `Change due ${formatCurrency(snapshot.change)}` when `snapshot.method === 'cash'`
      and an amount was tendered; otherwise `Paid by ${paymentLabel}`, where `paymentLabel` comes
      from `PAYMENT_METHODS.find((m) => m.value === snapshot.method)?.label ?? snapshot.method`.
    - `duration: 4000`, longer than the default because the receipt overlay competes for attention.
    - Read every value from `snapshot`, not from live cart/payment state — `clearOrders()` and
      `resetPayment()` have already run.
    - Fire it immediately before `setReceiptOpen(true)` so message and receipt land together.
    - Omit the transaction number; it is already the first line of the visible receipt.
    - Leave `invalidateOrderData()`, `invalidateProductData()`, `announceSaleRecorded()`,
      `setReceipt(...)`, `clearOrders()` and `resetPayment()` untouched.
    - _Requirements: R3.1, R3.2, R3.3, R3.4, R3.5, R3.6, R3.7, R7.1_
  - [x] 5.2 Error path onto the toast channel
    - Replace the `Swal.fire({ title: 'Order failed', ... })` call in the `catch` block with
      `toast.error('Order failed', { description: error?.response?.data?.message || 'Failed to place order. Please try again.' })`.
    - The `.swal2-container` z-index override goes away with it; keep the `console.error` and the
      `finally { setSubmitting(false); }`.
    - Drop `import Swal from 'sweetalert2';` from this file. Leave `sweetalert2` in
      `package.json` — `ProductTable.tsx` and `products.tsx` still use it.
    - _Requirements: R4.1, R4.2, R4.3, R4.4, R7.6_

- [x] 6. Build checkpoint
  - [x] 6.1 Run type checking and the production build
    - From the `FE/` directory: `npx tsc -b` — must be clean.
    - From the `FE/` directory: `npm run build` — must succeed.
    - Fix any new type or build error introduced by tasks 1–5. Ask the user if questions arise.
    - _Requirements: R7.5_

- [ ]* 7. Manual verification (human, not an automated check)
  - [ ]* 7.1 Walk the design's manual checklist in a browser
    - **Performed by a person, not by a coding agent. Requires the Laravel API running** plus the
      Vite dev server; none of these steps can be asserted in jsdom — layout outcomes report zero
      element heights there, and print preview and dark-mode rendering need a real browser.
    - 1. Below `xl`: open the drawer and check out. The backdrop dims the entire viewport, not just
      the 420px drawer, and the receipt is centred on the page.
    - 2. At `xl`+: check out from the docked cart. Regression check — behaviour unchanged.
    - 3. Cash tendered above total: toast reads `Sale recorded · ₱…` with `Change due ₱…`. Repeat
      with GCash: description reads `Paid by GCash`.
    - 4. With the receipt open: `Escape` closes it, the page behind does not scroll, and no
      horizontal scrollbar appears.
    - 5. Force an API failure (stop the API or point it at a bad route): an error toast shows the
      server message and no SweetAlert dialog appears.
    - 6. Below `xl`, from the drawer, press Charge and stop at the confirmation dialog: it is
      full-page too, confirming the `Modal` fix.
    - 7. At roughly 1024×522 the whole receipt fits — the footer action bar is on screen and not cut
      off.
    - 8. Check out a basket long enough to overflow: the item list scrolls inside the paper while
      brand block, total and action bar stay visible.
    - 9. Cash tendered above total: the emerald `Change due` callout renders under the total. Exact
      cash and GCash: the callout is absent, and `Amount tendered` is absent for GCash.
    - 10. Press `Print receipt`: the print preview contains no buttons and its content matches the
      on-screen paper.
    - 11. Toggle dark mode with the receipt open: the paper stays white while header strip, action
      bar and backdrop follow the dark theme.
    - 12. With the overlay open, `Print receipt` holds focus so `Enter` prints; `Done` closes the
      overlay.
    - _Requirements: R1.1, R1.2, R1.3, R1.4, R1.6, R1.7, R2.1, R2.2, R2.4, R2.6, R3.1, R3.3, R3.4, R4.1, R4.2, R4.4, R5.3, R5.4, R5.5, R5.6, R5.7, R5.8, R6.1, R6.2, R6.4, R6.5, R7.4_

## Notes

- Tasks marked with `*` are not implemented by the coding agent. Task 7 is a human browser pass and
  needs a running Laravel API.
- No property-based tests: the design's "Correctness properties" section concludes none are
  warranted, and this plan honours that. Verification is task 6's build commands plus task 7's
  manual checklist.
- Ordering rule behind the sequence: the `Portal` primitive (1.1) lands before its consumers (2.1,
  3.1); the footer print control appears in the same task that suppresses the in-paper one (3.2),
  and the paper's print branch and the temporary prop are removed together (4.1).
- `printReceipt.ts` is deliberately **not** in the change set. Its `button { display: none }` rule
  stays as defence.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "5.1"] },
    { "id": 2, "tasks": ["3.2", "5.2"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["7.1"] }
  ]
}
```
