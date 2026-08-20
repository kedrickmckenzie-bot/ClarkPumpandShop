# Financial Data Model

**Status:** approved target with a partial implemented foundation

The platform controls and explains maintenance evidence. It is not a general ledger, AP system, purchasing/receiving suite, tax engine, or payment executor. Invoice capture is optional and must never block basic operational or capital insight.

## Distinct money bases

Never collapse these into `cost` or `approved_amount`:

| Basis | Meaning |
|---|---|
| Estimate/proposal | Vendor pricing evidence for a stated scope; may be revised immutably |
| Quote | A versioned commercial scope/amount submitted for a decision; not authorization |
| Authorization/NTE | Customer-approved scope and ceiling, including base/change/emergency/exception revisions |
| Recorded work cost | Customer-entered/finalized cost attributed to completed work |
| Linked invoice amount | Invoice-line amount confirmed against source Work Orders/Items/Repairs/Visits |
| Unmatched invoice amount | Invoice evidence not yet allocated/confirmed |
| Approved-for-payment | Human-reviewed external AP disposition; does not execute payment |
| Paid amount/status | Optional evidence imported/recorded from accounting; never a platform payment action |
| Warranty-covered/customer-responsible | Coverage classification after diagnosis/decision |
| Value Event | Separately governed realized value, identified exposure, or estimated opportunity |

All money is integer minor units plus currency. No floating-point currency arithmetic. Cross-currency aggregation is prohibited without an explicit rate/source/date model.

## Quote and estimate

The current competitive `EstimateRequest` and immutable `VendorEstimateProposal` preserve pricing-only sourcing under one Work Order. Target `Quote` semantics cover versioned vendor commercial submissions after diagnosis or for direct approval. Each revision retains number, scope, subtotal/tax/fees/total, vendor, Contract Version, submission/expiry, and superseded revision. A selected estimate/Quote does not become recorded cost.

## Authorization

Use immutable `AuthorizationRevision` records for base authorization, change order, emergency authorization, and governed exception. Preserve amount, scope, approver, authority/policy version, timestamp, reason, Contract Version, and superseded revision. Derive the current Authorized Ceiling; do not overwrite history or equate an estimate with permission to proceed.

Approval policies/requests/decisions are separate governance facts. The active worktree contains a partial versioned approval foundation, but the complete operator decision path and full AuthorizationRevision model remain incomplete.

## Invoice evidence

Target `Invoice` stores vendor invoice number/date, subtotal/tax/fees/total, status, supporting file, Contract Version, approved-for-payment amount, optional externally recorded paid amount/status, and exception reasons. Duplicate detection keys organization, vendor, normalized invoice number, amount/date/document signals, and supports governed review rather than silent deletion.

`InvoiceLine` uses controlled categories such as labor, part, travel, diagnostic, equipment rental, disposal, permit, tax, and other fee. Allocation may reference Work Order, Work Item, Repair Item, Site Visit, Asset/Component, Store, and trade. Preserve original line and allocation method (`equal`, `labor`, `work_value`, `manual`, or Contract rule).

Allocation invariants:

- Sum of allocations cannot exceed a source line or invoice balance.
- Confirmed allocations cannot be double-counted across reports.
- Shared trip charges retain their allocation method and remainder.
- Voids/credits reverse through new records, not destructive edits.
- Approved-for-payment cannot exceed invoice total; paid evidence cannot exceed approved amount without a governed exception.
- Operational resolution does not approve payment; invoice review does not verify technical work.

## Exceptions and derived values

Server rules derive current estimate, Authorized Ceiling, invoiced total, approved-for-payment, optional paid total, recognized Work Order cost, authorization variance, remaining authorization, deductions/credits, and warranty/customer responsibility.

Create visible review facts for duplicate invoice, amount above Authorization, Contract-rate variance, unsupported trip charge, missing match/allocation, warranty hold, and Service Discrepancy hold. A difference is evidence for human review, not automatic proof of invalid work or fraud.

## Source-linked value ledger

Each `ValueEvent` links to exact Work Order, Invoice/line, Service Run, Contract, Warranty Case, Asset recommendation, and decision sources as applicable. Keep categories separate:

- **Realized and verified:** approved deduction, received credit/refund, no-charge callback, corrected rate, prevented duplicate charge.
- **Identified exposure:** over-authorization invoice, potential warranty, abnormal repeat repair, PM risk.
- **Estimated opportunity:** projected route/truck-roll benefit, future repair exposure, replacement scenario.

Prevent double counting and preserve calculation/review versions. Proposed route savings remain estimated until execution and financial evidence verify them.

## Current implementation boundary

Implemented foundations include `Money`, Work Order NTE and repair estimate, immutable estimate proposals, `CostLine`, optional `InvoiceReference`, `InvoiceAllocation`, and source-derived recorded/linked/unmatched displays. Missing are the complete Quote/Authorization revision model, Invoice Lines and reconciliation, holds/credits/voids, Contract-rate checks, warranty allocations, payment-status integration, and first-class reviewed Value Events. No payment execution exists or is planned.
