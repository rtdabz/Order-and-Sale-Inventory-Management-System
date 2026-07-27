# Requirements: POS receipt overlay and checkout toast

## Introduction

Two defects and one presentation gap on the POS Terminal checkout path:

1. The receipt overlay's dimmed backdrop does not cover the page. A user screenshot at roughly
   1024×522 shows it clipped to the main content column, with the sidebar and header untouched.
2. Recording a sale produces no confirmation message. The receipt appears and the cashier infers
   success.
3. The receipt presents a document rather than an outcome: nothing states the sale succeeded, change
   due is a small secondary row, zero-value payment rows render for non-cash sales, and the card
   overflows a short till display.

This spec entered at the design phase at the user's choice. These requirements were recorded
afterwards, back-filled from `design.md`, which remains the source of technical detail — component
paths, the `Portal` primitive, the shell/paper split and the rejected alternatives all live there.

Scope is frontend only. No backend change, and no change to order submission, receipt data, cache
invalidation or cart clearing.

---

## Requirement 1 — Full-viewport receipt overlay (R1)

**User Story:** As a cashier, I want the receipt to open over the whole screen, so that it reads as
a modal step in the sale rather than a panel clipped inside the cart.

### Acceptance Criteria

1. WHEN the receipt overlay opens THEN the system SHALL render its backdrop across the full
   viewport, covering the sidebar and the top header.
2. WHEN the receipt overlay is opened from the mobile cart drawer THEN the system SHALL cover the
   full viewport, not the drawer's 420px width.
3. WHEN the receipt overlay is opened from the docked cart at `xl` and above THEN the system SHALL
   cover the full viewport.
4. WHEN the receipt overlay is open THEN the system SHALL centre the receipt on the page.
5. WHEN any overlay is opened from inside the cart THEN the system SHALL mount it outside every
   ancestor that could establish a containing block, stacking context or overflow clip.
6. WHEN the checkout confirmation dialog or the clear-cart confirmation dialog opens from the cart
   drawer THEN the system SHALL cover the full viewport on the same basis.
7. IF the window is resized past the `xl` breakpoint while a receipt opened from the drawer is
   showing THEN the system SHALL keep that receipt visible rather than discarding it mid-transaction.

---

## Requirement 2 — Overlay interaction (R1)

**User Story:** As a cashier, I want to dismiss the receipt the way every other dialog behaves, so
that I do not have to hunt for the way out.

### Acceptance Criteria

1. WHEN the receipt overlay is open AND the `Escape` key is pressed THEN the system SHALL close the
   overlay.
2. WHEN the receipt overlay is open AND the backdrop outside the receipt is clicked THEN the system
   SHALL close the overlay.
3. WHEN the receipt itself or any of its controls is clicked THEN the system SHALL NOT close the
   overlay.
4. WHEN the receipt overlay is open THEN the system SHALL prevent the page behind it from scrolling.
5. WHEN the receipt overlay closes THEN the system SHALL restore the page's previous scroll
   behaviour rather than assuming a default.
6. WHEN the receipt overlay is open THEN the system SHALL NOT introduce a horizontal scrollbar.

---

## Requirement 3 — Sale confirmation (R2)

**User Story:** As a cashier, I want an explicit confirmation when a sale is recorded, so that I know
the order reached the system and how much change to hand back.

### Acceptance Criteria

1. WHEN an order is successfully placed THEN the system SHALL emit a success notification stating
   that the sale was recorded and the amount charged.
2. WHEN the success notification is emitted THEN the system SHALL do so at the same moment the
   receipt overlay opens, so message and receipt land together.
3. IF the payment method is cash AND an amount was tendered THEN the notification SHALL state the
   change due.
4. IF the payment method is not cash, OR no amount was tendered THEN the notification SHALL state
   the payment method instead of the change due.
5. WHEN the success notification is emitted THEN the system SHALL take its values from the
   transaction snapshot rather than live cart or payment state, which have already been reset.
6. WHEN the success notification is emitted THEN the system SHALL hold it on screen long enough to
   be read while the receipt overlay competes for attention.
7. WHEN the success notification is emitted THEN the system SHALL omit the transaction number, which
   is already the first line of the visible receipt.

---

## Requirement 4 — Failure feedback (R3)

**User Story:** As a cashier, I want a failed sale reported the same way a successful one is, so that
I read both outcomes off the same channel and can trust that silence means nothing happened.

### Acceptance Criteria

1. WHEN order submission fails THEN the system SHALL report the failure on the same notification
   channel used for success.
2. WHEN order submission fails AND the server returns a message THEN the system SHALL show that
   message.
3. IF order submission fails AND no server message is available THEN the system SHALL show a generic
   retry message.
4. WHEN order submission fails THEN the system SHALL NOT open a blocking dialog, and SHALL NOT
   require a manual stacking-order override to be visible.

---

## Requirement 5 — Outcome-first receipt presentation (R5)

**User Story:** As a cashier, I want the receipt overlay to tell me the sale is done and what change
to give, so that I act on the outcome instead of reading a document to infer it.

### Acceptance Criteria

1. WHEN the receipt overlay opens after a completed sale THEN the system SHALL display a success
   state and the amount charged above the receipt, outside the receipt paper.
2. WHEN the receipt overlay is open THEN the system SHALL place the close control in the overlay's
   header region rather than floating it over the receipt's corner.
3. IF the payment method is cash AND the change due is greater than zero THEN the system SHALL
   display a prominent change-due callout directly below the total, at the largest type size in the
   receipt after the total itself.
4. IF the payment method is not cash, OR the change due is zero or absent THEN the system SHALL
   suppress the change-due callout entirely.
5. IF the payment method is not cash THEN the system SHALL suppress the `Amount tendered` row.
6. WHEN the receipt overlay is open THEN the system SHALL offer `Print receipt` as the primary
   action and a `Done` action that closes the overlay, both outside the receipt paper.
7. WHEN the receipt overlay opens THEN the system SHALL focus `Print receipt`, so that `Enter`
   prints.
8. WHEN dark mode is active THEN the system SHALL keep the receipt paper white so it matches printed
   output, while the overlay header, action bar and backdrop follow the dark theme.

---

## Requirement 6 — Short-display fit and clean print output (R6)

**User Story:** As a cashier working on a small till display, I want the whole receipt and its
actions on screen, so that I can finish and print a sale without scrolling the page to find the
buttons.

### Acceptance Criteria

1. WHEN the receipt overlay is open on a viewport approximately 520px tall THEN the system SHALL
   keep the brand block, total, payment block and action bar visible, with the action bar not cut
   off.
2. WHEN the receipt contains more line items than fit the available height THEN the system SHALL
   scroll the item list within the receipt while the brand block, total and action bar remain
   visible.
3. WHEN even the compacted receipt exceeds the viewport THEN the overlay SHALL remain scrollable as
   an outer fallback.
4. WHEN the receipt is printed THEN the printed output SHALL contain no buttons or other interactive
   controls.
5. WHEN the receipt is printed THEN the printed content SHALL match the receipt paper shown on
   screen.
6. WHEN the print path copies the receipt markup THEN the system SHALL find the receipt paper under
   its existing element id, so the print helper continues to work unchanged.
7. WHILE no interactive control is rendered inside the receipt paper, the print stylesheet SHALL
   retain its rule hiding buttons, as a defence against a future in-paper control being printed.

---

## Requirement 7 — No regression (R4)

**User Story:** As a shop owner, I want this change confined to how the sale is presented, so that
order recording, receipt contents, printing and stock figures behave exactly as before.

### Acceptance Criteria

1. WHEN a sale is placed THEN the system SHALL submit the order, invalidate order and product
   caches, clear the cart and reset payment state exactly as before this change.
2. WHEN the receipt renders THEN the system SHALL still show the transaction number, date, every
   line item with its `quantity × unit price`, the item count, the total, the payment method, the
   amount tendered where applicable, and the footer note.
3. WHEN the receipt paper's presentation changes THEN the system SHALL NOT change the receipt's
   underlying data or the props supplied to it, beyond what moving the print control out of the
   paper requires.
4. WHEN a sale is placed from the docked cart at `xl` and above THEN the system SHALL behave as it
   did before this change, apart from the new confirmation and the redesigned overlay.
5. WHEN the change is built THEN type checking and the production build SHALL both pass with no new
   errors.
6. WHEN the removed dialog library usage is dropped from the cart THEN the system SHALL leave its
   remaining consumers elsewhere in the app working.
