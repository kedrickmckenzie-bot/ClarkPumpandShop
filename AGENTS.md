# Clark's Operations Engineering Invariants

These rules apply to all work in this repository.

## Product source of truth

1. The internal Clark's work order is the primary maintenance record.
2. Dashboard values must be calculated from work orders, visits, PM occurrences, follow-ups, financial records, allocations and assets. Never hardcode independent summary totals.
3. Every principal metric and outlier driver must link to its filtered supporting records.

## Tenant and customer-shape invariants

1. Each customer operator is an isolated organization. Clark's is demo data, never a hardcoded tenant assumption.
2. Every tenant-owned repository call requires `organization_id`; scope it before any role, region, store or vendor filter.
3. Region is optional. A store belongs directly to an organization and may later be grouped into a region without changing its identity/history.
4. A one-store operator must work without placeholder region records or meaningless store-comparison UI.
5. One person may hold multiple roles, which is expected for independent operators.
6. Lists and aggregates must support a roughly 65-store pilot using server filtering, stable pagination and indexes; never require loading all records into the browser.
7. Work-order sequences, settings, taxonomy and vendor records are organization scoped.
8. Never compare or benchmark across customer organizations without an explicit, privacy-reviewed opt-in design.

## Progressive classification

1. A work order is valid with only a store, or a store plus category.
2. System, asset and component are optional and may be added later.
3. Never invent placeholder assets to satisfy a foreign key.
4. Validate physical belonging when a deeper association is supplied.
5. Reclassification appends an audit event and preserves prior associations in history.
6. Show coverage next to asset-level analytics; do not imply precision unsupported by classified records.

## Report permanence and audit

1. Inserted employee-report content is immutable. Reviews, corrections and decisions are appended separately.
2. Audit events are append-only and tenant scoped.
3. Do not silently overwrite original due dates, classifications, approvals, vendor responses or visit evidence.

## Unresolved-work control

1. Every non-terminal unresolved work order has an accountable party, next required action, due date and escalation destination.
2. Unresolved technician outcomes create a follow-up in the same domain operation.
3. Closing is rejected while required follow-up or verification remains open.
4. Overdue records stay visible; rescheduling requires a reason and retains the missed date.

## Vendor and technician burden

1. Do not add Clark's-side technician dispatch, scheduling, routing, roster or payroll.
2. Vendor office required action in v1 is accept, decline or request clarification.
3. Technician required action is store QR → vendor/accepted WO → entered name → check-in; then rescan → active visit → one basic outcome → checkout.
4. Do not require diagnosis prose, parts, labor, travel states, invoice lines or technician accounts.
5. Report only vendor measures Clark's can directly observe; never infer dispatch or en-route performance.

## Location and tokens

1. QR and acceptance URLs use opaque purpose-bound tokens, never bare editable IDs.
2. Production token material is hashed at rest and secrets never enter source control.
3. Capture location only at check-in and checkout. Never continuously track.
4. Preserve accuracy, distance, timestamp and verification result; an exception remains visibly unverified.
5. Simulated states must display “Demo Mode” in the UI and audit timeline.

## Money and analytics

1. Store money in integer cents and keep quote, approved, committed, invoice, credit, warranty and paid stages distinct.
2. Invoice allocations must reconcile; never hide an unallocated balance.
3. Costs roll up only through explicit allocation/associations, not free-text matching.
4. Prefer medians/percentiles and label the comparison cohort and period.
5. Replacement review is rule based and shows each reason and threshold. Never output an opaque health score or automatic “replace” command.
6. Do not claim causation from correlated maintenance events.

## Security and access

1. Every tenant-owned read/write is restricted by `organization_id` before role/scope checks.
2. Vendor projections exclude other vendors' pricing, internal notes/evaluations, confidential approvals and unrelated locations.
3. Files are private objects served only through permission-checked routes or short-lived links.
4. Demo role switching is presentation tooling, not production authentication.

## Scope

Focus implementation on HVAC and Refrigeration. Do not add POS, retail inventory, payroll, scheduling, full AP/payments, vendor marketplace/credentials, parts inventory, native apps, predictive AI, continuous tracking or route optimization unless a future product decision explicitly changes scope.

## Quality bar

Keep domain rules framework independent and tested. Before completion run type checking, lint, unit/integration/end-to-end tests and a production build; then inspect the principal owner and mobile technician journeys in a browser. Preserve a credible, connected owner-facing experience with no dead end in the demo narrative.
