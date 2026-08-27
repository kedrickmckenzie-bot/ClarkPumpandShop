# TraceOps Convenience Suite Demo

This is a 12-15 minute guided walkthrough of the clean-slate TraceOps c-store suite.

## Demo truth

- **Clark Pump and Shop** is fictional and has exactly **15 stores**, **five approved outside vendors** and a two-person internal maintenance team.
- The hosted project seeds deterministic source records into Cloudflare D1; creates, vendor responses, check-in/out and setup changes are durable hosted writes. Local development resets when its in-memory process restarts.
- The fixture has 379 work orders across 20 months, 372 visits, 138 assets and 222 PM occurrences. Every displayed metric derives from these source records and later workflow events.
- The role picker is a visible preview control, not production authentication. Outbound email/SMS delivery and accounting APIs are not connected.

## 1. Open with the immediate problem: who is onsite?

Start on **Overview** and open the active-visit or visit-exception source queue.

1. Show who is currently checked in, the store, vendor, operator WO and check-in evidence channel.
2. Explain that QR/mobile web, secure work-order link and a trusted store device all create the same visit.
3. Emphasize that TraceOps records approximate observed presence, not certified labor or continuous location tracking.

Position the concept:

> Vendor check-in is the easy starting point. The same visit becomes useful evidence for the work order, optional invoice reference, store cost and equipment history.

## 2. Show the manager star: trace a refrigeration dollar

Open **Overview / Spend**.

1. Start at all 15 stores and identify the refrigeration outlier.
2. Drill `Metro Region -> Store 104 -> Refrigeration -> Walk-ins -> Beer Cave -> Beer Cave Refrigeration System`.
3. Continue into the supporting work orders, two visits and linked invoice allocation.
4. Keep the selected period, cost basis and classification coverage visible.
5. Point out **Unclassified below this level** so shallow work remains in the total instead of disappearing.

The key claim is not the chart itself; it is that the user can open the exact source records explaining the number.

## 3. Create and issue outside work

Create a work order for a warm beer cave.

1. Enter store, observable problem, priority and requested timing. Leave the exact asset deferred to prove that service is not blocked by incomplete classification.
2. At **Who should handle this?**, show all three choices:
   - Internal maintenance
   - Outside vendor
   - Choose later
3. Select **Outside vendor** and search `beer cave`.
4. Show why ColdLine Refrigeration & HVAC ranks first: approved, covers the store and is preferred for refrigeration.
5. Issue the versioned **Work Order / Service Authorization** by demo email/link.
6. Point out the billing instruction requiring the operator work-order number on service documents and invoices.

Keep the identifiers distinct:

```text
Operator work order: CPS-2026-0116
Vendor service ticket: SUM-26-0704
Vendor invoice: SUM-260187
External accounting PO: optional and separate
```

Explain that the vendor may continue using its own dispatch and invoice software. TraceOps does not require the vendor to recreate that workflow.

## 4. Respond without forcing a portal

Open the secure vendor action link.

1. Show **Accept**, **Decline**, **Propose date** and **Ask a question**.
2. Accept the assignment and add the vendor's own ticket number.
3. Return to the work order and show delivery/view/acceptance plus the audit timeline.
4. Mention that recurring vendors may use the optional portal, but an account is never required for this action.

If a vendor responds by phone or email instead, the operator can record that response with actor, channel and timestamp. It never masquerades as a digital acceptance.

## 5. Complete a cross-channel visit

Open the Store 104 QR/mobile flow as a ColdLine Refrigeration & HVAC technician.

1. Confirm the store context and technician/vendor identity.
2. Show that only ColdLine Refrigeration & HVAC's eligible work orders appear.
3. Select the issued warm-beer-cave work order and check in.
4. Return to the manager view to show the visit live.
5. Open the trusted store-device flow, locate the same active visit and check out through that different channel.
6. Choose **Waiting on parts**, optionally add a note/photo and finish.
7. Show that the unresolved outcome created the next accountable follow-up, owner and due time in the same action.

Location evidence, when enabled, is requested only at check-in/out. Denied, inaccurate or outside-radius results remain visible exceptions; they do not block legitimate service by default.

## 6. Show the no-work-order safety valve

Use the ClearFlow HVAC, Plumbing & Kitchen Repair story.

1. Start a visit for an emergency drain backup.
2. Choose **I don't see my work order / No work order provided** and record why the technician is there.
3. Show the unmatched visit in the facilities queue.
4. Create or link the operator work order after review.
5. Preserve that the visit occurred before the work order; never rewrite history to imply prior authorization.

This path keeps vendor participation low-friction without sacrificing accountability.

## 7. Demonstrate optional invoice-reference protection

Open **Invoice references**.

1. Show an invoice that contains the correct operator WO and matches directly.
2. Show another invoice with a missing/mistyped WO reference and amount above NTE.
3. Review the suggested work match, vendor/store/date facts, visit count, approximate observed duration, outcome and available evidence.
4. Confirm the link manually and show the reconciled allocation/unmatched balance.
5. Generate or preview the evidence packet that AP can use in its existing accounting process.

State the boundary clearly: TraceOps flags factual differences for a person. It does not prove labor, reject the invoice, approve payment or replace AP/the general ledger.

## 8. Show PM and lifecycle expansion

Open **PM & Lifecycle**.

1. Follow a seasonal RTU PM occurrence through issuance, vendor visit and completion.
2. Show the compliance numerator, denominator and allowed window, then open the supporting occurrences.
3. Open an older refrigeration asset and inspect manufacturer, model, serial, supplier, install date, warranty, PM and repair/cost history.
4. Review the capital-review reasons: age versus expected life, repeated reactive work, selected maintenance cost versus replacement estimate, warranty and PM history.

Lifecycle is transparent decision support. TraceOps never infers downtime or issues an automatic replacement command.

## 9. Close on fit and expansion

Show how capability configuration keeps the suite approachable:

- **Essential:** work orders, vendor issuance and basic outcomes.
- **Accountable:** adds check-in/out, follow-ups and exception queues.
- **Controlled:** adds NTE/authorization, evidence policy and invoice safeguard.
- **Complete:** adds equipment depth, PM, lifecycle and expanded analytics.

These use one connected record model. A customer can begin with vendor accountability and activate the broader suite without migrating to a different product.

Close with:

> TraceOps tells a c-store operator what happened, who owns the next action, what the work cost and which records support every dollar.

## Seeded cast

The presentation must contain exactly these five approved vendors:

1. ColdLine Refrigeration & HVAC - refrigeration, HVAC, walk-ins, beer caves and ice machines.
2. ClearFlow HVAC, Plumbing & Kitchen Repair - HVAC, plumbing and foodservice equipment.
3. PumpPro Fuel & Dispenser Repair - dispensers, payment terminals and fuel systems.
4. BrightLine Electrical & Lighting - electrical, canopy lighting, signs and low-voltage security.
5. GreenLot Landscaping & Snow Removal - landscaping, snow, parking lots and exterior facilities.

The 15 stores are split across Metro, Lakes and Interstate regions, five stores each. HVAC and Refrigeration have the deepest histories; forecourt, plumbing and exterior work prove that the taxonomy supports other c-store trades.

## Verification

Hosted changes persist in D1. Restart the local process to reset local in-memory interactions to the deterministic baseline.

```bash
npm run db:seed
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

Before presenting, inspect manager dashboard/search, Store 104 detail, work-order creation, vendor action link, technician mobile flow, trusted store-device checkout, no-WO queue, invoice references and PM/lifecycle views at desktop and mobile widths.
