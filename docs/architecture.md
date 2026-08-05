# Clark's Facilities Platform Architecture

**Decision date:** August 5, 2026
**Status:** Clean-rebuild target architecture
**Pilot shape:** One approximately 65-store operator, with the same product serving a one-store operator

## 1. Product and architecture decision

Clark's Facilities is an owner-side maintenance intelligence, accounting and accountability platform for every maintenance trade. HVAC and refrigeration receive the deepest pilot data and workflows, but the domain model also supports foodservice, electrical, plumbing, fuel, building, life safety, landscaping, snow, janitorial, pest, signage, waste and organization-defined categories. The internal Clark's work order is the operational spine: requests, classification, assignments, provider responses, visits, follow-ups, PM occurrences, proposals, approvals, purchase orders, invoices, credits, payments, allocations, files and audit events attach to it or lead to it.

The rebuild will be a multi-tenant TypeScript web monolith deployed to a Cloudflare-compatible runtime. It will use D1 for relational operational data and R2 for private file objects. Framework-independent domain services will own workflow rules; route handlers and channel adapters will translate HTTP, email links, QR visits and provider APIs into the same domain commands.

The product includes manager dispatch, internal work queues, schedules, checklists, service evidence, labor-cost records and material-use records so internal maintenance teams can execute work. It deliberately stops short of route optimization, employee rostering, payroll, inventory valuation, vendor marketplace administration, bank/payment execution, tax, accounts receivable, general-ledger replacement, predictive AI and continuous location tracking.

### Non-negotiable product rules

- Every tenant-owned operation begins with `organization_id`.
- A store belongs directly to an organization. Brand and region are optional groupings.
- A work order is valid with a store only; category, system, asset and component may be added later.
- Original employee-report content and audit history are append-only.
- Every unresolved, non-terminal work order has an accountable party, next required action, due time and escalation destination.
- Internal and external fulfillment use one work-order lifecycle and one evidence model.
- A vendor portal is optional. Email/deep links, phone-recorded responses, QR and APIs are first-class channels.
- Money is stored in integer cents. Quote, approved, committed, invoice, credit, warranty and paid stages remain distinct.
- Every metric and outlier links to its filtered supporting records.

## 2. Technology shape

- **Language:** TypeScript in strict mode.
- **UI/runtime:** React and the current Next-compatible App Router/vinext stack.
- **Validation:** Zod at every external boundary.
- **Relational store:** Cloudflare D1/SQLite through Drizzle ORM and committed SQL migrations.
- **Object store:** Private Cloudflare R2 through a `FileStore` interface.
- **Async delivery:** D1 outbox plus scheduled/background delivery adapters for email and integrations.
- **Tests:** Vitest for domain, repository and rendered integration tests; browser automation for principal owner, requester, provider and technician journeys.
- **Deployment:** One worker-compatible application with `DB` and `FILES` bindings declared in `.openai/hosting.json`.

A modular monolith is the right starting point because a work-order transition frequently updates assignments, follow-ups, finance, outbox and audit together. Keeping that operation within one database boundary is safer and simpler than coordinating microservices. D1 is sufficient for the pilot when tenant-first indexes, keyset pagination and bounded aggregates are used. Repository contracts keep a later PostgreSQL move possible without designing for it prematurely.

## 3. Bounded modules

```text
Identity & tenancy      Organizations, memberships, roles, scope
Location commissioning Stores, brands, regions, areas, readiness
Taxonomy                Canonical concepts, local labels and aliases
Equipment               Systems, assets, components, warranties
Request intake          Immutable employee reports and reviews
Work control            Work orders, classification, assignments, follow-ups
Provider exchange       Email links, portal, API/webhooks, phone recording
Visit evidence          QR sessions, check-in/out and one basic outcome
Preventive maintenance  Plans, targets, occurrences and linked work orders
Maintenance finance     Proposals, approvals, commitments, invoices and ledger
Files & communication   Private files, links, messages and outbox
Analytics               Exception queues, rollups, coverage and drill-through
Audit                   Append-only domain and security events
```

Domain modules accept typed records and an injected clock. They do not import React, D1, R2 or environment state. HTTP handlers authorize and validate, call one domain operation, persist its batch, and return a projection.

## 4. Tenant and organizational model

### Core hierarchy

```text
Organization
├── Brand (optional)
├── Region (optional grouping)
└── Store
```

`stores.organization_id` is mandatory. `brand_id` and `region_id` are nullable. Assigning or changing a region never changes a store's identity or history. A one-store organization needs neither a placeholder brand nor a placeholder region.

One person may hold several roles. Authorization is expressed through organization membership plus zero or more scope grants at organization, brand, region or store level. A vendor relationship is organization-private even if the same real-world company serves another customer.

### Tenant isolation

D1 does not provide row-level security, so isolation is enforced structurally and in repositories:

- Every tenant table contains `organization_id`.
- Unique constraints are tenant-relative, for example `(organization_id, work_order_number)`.
- Relationships use organization-aware validation; no repository infers tenant only through a joined parent.
- Repository methods require a non-optional `OrganizationContext` as their first argument.
- Queries place `organization_id = ?` before role, region, store, vendor or status filters.
- API detail routes return not-found for out-of-scope records to avoid enumeration.
- Automated tests attempt cross-tenant reads, writes, token reuse and file access.

Platform-provided taxonomy and store blueprints are non-operational templates. Provisioning copies selected definitions into an organization; runtime work never shares tenant operational rows.

### Single-store adaptation

Single-store customers use the same schema and routes. The UI adapts by hiding region/brand navigation, removing meaningless store comparison, defaulting the store scope and allowing one person to hold owner, requester, reviewer and approver roles. The product does not maintain separate “small business” code paths.

## 5. Physical hierarchy is not the accounting hierarchy

The physical model describes where equipment exists and how it is assembled:

```text
Store
└── Area or space (optional)
    └── System (optional, e.g. sales-floor HVAC or walk-in refrigeration)
        └── Asset (optional, e.g. RTU-3 or condensing unit CU-1)
            └── Component (optional, e.g. compressor or contactor)
```

The financial model describes how maintenance cost is coded:

```text
Financial cost center
GL account
Budget code
Department or responsibility code
Fiscal period
```

These dimensions are parallel. “HVAC,” “ovens” or “walk-in cooler” must not become financial cost-center parents merely to make the UI hierarchy work. A work order or ledger allocation may reference both a physical target and financial dimensions.

### Physical tables

- `store_areas(organization_id, store_id, canonical_type_id?, local_name)`
- `store_systems(organization_id, store_id, area_id?, system_type_id, local_name, status)`
- `assets(organization_id, store_id, system_id?, asset_type_id, tag?, serial_number?, lifecycle fields)`
- `components(organization_id, store_id, asset_id, component_type_id, local_name?, lifecycle fields)`
- `warranties(organization_id, asset_id?, component_id?, provider_relationship_id?, terms)`

An asset can be created directly under a store when its system is unknown. A later move into a system preserves the asset ID and appends a hierarchy event. A component always belongs to an asset. Deeper work-order associations are optional, but when supplied the domain service validates that all selected records belong to the same organization and store and that component → asset → system associations are physically valid.

## 6. Canonical taxonomy with local language

Analytics requires stable concepts; store teams and regional operators require familiar labels. The rebuild separates those concerns.

### Model

- `taxonomy_concepts(organization_id, id, kind, canonical_key, parent_concept_id?, status)`
- `taxonomy_labels(organization_id, concept_id, locale, display_label, is_primary)`
- `taxonomy_aliases(organization_id, concept_id, store_id?, normalized_alias, display_alias, source)`
- `taxonomy_mappings(organization_id, source_system, source_code, concept_id)`

Kinds include `category`, `area_type`, `system_type`, `asset_type`, `component_type`, `problem_code`, `outcome_code` and `cost_class`.

`canonical_key` is stable and drives rules and reporting. Labels may change without rewriting history. Aliases support terms such as “roof unit,” “RTU,” a local nickname or an imported vendor code. Store-specific aliases are allowed, but they resolve to an organization-owned canonical concept. Search indexes canonical labels and aliases; saved records retain the concept ID plus the label snapshot shown when the event occurred.

The initial product activates an all-trades maintenance taxonomy. HVAC and refrigeration receive the deepest system, asset, component, PM, work-history and cost examples; the other common trades remain fully active at store, category, system and work-order levels.

### Progressive classification

`work_orders.store_id` is required. `category_id`, `system_id`, `asset_id` and `component_id` are nullable. Classification occurs through a domain command that:

1. Validates tenant and physical belonging.
2. Appends `work_order_classification_events` with prior/new associations, actor, channel and reason.
3. Updates the work order's current classification projection.
4. Recomputes no historical financial allocation silently.

Reporting always shows classification coverage. Asset-level reports include an explicit unclassified bucket and a denominator such as “64% of invoiced HVAC/R work is classified to an asset.”

## 7. Request, work order and unresolved-work control

### Immutable request intake

`employee_reports` stores the original reporter identity, store, observed symptoms, impact, optional photo links and submission timestamp. Those columns are immutable after insert. Management interpretation lives in `report_reviews`; corrections and decisions append records rather than editing the report.

A review may merge a duplicate, close as no work required, or create/link an internal work order. The link preserves the source report permanently.

### Canonical work order

The work order contains current control fields rather than every historical fact:

- organization and work-order number
- store and optional classification
- priority and service target
- lifecycle status
- accountable assignment
- next required action
- next-action due time
- escalation destination
- current NTE/authorization projection
- opened, resolved, verified and closed timestamps

Status is changed only through named domain commands. Original due dates, provider responses, classifications, approvals and visit outcomes are retained in append-only events.

### Closure rule

A work order cannot close while it has an open required follow-up, unresolved verification, pending proposal decision or unreconciled required invoice allocation. An unresolved visit outcome creates its follow-up in the same database batch. Rescheduling requires a reason and retains the missed date.

## 8. Unified internal and external assignment

Internal and vendor work share one assignment abstraction:

`work_order_assignments(organization_id, work_order_id, assignee_type, person_id?, provider_relationship_id?, status, response_due_at, accepted_at?, ended_at?, next_action, due_at, escalation_target)`

A constraint requires exactly one target. `assignee_type` is `internal` or `provider`. A work order may have sequential assignments and, when explicitly justified, concurrent assignments, but only one assignment owns the next required action at a time.

Equal product support means both modes provide the same owner visibility, SLA clock, evidence, unresolved-work controls and cost linkage. Internal teams additionally receive a practical assignment queue, schedule, checklist, labor-cost and material-use workflow. These records support maintenance execution and costing, not payroll, employee scheduling or inventory accounting.

### Provider-office action in v1

The required provider response is intentionally narrow:

- Accept
- Decline with a reason
- Request clarification

The platform records who responded, when, through which channel and on whose behalf. Declines return the work order to the manager queue or the configured fallback provider; they do not silently disappear.

### Channel adapters

All channels call the same domain commands and append the same audit event:

| Channel | Intended use |
|---|---|
| Internal web app | Managers and internal accountable owners |
| Email action link | One-click provider accept/decline/clarification without an account |
| Purpose-bound deep link | Limited work-order view, proposal or invoice action |
| Optional provider portal | Recurring vendors who want queues and document history |
| Provider API/webhook | High-volume vendors staying in their own FSM/CMMS |
| Phone-recorded response | Manager records a vendor response with recorder attribution |
| Technician QR | Accepted work order, entered name, check-in/out and one outcome |

`interaction_events` records `actor_type`, asserted identity, verified identity when available, channel, purpose, timestamp, payload snapshot and recorder. Email replies may append messages and attachments; structured state changes require explicit action links rather than natural-language interpretation.

Provider projections exclude other vendors' pricing, internal notes, confidential approvals and unrelated stores.

## 9. Visit evidence and public tokens

Public links never contain an editable bare record ID. `public_tokens` stores organization, purpose, record binding, token hash, expiry, use/revocation state and version. Raw token material is never stored.

- Vendor response tokens are short-lived and can be single-use.
- Technician work-order links are issued only after provider acceptance.
- Store QR tokens are purpose-bound, rotatable entry points and reveal no unrestricted store data.
- Production secrets are environment-managed with no source fallback.

The technician journey is limited to:

`store QR → vendor/accepted WO → entered technician name → check-in → rescan/active visit → one outcome → checkout`

Location is collected only at check-in and checkout. D1 stores timestamp, submitted coordinates, browser accuracy, derived distance and verification result. No background tracking or route history exists. Demo simulations are visibly labeled “Demo Mode” in both UI and audit timeline.

## 10. Preventive maintenance

- `pm_plans(organization_id, canonical task, cadence, window, evidence policy, status)`
- `pm_plan_targets(organization_id, pm_plan_id, target_type, target_id)`
- `pm_occurrences(organization_id, pm_plan_id, target_id, due/window fields, status, work_order_id?)`

Plans target known stores, systems or assets. Blueprints may propose PM coverage but never create fake assets. Materialization is idempotent through a unique plan/target/due key. Missed, waived and rescheduled occurrences preserve the original due window and reason. Any generated work uses the canonical work-order lifecycle.

## 11. Maintenance finance and accounting ledger

Finance is a complete maintenance-focused accounting and AP-control suite. It owns budgets, quotes/proposals, approvals, purchase orders, invoice review, credits, allocations, accruals, payment status and maintenance-ledger exports while retaining the work, store, provider and equipment evidence behind every amount. It does not move money, calculate or file tax, run accounts receivable, connect bank accounts or replace the customer's general ledger.

### Source records

- `proposals` and `proposal_lines`
- `approvals` with amount, decision, actor, reason and authority level
- `commitments` for authorized spend
- `invoices` and `invoice_lines`
- `credits`
- `payments` or ERP payment-status references when imported
- `financial_allocations`
- `maintenance_ledger_entries`

All money is integer cents with explicit currency. Proposal, approved, committed, invoiced, credited, warranty-recovered and paid values are separate stages; dashboards never add stages together as if they were one total.

### Financial dimensions

- `financial_cost_centers`
- `gl_accounts`
- `budget_codes`
- `departments`
- `fiscal_periods`

An allocation links a source line explicitly to a store and optional category/system/asset/component plus financial dimensions. No cost is assigned from free-text matching. Asset and component rollups use only explicit associations.

Draft invoices may show an unallocated balance. Approval/export is blocked until required allocations reconcile exactly to the invoice total. Credits and corrections append reversal and replacement ledger entries; posted facts are never overwritten. Ledger entries retain the source document, source line, allocation, financial stage, posting time and audit event.

The reporting layer can answer the same amount along two independent paths:

- Physical: organization → store → category → system → asset → component
- Accounting: cost center → GL → budget → fiscal period

Both end at supporting work orders, source documents and allocation lines.

## 12. Manager-first information architecture

The default application surface is a manager control center that combines maintenance financial position, reporting, provider/internal accountability and prioritized operating exceptions. Maintenance execution remains a connected primary section rather than consuming the entire product.

### Primary navigation

1. **Overview** — financial position, accountability, exceptions and store/category signals
2. **Stores** — global store search, dashboards, commissioning and cost drill-down
3. **Accountability** — owner, next action, deadline and escalation across internal and vendor work
4. **Maintenance** — requests, work orders, due-date schedules, PM and internal execution
5. **Equipment** — systems, assets, components, history and replacement evidence
6. **Accounting** — budgets, approvals, POs, invoices, credits, payments, accruals and GL/export
7. **Providers** — coverage, assignments, optional portal and directly observed performance
8. **Reports** — standard management library, custom builder, schedules and reversible drill-through
9. **Administration** — organization, roles, taxonomy, routing, financial controls, imports and audit

Single-store users see the same order with store scope preselected and portfolio-only comparisons removed.

### Action Center queues

- Needs triage
- Awaiting internal/provider response
- Response or service target overdue
- Clarification requested
- Proposal required or awaiting approval
- Unresolved follow-up overdue
- Completion awaiting verification
- Invoice or allocation exception

Each count is calculated from source records and opens the exact filtered list. Every row shows accountable party, next action, due time, escalation destination and blocker.

### Global search

One search box supports exact and prefix lookup for:

- work-order number
- store code, name and normalized address
- asset tag, serial number and local alias
- provider name
- proposal/invoice number

Results are tenant-scoped before matching and grouped by entity. Search never loads an organization's full dataset into the browser. Descriptions and notes may use a tenant-scoped FTS index; exact operational identifiers use normalized indexed columns.

## 13. Reporting and drill-through contracts

The canonical cost path is:

`organization → store → category → system → asset → component → work orders → financial allocations`

Every aggregate response includes:

- period and timezone
- selected financial stage
- cohort/filter definition
- value and record count
- classification coverage where relevant
- a serializable supporting-record filter

The UI constructs the next drill level from that filter rather than from an unrelated dashboard dataset. Unclassified work remains visible at every optional level. Medians and percentiles are preferred for skewed cost and resolution measures. Replacement review shows explicit rules, reasons, thresholds and source records; it never emits an opaque health score or automatic replacement order.

## 14. D1 implementation path

### Clean schema and migrations

The rebuild starts with a new baseline migration organized by bounded module. Drizzle defines types and migrations; hand-reviewed SQL adds checks, compound tenant indexes, FTS tables and immutable-row triggers where required.

Write operations that must remain atomic use a D1 batch:

- report review + work-order creation + source link + audit
- classification projection + classification event + audit
- provider response + assignment transition + fallback/outbox + audit
- unresolved checkout + visit evidence + follow-up + work-order control + audit
- financial approval/allocation + ledger entries + audit

External side effects use an outbox. A transaction commits the domain change and outbox row; a scheduled worker delivers email/webhooks and records attempts idempotently. Incoming provider callbacks require an organization-scoped idempotency key.

### Repository rules

Repositories expose task-oriented methods, not generic unscoped table access. Lists require a page size, stable sort and cursor. Aggregates execute in SQL. The browser receives only the requested page or bounded drill projection.

### Environment path

1. Local/test D1 database and local R2-compatible bucket.
2. Deterministic seed applied through the same repositories.
3. Preview environment with isolated D1/R2 bindings and migrations.
4. Production D1/R2 with migration gate, backup/export procedure and environment-owned secrets.
5. Move to PostgreSQL only after measured concurrency, integration or reporting pressure justifies it.

## 15. R2 file path

R2 stores bytes; D1 stores private metadata and links:

- `documents(organization_id, object_key, display_name, mime, bytes, hash, classification, uploader, created_at)`
- `document_links(organization_id, document_id, entity_type, entity_id, visibility)`

Upload flow validates tenant scope, target ownership, size, MIME and extension; generates an opaque server key; writes the object; records metadata/link; and appends an audit event. Downloads pass through an authorized route or a short-lived permission-checked link. Buckets are never public. Production adds malware scanning, retention and legal-hold policy before accepting real customer documents.

## 16. Authentication: demo versus production

### Demo

- A visible, fixed persona switcher is presentation tooling only.
- The active persona is stored in a signed demo session and still passes through the production permission service.
- Simulated email, vendor response and geolocation states are labeled Demo Mode.
- Demo tokens are deterministic only within a demo-specific secret/version so scripted URLs are stable.
- Tenant-switch scenarios are explicit and never imply production authentication.

### Production

- Operator users authenticate through OIDC/SSO where available; a passwordless option may serve independent operators.
- External subject maps to a person and one or more organization memberships.
- Each request selects one active organization context before role/scope checks.
- Vendor portal accounts are optional. Accountless email/deep-link actions use short-lived purpose-bound tokens.
- Internal technicians may use authenticated work queues. Outside technicians can use purpose-bound QR/deep-link flows without accounts; recurring providers may optionally use portal accounts.
- Sessions, CSRF protection, rate limits, token rotation, audit and secret management are production requirements, not demo toggles.

## 17. Deterministic seed and demo narrative

The fixture generator uses a fixed PRNG seed, fixed clock and stable IDs. It writes through repository interfaces and is idempotent.

### Required fixture shapes

- One concise 12-store showcase portfolio across three regions, selected from a 65-store-capable operator model.
- A separate automated 65-store scale fixture and one isolated one-store fixture.
- One isolated one-store operator proving no placeholder region or comparison UI is required.
- Active all-trades taxonomy with organization-specific labels and aliases, plus especially deep HVAC and refrigeration examples.
- Credible store systems, assets and components, intentionally incomplete enough to exercise coverage.
- Employee reports at store-only, category and fully classified depths.
- Internal and external assignments using email, phone-recorded, portal/API and QR channels.
- Accepted, declined, clarification, overdue, unresolved follow-up and verification scenarios.
- PM due, completed, missed, waived and linked-work scenarios.
- Proposal, approval, commitment, invoice, credit and allocation examples in integer cents.
- Private file metadata and append-only audit histories.

Named scenario IDs remain stable for demos and tests, including a high-cost refrigeration store, an asset watchlist case, an unclassified work-order case, a no-portal vendor acceptance and an unresolved visit that produces a follow-up.

Dashboard values are never seeded separately. They are calculated from these records. The generator asserts referential integrity, financial reconciliation, tenant isolation and the unresolved-work invariant before completing.

## 18. Index, query and pagination strategy

Representative indexes:

```text
work_orders(organization_id, status, next_action_due_at, id)
work_orders(organization_id, store_id, created_at, id)
work_orders(organization_id, category_id, created_at, id)
work_orders(organization_id, asset_id, created_at, id)
employee_reports(organization_id, review_status, submitted_at, id)
work_order_assignments(organization_id, assignee_type, status, response_due_at, id)
work_order_assignments(organization_id, provider_relationship_id, status, id)
follow_ups(organization_id, status, due_at, id)
pm_occurrences(organization_id, status, due_at, id)
proposals(organization_id, status, decision_due_at, id)
invoices(organization_id, status, submitted_at, id)
financial_allocations(organization_id, store_id, financial_stage, posted_at, id)
financial_allocations(organization_id, asset_id, financial_stage, posted_at, id)
audit_events(organization_id, entity_type, entity_id, occurred_at, id)
stores(organization_id, normalized_code)
assets(organization_id, normalized_tag)
assets(organization_id, normalized_serial_number)
```

Lists use keyset pagination with a deterministic secondary `id` sort. Filters are URL-serializable and accepted by both aggregate and detail endpoints. High-cardinality free text uses an FTS table keyed by organization and entity; exact identifiers do not rely on FTS. The 65-store pilot should use live indexed aggregates. Cached or materialized summaries are introduced only after query profiling, and every cache key includes organization, period, filter and data version.

Query-plan tests use `EXPLAIN QUERY PLAN` for the principal queues, global identifier search and physical/financial drill paths. Performance tests assert bounded response sizes and stable pagination under concurrent inserts.

## 19. Test strategy

### Domain unit tests

- Store-only work order and every progressive-classification depth.
- Physical belonging validation and append-only reclassification.
- Immutable report and audit behavior.
- Work-order transition guards and closure rejection.
- Unresolved visit creating a follow-up in the same operation.
- SLA, overdue, reschedule-reason and escalation logic.
- PM materialization, uniqueness, completion, waiver and missed windows.
- Proposal/NTE/approval transitions.
- Invoice allocation equality, credits/reversals and dual-axis rollups.
- Classification coverage, medians, percentiles and explainable watchlist rules.
- Geofence distance and verified/unverified states.

### Repository and security integration tests

- Organization scoping on every repository method.
- Cross-tenant ID, token, search and file-access denial.
- Organization-relative uniqueness and stable sequences.
- Atomic domain batch plus outbox creation.
- Idempotent provider callbacks and seed reruns.
- Cursor pagination with deterministic ordering.
- FTS and exact-search tenant isolation.

### End-to-end domain journeys

1. Report → review → store-only WO → later classification → internal completion → verification → close.
2. WO → email provider acceptance without portal → QR check-in → unresolved checkout → automatic follow-up → return visit → verification.
3. WO → provider API acceptance → proposal → approval/NTE → invoice → allocations → export status.
4. Store commissioning → systems/assets → PM targets → readiness with intentional gaps.
5. One-store organization completing the same workflows without region records.

### Browser QA

Inspect desktop manager and mobile requester/technician paths in a real browser:

- Action Center queue to supporting records.
- Global search by store number, address, WO number, asset tag and invoice.
- New-store commissioning continuity.
- Work-order creation with system/asset/component deferred.
- Internal and external assignment parity.
- Provider email/deep-link flow with no account.
- Technician QR check-in/out and visible location exception.
- Store → category → system → asset → source-work drill-through.
- Single-store IA with portfolio-only controls removed.

Before release run type checking, lint, all unit/integration/end-to-end tests, production build, accessibility checks and principal browser journeys. No seeded or UI-only total may bypass domain calculations.

## 20. Delivery sequence

1. Establish clean schema, tenant context, taxonomy and deterministic seed.
2. Build store commissioning, immutable requests and canonical work orders.
3. Add progressive classification, internal/provider assignments and Action Center.
4. Add email/deep-link provider response and minimal technician QR visits.
5. Add unresolved follow-up control and PM occurrences.
6. Add proposals, approvals, invoices, allocation ledger and R2 files.
7. Add global search, server pagination, drill-through reporting and coverage.
8. Add provider API/webhooks, production auth, outbox delivery and operational hardening.

The 65-store pilot is a scale and workflow target, not a reason to fork the product or introduce distributed architecture.
