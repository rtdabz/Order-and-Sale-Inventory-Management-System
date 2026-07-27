# Design: POS receipt overlay and checkout toast

## Overview

Two defects and one presentation gap on the POS checkout path:

1. The receipt backdrop does not cover the page. It is clipped to the containing block of whichever
   cart opened it.
2. Placing an order produces no confirmation message — only the receipt appears.
3. The receipt presents a document rather than an outcome, buries change due, prints its own control
   and overflows a short till display.

All three live in the checkout flow of `PosCart` and its overlays. The fix introduces a shared
`Portal` primitive so overlays escape their ancestors' containing blocks, moves the checkout
success/failure feedback onto the `sonner` toast channel that the rest of the app already uses, and
splits the receipt overlay into an outcome-first shell around a paper that stays print-clean.

No backend change. No change to order submission, receipt content, printing, or cache
invalidation.

---

## Problem analysis

### Bug 1 — receipt backdrop is clipped to the drawer

`FE/src/components/pos/ReceiptModal.tsx` renders its overlay inline in the React tree:

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-label={title}
  onClick={onClose}
  className="fixed inset-0 z-[999999] flex h-screen w-screen items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
  style={{ margin: 0 }}
>
```

`position: fixed` resolves against the viewport **only when no ancestor establishes a containing
block**. `FE/src/components/pos/PosCartDrawer.tsx` mounts the cart inside a transformed element:

```tsx
<aside
  className={`fixed right-0 top-0 z-[100001] flex h-screen w-full max-w-[420px] flex-col ... transition-transform duration-300 ease-in-out ... ${
    isOpen ? 'translate-x-0' : 'translate-x-full'
  }`}
>
  <PosCart onClose={toggleSidebar} className="h-full" />
</aside>
```

`transition-transform` plus `translate-x-0` / `translate-x-full` means the `<aside>` always has a
`transform` other than `none`, which makes it the containing block for every fixed-position
descendant. The overlay is therefore measured against the 420px drawer, not the viewport. `z-index`
cannot correct this — the containing block is a layout fact, not a stacking one. The overlay has to
leave the transformed subtree entirely, which means a portal.

The same exposure applies to `ConfirmDialog`, which renders through the shared `Modal` at
`FE/src/components/ui/modal/index.tsx`:

```tsx
return (
  <div className="fixed inset-0 flex items-center justify-center overflow-y-auto modal z-99999">
```

Also inline, also mounted inside `PosCart`. The checkout confirmation dialog is clipped in the
drawer for exactly the same reason, even though it has not been reported yet. Fixing only the
receipt leaves a matching bug one interaction away.

Secondary issue in the same element: `h-screen w-screen` is redundant beside `inset-0`, and
`w-screen` (`100vw`) includes the scrollbar gutter, which can push horizontal overflow. `inset-0`
alone is correct.

#### Observed evidence

A user screenshot of the open receipt, viewport roughly 1024×522, confirms the clipping
empirically. The dimmed and blurred backdrop covers **only the main content column**. The left
sidebar stays fully crisp and bright, and the top header — notification bell, `Admin` menu — is
untouched as well. Only the region to the right of the sidebar and below the header is dimmed.

That footprint is wider than the 420px drawer, so on this capture the containing block is an
ancestor on the docked path rather than the drawer `<aside>`. Candidate ancestors there, recorded
for completeness:

- `AppLayout`'s content wrapper — `flex-1 transition-all duration-300 ease-in-out`
  (`FE/src/layout/AppLayout.tsx`)
- `#main-content` — `mx-auto max-w-screen-2xl p-4 md:p-6` (same file)
- the docked cart's `sticky top-24 h-[calc(100vh-8rem)]` container
  (`FE/src/pages/OrderPage/orderpage.tsx`)

**The exact mechanism does not have to be pinned down to fix it.** Portalling to `document.body`
removes the overlay from every ancestor-induced containing block, stacking context, `overflow` clip
and `position: sticky`/`transform` subtree at once. That is a strength of the chosen fix rather than
a gap in the diagnosis: it is mechanism-agnostic, so it holds whichever of the candidates above is
the active cause on any given breakpoint, and it holds if these layout classes change later.

The same screenshot shows the receipt card tall enough to be cut off at the bottom of a 522px-tall
viewport. That is a second, independent defect, and it motivates the height handling in the receipt
presentation redesign below.

### Bug 2 — no confirmation after a sale is recorded

The success path of `placeOrder` in `FE/src/components/pos/PosCart.tsx`:

```tsx
invalidateOrderData();
invalidateProductData();
announceSaleRecorded();

setReceipt({ /* ... */ });

clearOrders();
resetPayment();
setReceiptOpen(true);
```

Nothing user-facing is emitted. The cashier sees a receipt appear and has to infer that the sale
succeeded. The only branch that speaks to the user is the failure branch, and it uses a different
library with a manual stacking workaround:

```tsx
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
```

`<Toaster />` from `sonner` is already mounted in `App.tsx`, and `OrderContext` already notifies
through `toast`, so the toast channel is available and is the consistent choice for both branches.

---

## Design

### Portal primitive

New file `FE/src/components/ui/portal/Portal.tsx`:

```tsx
import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children into `document.body`.
 *
 * Overlays opened from inside a transformed container (e.g. the POS cart drawer,
 * which animates with `transition-transform`) would otherwise resolve
 * `position: fixed` against that container instead of the viewport.
 */
const Portal = ({ children }: { children: ReactNode }) => createPortal(children, document.body);

export default Portal;
```

A shared primitive rather than two inline `createPortal` calls: both overlays need it now, and any
future overlay opened from inside the drawer — or any other transformed container — will need it
too. Naming the reason once, in one place, is what stops this bug recurring. Vite client-only app
with no SSR, so no `typeof document` guard is needed.

### ReceiptModal

- Wrap the overlay in `<Portal>`.
- Drop `h-screen w-screen`, keep `fixed inset-0`.
- Lock background scroll while open — save the previous `document.body.style.overflow` and restore
  it on cleanup, matching how `PosCartDrawer` and `Modal` behave.
- Close on `Escape`, matching `Modal`.

```tsx
useEffect(() => {
  if (!open) return;
  const previous = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => {
    document.body.style.overflow = previous;
  };
}, [open]);

useEffect(() => {
  if (!open) return;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [open, onClose]);
```

Both hooks must sit above the `if (!open || !receipt) return null;` early return, guarded by
`open`, to keep hook order stable.

### Modal

Wrap the returned tree in `<Portal>`. One structural change; the existing Escape handler and
scroll lock stay untouched. This transparently fixes `ConfirmDialog` — both the checkout
confirmation and the clear-cart confirmation — and every other `Modal` consumer in the app.

### Consequence of portalling: the two PosCart instances

`FE/src/pages/OrderPage/orderpage.tsx` mounts `PosCart` twice:

```tsx
<aside className="hidden xl:col-span-4 xl:block 2xl:col-span-3">
  <PosCart className="h-full" />
</aside>
...
<div className="xl:hidden">
  <PosCartDrawer isOpen={cartOpen} toggleSidebar={() => setCartOpen((open) => !open)} />
</div>
```

Today an ancestor's `display: none` hides the inactive instance's overlays as a side effect of
being inside that subtree. **After portalling, ancestor `display: none` no longer suppresses them**,
because the overlay is no longer a DOM descendant of the hidden container.

This is safe as designed: `receiptOpen`, `confirmOpen` and `clearConfirmOpen` are per-instance
`useState`, and only the instance the cashier actually interacts with ever sets them. The hidden
instance holds all-false state and renders nothing.

One behavioural change follows: a receipt opened from the drawer stays visible if the window is
resized past `xl`. Acceptable, and arguably better than a receipt vanishing mid-transaction.

Rejected alternatives:

- **Hoist receipt state into a context so a single overlay serves both instances.** Correct, but it
  spreads checkout state across another provider and adds a coordination layer this bug does not
  warrant.
- **Render one `PosCart` that moves between the docked and drawer containers.** Unmounting on
  resize discards cart contents and captured payment state mid-sale.

### Checkout toast

One `toast.success` fired immediately before `setReceiptOpen(true)`, so the message and the receipt
land together:

```tsx
const paymentLabel = PAYMENT_METHODS.find((m) => m.value === snapshot.method)?.label ?? snapshot.method;

toast.success(`Sale recorded · ${formatCurrency(snapshot.total)}`, {
  description:
    snapshot.method === 'cash' && hasTendered
      ? `Change due ${formatCurrency(snapshot.change)}`
      : `Paid by ${paymentLabel}`,
  duration: 4000,
});
```

- Title carries the amount charged — the fact being confirmed.
- Change due earns the description slot because it is the number the cashier acts on next. When
  there is no change to give (non-cash, or cash with no amount tendered), the payment method fills
  the slot instead.
- `duration: 4000` is longer than the default because the receipt overlay is competing for
  attention at the same moment.
- The transaction number is deliberately omitted — it is already the first line of the visible
  receipt.

Reads from `snapshot`, not from live state, because `clearOrders()` and `resetPayment()` have
already run by this point.

### Error path

Replace the `Swal.fire` call with:

```tsx
toast.error('Order failed', {
  description: error?.response?.data?.message || 'Failed to place order. Please try again.',
});
```

Success and failure then share one channel, and the `.swal2-container` z-index override
disappears with it. This removes the last `sweetalert2` usage in `PosCart`, so
`import Swal from 'sweetalert2';` is dropped. `sweetalert2` stays a project dependency —
`ProductTable.tsx` and `products.tsx` still use it.

---

## Receipt presentation redesign

Fixing the backdrop makes the receipt visible on the whole page. That exposes what the receipt
itself communicates, which is where the second half of this design sits.

### Current state

From `FE/src/components/common/OrderReceipt.tsx`:

- The root is the printed element and also the control host:

  ```tsx
  <div
    id="order-receipt"
    className="mx-auto w-[420px] max-w-full rounded-lg border-2 border-gray-300 bg-white p-8 shadow-2xl dark:border-gray-600 dark:bg-gray-800"
  >
  ```

  with the Print button as its last child:

  ```tsx
  {showPrintButton && onPrint && (
    <button onClick={onPrint} className="mt-6 flex w-full ... print:hidden">
      <Printer className="h-5 w-5" />
      Print receipt
    </button>
  )}
  ```

- Brand block: a 60px logo, a `text-4xl font-bold tracking-widest` MKB wordmark and a
  `Sales receipt` caption, stacked and centred (`flex flex-col items-center gap-3`).
- An `Items` count row sits directly above the `TOTAL` row.
- The payment block renders `Amount tendered` and `CHANGE` unconditionally whenever `showPayment`
  is true — the guards are only `!== null && !== undefined`, not value or method checks.
- Dark mode restyles the paper itself: `dark:bg-gray-800 dark:border-gray-600`.
- There is no internal scroll container for the item list.

### Problems

**P1 — the print action is inside the printed element.** `printReceipt('order-receipt')`
(`FE/src/lib/printReceipt.ts`) copies `source.innerHTML` of `#order-receipt` into the print window,
so the button is copied along with the receipt. The inlined print stylesheet compensates:

```css
button { display: none !important; }
```

The action belongs outside the paper. Moving it removes the need for that rule and makes the
printed DOM equal the paper.

**P2 — no success affirmation.** The overlay shows a document, not an outcome. Nothing on it states
that the sale succeeded; the cashier infers it from the receipt's existence. This is the same gap
the checkout toast addresses, but the overlay is where the eye actually is at that moment.

**P3 — change due is not the focal point.** For a cash sale, change due is the cashier's next
physical action. It renders as an ~8px `text-sm` row inside a secondary block, visually below a
`text-3xl` TOTAL that is no longer actionable. The hierarchy is inverted relative to what the
cashier needs.

**P4 — zero-value noise.** `CHANGE ₱0.00` and `Amount tendered` render for non-cash sales and
exact-cash sales, where neither carries information.

**P5 — vertical budget.** The 60px logo, `text-4xl` wordmark, `p-8` padding and unbounded item list
make the card overflow short till displays. The screenshot at 522px tall shows this happening.

**P6 — paper metaphor breaks in dark mode.** A receipt is white paper. Recolouring it to
`gray-800` weakens the metaphor and diverges from what actually prints, since the print stylesheet
forces `background: #fff; color: #000`.

### Design

**Split the shell from the paper.** `ReceiptModal` gains three regions inside the centred card:

1. a header strip,
2. the receipt paper — `#order-receipt`, id unchanged so `printReceipt` keeps working,
3. a footer action bar.

Only the paper keeps the id, so the printed markup contains no controls. This resolves P1
structurally rather than by styling.

The `button { display: none !important; }` rule in `printReceipt.ts` **stays in place**. It becomes
redundant for the current tree, but it costs one line and it is the only thing standing between a
future in-paper control — a reprint link, a void button, a barcode toggle — and that control being
printed on a customer's receipt. Removing a defence because the current code no longer trips it is
how P1 comes back.

**Header strip — the outcome, not the document.** A success check icon in an emerald circle,
`Sale complete` as the heading, and the amount charged as the supporting line. This resolves P2 at
the point of attention. The existing close button relocates into this strip, replacing the
`absolute -right-3 -top-3` button that currently floats over the card's corner.

**Change-due callout.** When the method is cash *and* change is greater than zero, a prominent
emerald block renders directly under the total: `Change due` with the amount at display size — the
largest type in the paper after the total. Suppressed entirely otherwise. That suppression resolves
P4 together with hiding `Amount tendered` when the sale is not cash, and it resolves P3 by putting
the actionable number where the eye lands after the total.

**Compact brand block.** Logo reduced to ~40px and set inline beside a `text-2xl` wordmark, with
the `Sales receipt` caption beneath. Recovers roughly a third of the block's vertical space and
addresses the largest single contributor to P5.

**Height handling.** The paper gets a bounded item list — `max-h` with `overflow-y-auto` — so the
brand, total, payment block and action bar stay visible on a short viewport while long baskets
scroll internally. The overlay keeps its own `overflow-y-auto` as the outer fallback for the case
where even the compacted chrome exceeds the viewport.

**Paper stays paper.** Drop the `dark:` recolouring of the receipt surface. It is white in both
themes and matches print output, resolving P6. Dark mode still applies to the modal shell around
it — header strip, footer action bar, backdrop — so the overlay still reads as part of a dark UI.

**Footer action bar.** `Print receipt` as the primary action, plus a `Done` secondary that closes
the overlay, so finishing a sale does not require hunting the X. `Print receipt` is autofocused on
open, so Enter prints.

### Scope boundary

No receipt **data** changes. Transaction number, date, line items, `quantity × unit price`, item
count, total, payment method, amount tendered and the footer note are all still rendered.
`OrderReceipt`'s props are unchanged apart from what the shell/paper split requires — the print
button moves out of the component, so `onPrint`/`showPrintButton` are no longer the paper's
concern. This is presentation only.

---

## Files affected

| File | Change |
| --- | --- |
| `FE/src/components/ui/portal/Portal.tsx` | New. `createPortal` into `document.body` |
| `FE/src/components/pos/ReceiptModal.tsx` | Portal, drop `h-screen w-screen`, scroll lock, Escape; header strip with success state and relocated close button; footer action bar with `Print receipt` and `Done` |
| `FE/src/components/common/OrderReceipt.tsx` | Compact brand block, change-due callout, conditional payment rows, bounded item list, paper stays light |
| `FE/src/components/ui/modal/index.tsx` | Portal the returned tree |
| `FE/src/components/pos/PosCart.tsx` | Success toast; error path to `toast.error`; drop `Swal` import |

---

## Verification

Automated, from `FE/`:

- `npx tsc -b` — clean.
- `npm run build` — succeeds.

Manual, requires the Laravel API running:

1. Below `xl`: open the drawer, check out. The backdrop dims the **entire viewport**, not just the
   420px drawer, and the receipt is centred on the page.
2. At `xl`+: check out from the docked cart. Regression check — behaviour unchanged.
3. Cash with an amount tendered above the total: toast reads `Sale recorded · ₱…` with
   `Change due ₱…`. Switch to GCash and repeat: description reads `Paid by GCash`.
4. With the receipt open: `Escape` closes it, the page behind does not scroll, and no horizontal
   scrollbar appears.
5. Force an API failure (stop the API, or point it at a bad route): an error toast appears with the
   server message, and no SweetAlert dialog.
6. Below `xl`, from the drawer, press Charge and stop at the confirmation dialog: it is full-page
   too, confirming the `Modal` fix.

Receipt presentation:

7. At roughly 1024×522 — the screenshot's dimensions — the whole receipt fits: the footer action
   bar is on screen and not cut off.
8. Check out a basket long enough to overflow: the item list scrolls **inside** the paper while the
   brand block, total and action bar stay visible.
9. Cash with an amount tendered above the total: the emerald `Change due` callout renders under the
   total. Exact cash (tendered equals total) and GCash: the callout is absent, and `Amount tendered`
   is absent for GCash.
10. Press `Print receipt`: the print preview contains no buttons and its content matches the
    on-screen paper.
11. Toggle dark mode with the receipt open: the paper stays white, and the header strip, action bar
    and backdrop follow the dark theme.
12. With the overlay open, `Print receipt` holds focus, so Enter prints; `Done` closes the overlay.

## Correctness properties

*A property is a characteristic or behavior that should hold true across all valid executions of a
system — a formal statement about what the system should do.*

None. Every criterion in this design classifies as an example, an edge case, a side-effect
assertion, a real-browser layout check or a build-level smoke check.

The change is a DOM-mounting correction, two notification calls and a presentation restructure. It
introduces no parser, serializer, data transformation or algorithm — there is no pure function and
no input space over which to universally quantify. The two criteria that read most like properties
do not survive scrutiny:

- *the change-due callout renders exactly when the sale is cash with change* is a branch over a
  small enumerable domain whose only interesting value is the zero boundary. Four rendered cases
  cover it exhaustively; randomized iteration would restate the condition, not constrain it.
- *every receipt datum still appears in the output* reduces to string-contains assertions over
  directly interpolated props. A fixture with multiple line items, notes and a large total covers
  every shape the POS can produce.

Layout outcomes (steps 7, 8) are not unit-testable at all — jsdom reports zero element heights, so
they need a real browser or the eye. The class contract for the bounded list (`max-h` plus
`overflow-y-auto`) can be asserted statically; the visual result cannot.

---

## Requirements addressed

This spec entered at the design phase, so these were recorded here first. They are now expanded
with user stories and EARS acceptance criteria in `requirements.md` alongside this document; this
design remains the source of technical detail.

- **R1** — The receipt backdrop covers the full viewport regardless of which cart presentation
  opened it. *Verified by steps 1, 2, 4.*
- **R2** — Recording a sale gives explicit confirmation of the amount charged and, for cash, the
  change due. *Verified by step 3.*
- **R3** — Failure feedback uses the same notification channel as success. *Verified by step 5.*
- **R4** — No regression to existing checkout, receipt printing, cache invalidation or
  cart-clearing behaviour. *Verified by the build checks and steps 2, 6.*
- **R5** — Completing a sale presents the outcome, not just the document: the success state and the
  amount charged are stated, and change due is the visual focus when there is change to give.
  *Verified by steps 9, 11, 12.*
- **R6** — The receipt fits a short till display and remains printable without controls appearing
  in the printed output. *Verified by steps 7, 8, 10.*
