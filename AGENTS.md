# Clark's Maintenance Intelligence Engineering Invariants

These rules apply to all work in this repository. `docs/product-spec.md` is the product source of truth for the clean rebuild.

## Product definition

1. Build a multi-tenant, multi-site maintenance intelligence platform centered on portfolio reporting, maintenance-financial accounting and low-friction accountability.
2. The operator's work order is the primary maintenance record, but the product is not merely a work-order tracker. Stores, equipment, people, vendors, PM, financial records and audit events form one connected operating model.
3. The default experience is manager-first: search, portfolio exceptions, accountable actions, financial position and drill-down precede technician workflow screens.
4. Support all maintenance trades through configurable taxonomy. HVAC and Refrigeration are the seeded demonstration focus, never a hardcoded domain restriction.
5. Clark's is fictional demonstration data, never a hardcoded tenant, role, workflow or taxonomy assumption.

## Source records and drill-through

1. Dashboard and report values are calculated from source records such as work orders, assignments, visits, PM occurrences, follow-ups, budgets, quotes, approvals, purchase orders, invoices, credits, accruals, payment records and allocations. Never hardcode independent summary totals.
2. Every principal metric, chart segment, exception count and outlier driver links to its exact filtered supporting records.
3. Filters and definitions remain visible through drill-down. A number may not silently change financial stage, date basis, cohort or classification depth.
4. Store-only and category-only work remains in portfolio totals. Deeper analytics must show an explicit unclassified bucket and classification coverage.
5. Never claim causation from correlated maintenance events. Replacement or capital-review guidance is rule based and shows its reasons and thresholds; never emit an opaque health score or automatic replacement command.

## Tenant and customer-shape invariants

1. Each customer operator is an isolated `organization`.
2. Every tenant-owned read, write, aggregate, search, export and background job requires `organization_id` as its first data boundary, before role, region, store, team or vendor filters.
3. A store belongs directly to an organization. Region is optional and may be added, changed or removed without changing store identity or history.
4. A one-store operator works without placeholder regions, enterprise-only setup or meaningless peer-store comparison UI.
5. One person may hold multiple roles and scopes. This is expected for independent operators.
6. Work-order sequences, policies, terminology, taxonomy mappings, accounting dimensions, vendors, teams and templates are organization scoped.
7. Lists, search and aggregates use server-side filtering, indexed ordering and stable pagination. Never require loading all records into the browser; the main demo must remain credible at 65 stores.
8. Never compare or benchmark across customer organizations without an explicit, privacy-reviewed opt-in design.

## Store identity, onboarding and search

1. A store has a stable internal ID and separate first-class fields for store number, name, normalized address and external identifiers. Do not overload the display name with identity data.
2. Previous store numbers, alternate names and legacy external IDs are aliases that remain searchable and audited.
3. Organization-scoped universal search covers at least store number/name/address/alias, work-order number/title, asset code/name/serial, vendor and document reference.
4. Store creation is a guided connected workflow: identity and address, optional region, operating settings, trade/equipment templates, equipment hierarchy, PM, accounting mappings, responsibilities and final readiness review. A newly created store must also be usable immediately before optional setup is complete.
5. Bulk import, copy-from-template and copy-from-similar-store actions use the same validated domain commands as manual setup and provide a reviewable error report.

## Physical hierarchy and configurable taxonomy

1. Keep physical maintenance structure separate from accounting structure.
   - Physical: `organization -> store -> optional area -> optional equipment group/system -> asset -> optional component`.
   - Accounting: account/GL code, accounting cost center/department, project, budget and other organization-defined dimensions.
2. A customer may label the physical equipment-group concept as “System,” “Equipment Group,” “Cost Center” or another familiar term, but its canonical semantic type never becomes an accounting cost center.
3. Taxonomy concepts have stable IDs and canonical keys. Organization-preferred labels and aliases are editable presentation data, not report identities.
4. Local terms may map to canonical concepts for cross-store reporting. Imports may suggest mappings but may not silently merge concepts.
5. A work order is valid with a store only. Category, equipment group/system, asset and component are progressively optional and may be added later.
6. Never invent placeholder assets, components, systems or regions to satisfy a foreign key.
7. Validate physical belonging whenever a deeper association is supplied.
8. Reclassification appends an audit event containing prior and new associations, actor, reason and timestamp. Historical associations remain reconstructable.
9. Show classification coverage beside system-, asset- and component-level analytics; never imply precision unsupported by the underlying records.

## Connected work and accountability

1. Requests, inspections and PM occurrences may create or link to the same canonical work-order model.
2. Every non-terminal unresolved work order has an accountable party, next required action, due timestamp and escalation destination.
3. Unresolved outcomes create the required follow-up in the same domain operation. Closing is rejected while required follow-up, completion evidence or verification remains open.
4. Overdue records stay visible. Rescheduling requires a reason and retains every missed/original date in history.
5. Work orders must be operationally useful: problem and priority, store/equipment context, fulfillment and assignments, requested/scheduled windows, work log and visits, checklist/evidence, follow-ups, related requests/PM, financial chain, files/communications and audit timeline.
6. Work-order creation must allow “classify later” for optional category/system/asset/component fields. Deferring classification can create an accountable classification task but cannot block legitimate work.

## Internal and external fulfillment parity

1. Use one work-order lifecycle with `fulfillment_mode = internal | external | blended`; do not fork internal and vendor work into incompatible records.
2. Internal people, internal teams and external vendors can receive assignments, acknowledge work, record visits/work, add allowed evidence and produce unresolved or completed outcomes. Access and interaction channels differ; accountability and reporting semantics do not.
3. Basic maintenance assignment, team queues, requested/scheduled windows and workload visibility are in scope. Payroll, shift/timekeeping administration, route optimization and full field-service workforce management are not.
4. A vendor portal is optional. Vendors must also be able to act through opaque purpose-bound email/deep links, store QR flows and future API integrations without adopting a full account.
5. All interaction channels invoke the same domain commands and append the same audit events, including actor, channel, timestamp and payload snapshot.
6. Vendor projections exclude other vendors' pricing, internal notes/evaluations, confidential approvals, unrelated locations and financial data outside their engagement.
7. Report only measures the operator can observe. Never infer vendor dispatch, en-route or internal scheduling performance.

## Maintenance-financial accounting

1. Store money in integer minor units with currency and keep request/estimate, quote, approved, committed/PO, accrued, invoiced, credited, warranty-recovered and paid stages distinct.
2. Budgets, approval policies, quotes, purchase orders, invoices, credits, allocations, payment-status tracking, accruals, accounting dimensions and GL-ready exports are first-class product scope.
3. Payment tracking records observed amount, status, date and external reference; it does not execute payment, connect bank accounts or replace accounts payable.
4. Accounting dimensions are organization-defined and effective dated. GL mappings and exports must retain source-record links and export/batch history; the platform is a maintenance subledger, not the general ledger.
5. Cost rolls up only through explicit associations or allocation lines, never free-text matching.
6. Invoice and credit allocations must reconcile to their source totals. Unallocated balances remain visible; over-allocation is rejected.
7. One financial record may allocate across multiple stores, work orders, equipment nodes, vendors and accounting dimensions without double counting. The allocation line is the reporting grain.
8. Approved commitments, invoices, credits, payments and accruals are not interchangeable. Every report states which stages it includes.
9. Finalized financial facts are corrected through append-only amendments, reversals or credits, never silent overwrite.
10. Payroll, tax calculation/filing, banking/payment execution, accounts receivable and general-ledger replacement are explicit non-goals.

## Record permanence, security and tokens

1. Inserted employee/request report content is immutable. Reviews, corrections, decisions and links are appended separately.
2. Audit events are append-only, organization scoped and created in the same transaction as the domain change they describe.
3. Never silently overwrite original classifications, due dates, approvals, quotes, purchase orders, vendor responses, visit evidence, allocations or export state.
4. Files are private objects served only through permission-checked routes or short-lived links.
5. QR and action URLs use opaque, purpose-bound, expiring tokens, never editable bare IDs. Production token material is hashed at rest and secrets never enter source control.
6. Capture location only when a policy requires it at check-in or checkout. Never continuously track. Preserve accuracy, distance, timestamp, consent/result and verification status; exceptions remain visibly unverified.
7. Demo role switching is presentation tooling, not production authentication.
8. Every simulated state is visibly labeled “Demo Mode” in the UI and audit history.

## Scope boundaries

1. Support configurable workflows and taxonomy for all maintenance trades. The initial templates, analytics stories and deepest seed data emphasize HVAC and Refrigeration.
2. Work-order labor, contractor, material and miscellaneous cost lines are in scope. Full warehouse purchasing, stock replenishment and retail inventory are not.
3. Maintenance planning, PM calendars, assignment windows and technician queues are in scope. Employee shift scheduling, payroll and route optimization are not.
4. POS, retail merchandising, tax, banking, accounts receivable, general-ledger replacement, continuous tracking and a vendor marketplace are outside the clean rebuild.

## Demonstration and quality bar

1. The presentation seed is a clearly fictional, story-rich 12-store Clark's showcase selected from a 65-store-capable operator model. A separate automated 65-store fixture proves scale. All displayed totals derive from seeded source records.
2. The seed proves internal, external and blended work; progressive classification; store onboarding; PM; quotes/approvals/POs/invoices/credits/payments/accruals/allocations; accounting export; and metric-to-record drill-down.
3. Test fixtures must also prove a one-store independent operator without placeholder hierarchy.
4. Keep domain rules framework independent and tested. Critical tenant, state-transition, close-gate, allocation, approval, accrual and audit invariants require unit or integration coverage.
5. Before completion run type checking, lint, unit/integration/end-to-end tests and a production build. Then inspect manager search/drill-down, store creation, work-order creation with deferred classification, internal technician, vendor deep-link/portal, finance and mobile journeys in a browser.
6. The rebuilt demo must feel connected: creation actions persist, every primary detail page exposes useful linked records, and no principal metric or workflow ends at a dead control.
