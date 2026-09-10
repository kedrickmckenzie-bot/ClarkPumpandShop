# Inbound accounting handoff

## Implemented boundary

The provider-neutral input is `AccountingInvoiceDelivery` in `lib/ops/accounting-import.ts`. The separately named demo adapter supplies fictional deliveries. No customer accounting product has been selected or connected. There is no OAuth connection, live poller/webhook, payment action, or accounting writeback in this pass.

The identity is organization + connection + accounting company + external record ID. A provider adapter must normalize its change cursor into a monotonic revision. Identical delivery replay creates nothing; old or conflicting revisions fail. Human vendor mapping stays separate from imported facts so reviewing an unmapped supplier does not break replay. Review saves and financial updates use transaction fences with audit/outbox writes in the same transaction.

Maintenance filtering happens before creating a platform invoice. The adapter supplies a maintenance classification; a production connector needs explicit customer rules for accounts/categories, vendor mappings, and location/store codes. Merchandise examples remain outside maintenance totals. Work-order references narrow the search but never confirm links automatically. Review requires a complete, reconciled split of each charge between same-tenant work orders, including different stores. A duplicate vendor invoice number requires explicit existing-invoice selection or confirmation that it is a distinct company bill. A platform invoice cannot be claimed by two external bill identities.

Accounting controls invoice date, amount, currency, lines, void and paid amount. The platform controls evidence links and review decisions. A source amount change retains the previous source and invoice/line/allocation snapshot, updates the same invoice, clears stale allocations and approved amount, and opens a new allocation review flag. Reviewing the corrected split resolves that specific flag without clearing unrelated findings. A later payment-only delivery cannot silently clear outstanding review. Removed invoice lines remain as zero-valued audited amendments. None of these transitions closes work, marks a repair confirmed, dispatches, or creates a recorded-work-cost line.

Credit records have separate external identity and must be linked to their original bill in the same accounting connection/company. Their versions, corrections and voids remain visible in source history. They do not automatically reduce the bill twice or create a savings event; the provider must supply the authoritative updated bill balance/payment evidence. Requested invoice deductions are estimated opportunities, not confirmed credits. A future confirmed-benefit workflow must reconcile applied credit evidence and append corrections/reversals before moving value into the confirmed category.

Original documents appear as secure provider links when supplied. This foundation does not download arbitrary authenticated provider documents or claim durable attachment import. Such downloads require the selected connector's document API and the existing private storage adapter. Quote attachments already use private storage independently of accounting documents.

## Customer and provider discovery required

Before implementing a live connector, record all of the following with official provider documentation and customer confirmation:

| Decision | Evidence to obtain |
|---|---|
| Product identity | Exact accounting product, edition, hosting model, company IDs and country |
| API entitlement | Customer subscription/API add-on, supported APIs, provider app approval or certification requirements |
| Access | Required read scopes, who may authorize each company, token expiry/revocation, credential storage |
| Record lifecycle | Draft versus posted bill, invoice versus bill terminology, credits, voids, reversals and payment/application semantics |
| Source identity | Stable IDs across edits, connection/company boundaries, merge behavior and external reference reuse |
| Mapping | Vendor IDs, maintenance accounts/categories, locations/classes/departments and customer store-code mapping |
| Documents | Original document availability, permitted retrieval, access lifetime and retention requirements |
| Change delivery | Polling or webhook support, ordering, replay, deleted/voided events, pagination and backfill checkpoints |
| Operating limits | Rate limits, quotas, concurrency, fees, provider onboarding and historical-access limits |
| Recovery | Retry/backoff, dead-letter review, reconciliation, customer-visible last-success/error, reconnect and missed-event recovery |

Provider approval and customer authorization are separate decisions. Neither is implied by this demo. No provider-specific capability or fee is asserted here because the product is unknown.

## Persistence and operating limits

The source table and repository methods work through fixture, D1 and PostgreSQL adapters. Source intake and source history are bounded reads. Current source intake paginates 25 records; matching searches return at most 50 work orders and 100 vendors; source history returns the latest 50 audit events while older events remain persisted. A production connector needs resumable history/import jobs and appropriate indexes, volume tests and retention policy before a customer backfill.

The local fixture and local quote-file memory reset when the local process restarts. Hosted private quote files use R2 or the portable S3 adapter according to runtime configuration. This pass preserves the current D1/R2 bindings and adds no Render infrastructure or credentials.
