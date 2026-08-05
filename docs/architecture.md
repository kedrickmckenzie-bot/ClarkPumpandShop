# Maintenance Intelligence Platform Architecture

**Decision date:** August 5, 2026
**Status:** Clean-rebuild target architecture
**Pilot shape:** A 12-store presentation demo for a prospective approximately 65-store operator, with the same product serving a one-store operator

**Naming note:** “Maintenance Intelligence” is a temporary, changeable product label. Clark's is only the fictional pilot/demo tenant and is never the software brand.

## 1. Product and architecture decision

Maintenance Intelligence is an owner-side spending visibility, preventive-maintenance, lifecycle and vendor-accountability platform for every maintenance trade. HVAC and refrigeration receive the deepest demo data and workflows, but the domain model also supports foodservice, electrical, plumbing, fuel, building, life safety, landscaping, snow, janitorial, pest, signage, waste and organization-defined categories. The operator's work order is the evidence spine: requests, classification, assignments, provider responses, visits, follow-ups, PM occurrences, cost lines, optional invoices, files and audit events attach to it or lead to it.

The rebuild will be a multi-tenant TypeScript web monolith deployed to a Cloudflare-compatible runtime. It will use D1 for relational operational data and R2 for private file objects. Framework-independent domain services will own workflow rules; route handlers and channel adapters will translate HTTP, email links, QR visits and provider APIs into the same domain commands.

The product includes lightweight manager review, internal work queues, requested/scheduled windows, concise checklists, service evidence and cost records so internal or external maintenance can be coordinated. It is not a dispatch suite. It deliberately stops short of route optimization, employee rostering, payroll, inventory valuation, vendor marketplace administration, full AP/accounting administration, purchase-order administration, accruals, payment execution/tracking, tax, accounts receivable, general-ledger replacement, predictive AI and continuous location tracking.

### Non-negotiable product rules

- Every tenant-owned operation begins with `organization_id`.
- A store belongs directly to an organization. Division and region are optional reporting scopes independent of equipment classification.
- The organization owns an unlimited, uneven-depth maintenance taxonomy. Each store activates only relevant branches.
- A work order is valid with a store only; category, nested taxonomy path, asset and component may be added later.
- Original employee-report content and audit history are append-only.
- Every unresolved, non-terminal work order has an accountable party, next required action, due time and escalation destination.
- Internal and external fulfillment use one work-order lifecycle and one evidence model.
- A vendor portal is optional. Email/deep links, phone-recorded responses, QR and APIs are first-class channels.
- Money is stored in integer cents. Recorded work cost, approved amount and linked invoice amount remain distinct and every view names its basis.
- Dashboards are the primary product surface; generated reports are versioned handoff/archive records rather than live dashboard copies.
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
Location commissioning Stores, divisions, regions, areas, readiness
Taxonomy                Canonical concepts, local labels and aliases
Equipment               Store taxonomy activation, assets, components, warranties
Request intake          Immutable employee reports and reviews
Work control            Work orders, classification, assignments, follow-ups
Provider exchange       Email links, portal, API/webhooks, phone recording
Visit evidence          QR sessions, check-in/out and one basic outcome
Preventive maintenance  Plans, targets, occurrences and linked work orders
Spending evidence       Work costs, approvals, optional invoices and attribution
Files & communication   Private files, links, messages and outbox
Analytics               Visual dashboards, outliers, lifecycle, coverage and drill-through
Report records          Generated snapshots, handoff, versions and archive
Audit                   Append-only domain and security events
```

Domain modules accept typed records and an injected clock. They do not import React, D1, R2 or environment state. HTTP handlers authorize and validate, call one domain operation, persist its batch, and return a projection.

## 4. Tenant and organizational model

### Core hierarchy

```text
Organization
└── Division (optional reporting scope)
    └── Region (optional reporting scope)
        └── Store
```

`stores.organization_id` is mandatory. Division/region membership is nullable and may be represented by effective-dated scope-assignment rows so reorganizations do not rewrite store identity or history. A one-store organization needs neither a placeholder division nor a placeholder region. A store remains directly tenant-owned even when the UI presents the full company -> division -> region -> store path.

One person may hold several roles. Authorization is expressed through organization membership plus zero or more scope grants at organization, division, region or store level. A vendor relationship is organization-private even if the same real-world company serves another customer.

### Tenant isolation

D1 does not provide row-level security, so isolation is enforced structurally and in repositories:

- Every tenant table contains `organization_id`.
- Unique constraints are tenant-relative, for example `(organization_id, work_order_number)`.
- Relationships use organization-aware validation; no repository infers tenant only through a joined parent.
- Repository methods require a non-optional `OrganizationContext` as their first argument.
- Queries place `organization_id = ?` before role, division, region, store, vendor or status filters.
- API detail routes return not-found for out-of-scope records to avoid enumeration.
- Automated tests attempt cross-tenant reads, writes, token reuse and file access.

Platform-provided taxonomy and store blueprints are non-operational templates. Provisioning copies selected definitions into an organization; runtime work never shares tenant operational rows.

### Single-store adaptation

Single-store customers use the same schema and routes. The UI adapts by hiding division/region navigation, removing meaningless store comparison, defaulting the store scope and allowing one person to hold owner, requester, reviewer and approver roles. The product does not maintain separate “small business” code paths.

## 5. Organization scope and maintenance taxonomy are independent

The organization-scope axis describes **which part of the operator** is selected:

```text
Company/organization -> optional division -> optional region -> store
```

The maintenance-taxonomy axis describes **what kind of maintainable thing or service** is selected:

```text
Category/department
└── zero or more organization-defined grouping levels
    └── store asset/service instance (optional)
        └── component tree (optional)
```

Branches are intentionally uneven. Refrigeration may use `Refrigeration -> Coolers -> Walk-ins -> Beer Cave`, while landscaping may stop at `Landscaping`. Each store activates only relevant organization-owned branches; it does not create its own incompatible copy of the language. Optional store areas describe physical position but are not taxonomy parents.

Imported account, department, project or invoice references are a third, optional attribution axis. They never become equipment parents and are not required for dashboards, PM or lifecycle features.

### Store equipment tables

- `store_areas(organization_id, store_id, canonical_type_id?, local_name)`
- `store_taxonomy_activations(organization_id, store_id, taxonomy_concept_id, status, provenance)`
- `assets(organization_id, store_id, taxonomy_concept_id?, area_id?, asset_type_id?, tag?, serial_number?, lifecycle fields)`
- `components(organization_id, store_id, asset_id, parent_component_id?, component_type_id?, local_name?, lifecycle fields)`
- `warranties(organization_id, asset_id?, component_id?, provider_relationship_id?, terms)`

An asset can be created directly under a store when classification is unknown. A later taxonomy association preserves the asset ID and appends a hierarchy event. Components may nest when useful but remain optional. Deeper work-order associations are optional; when supplied, the domain service validates organization, store, activated taxonomy path and component-to-asset belonging.

## 6. Canonical taxonomy with local language

Analytics requires stable concepts; store teams and regional operators require familiar labels. The rebuild separates those concerns.

### Model

- `taxonomy_concepts(organization_id, id, kind, canonical_key, parent_concept_id?, status)`
- `taxonomy_labels(organization_id, concept_id, locale, display_label, is_primary)`
- `taxonomy_aliases(organization_id, concept_id, store_id?, normalized_alias, display_alias, source)`
- `taxonomy_mappings(organization_id, source_system, source_code, concept_id)`

Kinds include `category`, `group`, `area_type`, `asset_type`, `component_type`, `problem_code`, `outcome_code` and `cost_class`. A `group` may parent another `group` without an application-defined depth limit. Cycle checks, organization ownership and stable sibling ordering are enforced in domain commands.

`canonical_key` is stable and drives rules and reporting. Labels may change without rewriting history. Aliases support terms such as “roof unit,” “RTU,” a local nickname or an imported vendor code. Store-specific aliases are allowed, but they resolve to an organization-owned canonical concept. Search indexes canonical labels and aliases; saved records retain the concept ID plus the label snapshot shown when the event occurred.

The initial product activates an all-trades maintenance taxonomy. HVAC and refrigeration receive the deepest grouping, asset, component, PM, work-history and cost examples; other common trades remain fully active even when their configured branches are shallow.

### Progressive classification

`work_orders.store_id` is required. `taxonomy_concept_id`, `asset_id` and `component_id` are nullable. The selected concept can be a category or any descendant group. Classification occurs through a domain command that:

1. Validates tenant and physical belonging.
2. Appends `work_order_classification_events` with prior/new associations, actor, channel and reason.
3. Updates the work order's current classification projection.
4. Recomputes no historical cost attribution silently.

Reporting always shows classification coverage. Asset-level reports include an explicit unclassified bucket and a denominator such as “64% of selected HVAC/R maintenance cost is classified to an asset.”

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
- current estimate/NTE/authorization projection when used
- opened, resolved, verified and closed timestamps

Status is changed only through named domain commands. Original due dates, provider responses, classifications, approvals and visit outcomes are retained in append-only events.

### Closure rule

A work order cannot close while it has an open required follow-up or unresolved configured verification. Optional invoice review is independent and cannot keep completed maintenance artificially open. An unresolved visit outcome creates its follow-up in the same database batch. Rescheduling requires a reason and retains the missed date.

## 8. Unified internal and external assignment

Internal and vendor work share one assignment abstraction:

`work_order_assignments(organization_id, work_order_id, assignee_type, person_id?, provider_relationship_id?, status, response_due_at, accepted_at?, ended_at?, next_action, due_at, escalation_target)`

A constraint requires exactly one target. `assignee_type` is `internal` or `provider`. A work order may have sequential assignments and, when explicitly justified, concurrent assignments, but only one assignment owns the next required action at a time.

Equal product support means both modes provide the same owner visibility, target clock, observed evidence, unresolved-work controls and cost linkage. Internal teams additionally receive a practical assignment queue, requested/scheduled windows, concise checklist and labor/material cost capture. These records support maintenance visibility and execution, not dispatch optimization, payroll, employee scheduling or inventory accounting.

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
| Purpose-bound deep link | Limited work-order view, response, timing or document action |
| Optional provider portal | Recurring vendors who want queues and document history |
| Provider API/webhook | High-volume vendors staying in their own FSM/CMMS |
| Phone-recorded response | Manager records a vendor response with recorder attribution |
| Technician QR | Entered name/vendor, work-order selection or unmatched exception, check-in/out and one outcome |

`interaction_events` records `actor_type`, asserted identity, verified identity when available, channel, purpose, timestamp, payload snapshot and recorder. Email replies may append messages and attachments; structured state changes require explicit action links rather than natural-language interpretation.

Provider projections exclude other vendors' pricing, internal notes, confidential approvals and unrelated stores.

## 9. Visit evidence and public tokens

Public links never contain an editable bare record ID. `public_tokens` stores organization, purpose, record binding, token hash, expiry, use/revocation state and version. Raw token material is never stored.

- Vendor response tokens are short-lived and can be single-use.
- Technician work-order links may be issued after provider acceptance.
- Store QR tokens are purpose-bound, rotatable entry points and reveal no unrestricted store data. They also support a reviewable “work order not listed / no number provided” path so a legitimate visit is not blocked.
- Production secrets are environment-managed with no source fallback.

The technician journey is limited to:

`store QR → entered technician name/vendor → select WO or unmatched exception → check-in → rescan/select active visit → optional notes/photos → one outcome → checkout`

Location is collected only at check-in and checkout when the operator enables that policy. D1 stores timestamp, submitted coordinates, browser accuracy, derived distance and verification result. No background tracking or route history exists. Check-in/out duration is explicitly approximate observed onsite time, not certified labor. Signatures, accounts and photos are not globally required. Demo simulations are visibly labeled “Demo Mode” in both UI and audit timeline.

## 10. Preventive maintenance

- `pm_plans(organization_id, canonical task, cadence, window, evidence policy, status)`
- `pm_plan_targets(organization_id, pm_plan_id, target_type, target_id)`
- `pm_occurrences(organization_id, pm_plan_id, target_id, due/window fields, status, work_order_id?)`

Plans target known stores, taxonomy branches or assets. Blueprints may propose PM coverage but never create fake assets. Materialization is idempotent through a unique plan/target/due key. Missed, waived and rescheduled occurrences preserve the original due window and reason. Any generated work uses the canonical work-order lifecycle.

Lifecycle projections join PM and work history to asset identity fields such as manufacturer, model, serial, supplier, purchase/installation dates, warranty, expected life, replacement estimate, maintenance strategy, criticality and optional meter data. Repair-versus-replace rules expose every input, threshold, cohort and source record. No opaque health score or automated replacement command is permitted.

## 11. Spending evidence and optional invoice safeguard

This module connects maintenance cost to work, visits, vendors, stores and equipment for dashboards and human review. It is optional beyond basic work-order cost capture and is not an accounting/AP suite, ERP, purchasing system, general ledger or payment system.

### Source records

- `work_order_cost_lines` for explicit labor, material, vendor and miscellaneous amounts
- `proposals` and simple `approvals` when an organization uses quote/NTE controls
- `invoices` and `invoice_lines`
- `invoice_work_links` connecting an invoice to one or more work orders/visits
- `cost_attributions` connecting source amounts to store, taxonomy node, asset or component
- `external_accounting_references` for imported/exported identifiers without owning the external accounting structure

All money is integer cents with explicit currency. Recorded work cost, approved amount and linked invoice amount are separate bases; dashboards never add overlapping bases together as if they were one total.

### Review and attribution rules

- Upload/import and invoice review are organization-configurable and never required to use PM, lifecycle or vendor accountability.
- One invoice can link to multiple work orders or equipment targets, but attributed amounts must reconcile to the invoice total.
- Unmatched invoices, unlinked balances and unclassified amounts remain visible; over-attribution is rejected.
- Duplicate references, amount differences, visit counts, approximate onsite duration and missing captured evidence are review signals, not automatic payment decisions.
- Corrected source facts append an amendment/replacement record and audit event rather than silently overwriting a reviewed fact.
- Future ERP integrations may exchange references, files or statuses, while the customer's accounting system remains authoritative.

Cost is never assigned from free-text matching. Asset/component rollups use explicit source associations, and the selected basis/period remains visible throughout drill-down.

The reporting layer can answer the same selected maintenance-cost basis along the independent organization-scope and maintenance-taxonomy axes, with optional vendor, fulfillment, work-type and external-reference filters. Every route ends at supporting work, visit, PM, invoice and attribution records.

## 12. Manager-first information architecture

The default application surface is a visual spending dashboard that combines organization scope, company taxonomy, PM/lifecycle signals, vendor evidence and exact source-record drill-through. Maintenance execution remains connected but intentionally simple; it does not consume the product.

### Primary navigation

1. **Portfolio dashboard** — company/division/region/store spend, trends, outliers and record drill-down
2. **Stores** — global store search, store dashboards, commissioning and equipment/cost depth
3. **PM & lifecycle** — compliance, due/missed work, lifecycle bands and transparent replacement review
4. **Vendor accountability** — responses, planned arrival, observed visits/evidence, returns and optional portal
5. **Reports & records** — generated management snapshots, handoff, versions and archive
6. **Maintenance workspace** — requests, lightweight approval, work orders, windows and internal execution
7. **Equipment & taxonomy** — company language/tree, store activation, assets, components and warranties
8. **Invoices (optional)** — upload/import, work/visit matching and review exceptions; no payment or AP execution
9. **Administration** — organization scopes, roles, taxonomy, routing, cost/import controls and audit

Single-store users see the same order with store scope preselected and portfolio-only comparisons removed.

### Action Center queues

- Needs triage
- Awaiting internal/provider response
- Response or service target overdue
- Clarification requested
- Quote or approval needed when policy requires it
- Unresolved follow-up overdue
- Completion awaiting verification
- Optional invoice/work mismatch

Each count is calculated from source records and opens the exact filtered list. Every row shows accountable party, next action, due time, escalation destination and blocker.

### Global search

One search box supports exact and prefix lookup for:

- work-order number
- store code, name and normalized address
- asset tag, serial number and local alias
- provider name
- quote/invoice number

Results are tenant-scoped before matching and grouped by entity. Search never loads an organization's full dataset into the browser. Descriptions and notes may use a tenant-scoped FTS index; exact operational identifiers use normalized indexed columns.

## 13. Reporting and drill-through contracts

The dashboard combines two independent paths:

- Scope: `organization/company → optional division → optional region → store`
- Classification: `category → zero or more nested groups → asset → component`

Either path ends at exact work orders, visits, PM occurrences, cost lines, optional invoices and cost attributions.

Every aggregate response includes:

- period and timezone
- selected organization scope and taxonomy path
- selected maintenance-cost basis
- cohort/filter definition
- value and record count
- classification coverage where relevant
- a serializable supporting-record filter

The UI constructs the next drill level from that filter rather than from an unrelated dashboard dataset. Unclassified work remains visible at every optional level. Medians and percentiles are preferred for skewed cost and resolution measures. Replacement review shows explicit rules, reasons, thresholds and source records; it never emits an opaque health score or automatic replacement order.

Generated reports persist a snapshot specification rather than copying opaque chart pixels: creator, generation time, scope, taxonomy path, period, cost basis, definitions, selected narrative and supporting-record filters. A handed-off report version is immutable; regeneration creates a new version. Archived records retain source links and indicate when the underlying live data has changed since generation.

## 14. D1 implementation path

### Clean schema and migrations

The rebuild starts with a new baseline migration organized by bounded module. Drizzle defines types and migrations; hand-reviewed SQL adds checks, compound tenant indexes, FTS tables and immutable-row triggers where required.

Write operations that must remain atomic use a D1 batch:

- report review + work-order creation + source link + audit
- classification projection + classification event + audit
- provider response + assignment transition + fallback/outbox + audit
- unresolved checkout + visit evidence + follow-up + work-order control + audit
- optional invoice link/cost attribution reconciliation + audit

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
- One isolated one-store operator proving no placeholder division/region or comparison UI is required.
- Active all-trades taxonomy with organization-specific labels and aliases, plus especially deep HVAC and refrigeration examples.
- Uneven-depth company taxonomy branches, credible store assets/components and intentionally incomplete classification to exercise coverage.
- Employee reports at store-only, category and fully classified depths.
- Internal and external assignments using email, phone-recorded, optional portal/API and QR channels, including an unmatched-work-order visit.
- Accepted, declined, clarification, overdue, unresolved follow-up and verification scenarios.
- PM due, completed, missed, waived and linked-work scenarios.
- Work cost, optional quote/approval, invoice, invoice-to-work link and unmatched-invoice examples in integer cents.
- Private file metadata and append-only audit histories.

Named scenario IDs remain stable for demos and tests, including a high-cost refrigeration store, an asset watchlist case, an unclassified work-order case, a no-portal vendor acceptance and an unresolved visit that produces a follow-up.

Dashboard values are never seeded separately. They are calculated from these records. The generator asserts referential integrity, invoice-attribution reconciliation, tenant isolation and the unresolved-work invariant before completing.

## 18. Index, query and pagination strategy

Representative indexes:

```text
work_orders(organization_id, status, next_action_due_at, id)
work_orders(organization_id, store_id, created_at, id)
work_orders(organization_id, taxonomy_concept_id, created_at, id)
work_orders(organization_id, asset_id, created_at, id)
employee_reports(organization_id, review_status, submitted_at, id)
work_order_assignments(organization_id, assignee_type, status, response_due_at, id)
work_order_assignments(organization_id, provider_relationship_id, status, id)
follow_ups(organization_id, status, due_at, id)
pm_occurrences(organization_id, status, due_at, id)
proposals(organization_id, status, decision_due_at, id)
invoices(organization_id, status, submitted_at, id)
cost_attributions(organization_id, store_id, cost_basis, occurred_at, id)
cost_attributions(organization_id, taxonomy_concept_id, cost_basis, occurred_at, id)
cost_attributions(organization_id, asset_id, cost_basis, occurred_at, id)
audit_events(organization_id, entity_type, entity_id, occurred_at, id)
stores(organization_id, normalized_code)
assets(organization_id, normalized_tag)
assets(organization_id, normalized_serial_number)
```

Lists use keyset pagination with a deterministic secondary `id` sort. Filters are URL-serializable and accepted by both aggregate and detail endpoints. High-cardinality free text uses an FTS table keyed by organization and entity; exact identifiers do not rely on FTS. The separate 65-store fixture must pass using live indexed aggregates even though the presentation demo contains only 12 stores. Cached or materialized summaries are introduced only after query profiling, and every cache key includes organization, scope, taxonomy path, period, cost basis, filter and data version.

Query-plan tests use `EXPLAIN QUERY PLAN` for the principal queues, global identifier search and organization-scope/taxonomy drill paths. Performance tests assert bounded response sizes and stable pagination under concurrent inserts.

## 19. Test strategy

### Domain unit tests

- Store-only work order and every progressive-classification depth.
- Physical belonging validation and append-only reclassification.
- Immutable employee reports, generated report versions and audit behavior.
- Work-order transition guards and closure rejection.
- Unresolved visit creating a follow-up in the same operation.
- SLA, overdue, reschedule-reason and escalation logic.
- PM materialization, uniqueness, completion, waiver and missed windows.
- Optional quote/NTE/approval transitions.
- Invoice-attribution equality, unmatched balances and dual-axis rollups.
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
3. Store QR → WO selection or unmatched exception → check-in → optional evidence → checkout → observed visit projection.
4. Store commissioning → company-taxonomy activation → assets/components → PM targets → readiness with intentional gaps.
5. Dashboard company/division/region/store switch → arbitrary taxonomy-depth drill → source records → generated archived report.
6. Optional invoice upload/import → work/visit link → evidence review → reconciled or unmatched amount.
7. One-store organization completing the same workflows without division/region records.

### Browser QA

Inspect desktop manager and mobile requester/technician paths in a real browser:

- Portfolio spending chart/outlier to exact supporting records.
- Company/division/region/store switch with independent taxonomy drill-down.
- Global search by store number, address, WO number, asset tag and invoice.
- New-store commissioning continuity.
- Work-order creation with taxonomy/asset/component deferred.
- Internal and external assignment parity.
- Provider email/deep-link flow with no account.
- Technician QR check-in/out, unmatched-WO path and visible location exception.
- Category → arbitrary grouping depth → asset → component → source-work drill-through.
- PM/lifecycle outlier to asset history and transparent rule inputs.
- Generated report handoff/version/archive behavior.
- Single-store IA with portfolio-only controls removed.

Before release run type checking, lint, all unit/integration/end-to-end tests, production build, accessibility checks and principal browser journeys. No seeded or UI-only total may bypass domain calculations.

## 20. Delivery sequence

1. Establish tenant context, two-axis taxonomy/scope model, deterministic 12-store demo and separate scale fixtures.
2. Build visual spending aggregates, global search, server pagination and source-record drill-through.
3. Build store commissioning, taxonomy activation, asset lifecycle records, PM occurrences and transparent outlier rules.
4. Build immutable requests, canonical work orders, progressive classification and lightweight internal/external assignments.
5. Add email/deep-link vendor response, optional portal, flexible technician QR visits and unresolved follow-up control.
6. Add optional invoice-to-work safeguard and private R2 files without introducing payment/accounting ownership.
7. Add generated report records, versions, handoff and archive.
8. Add provider API/webhooks, production auth, outbox delivery and operational hardening.

The prospective approximately 65-store pilot is a scale target, not a requirement to load all 65 stores into the presentation demo and not a reason to fork the product or introduce distributed architecture.
