# Convenience Retail Suite — Earlier Clean-Slate Product and Build Plan

> **Superseded for implementation:** The current product, operating, production-readiness, and rebuild source of truth is [`CSTORE_PLATFORM_REBUILD_BLUEPRINT.md`](CSTORE_PLATFORM_REBUILD_BLUEPRINT.md). This file remains useful product history only where it does not conflict with that blueprint.

**Status:** Build blueprint  
**Product label:** Temporary; the eventual umbrella brand must remain industry-neutral  
**Initial edition:** Purpose-built convenience retail  
**Demo tenant:** Clark Pump and Shop, a completely fictional operator
**Demo shape:** 15 stores, five outside vendors, one small internal maintenance team

## 1. Clean-slate decision

The previous application is discarded. It is not a design reference, migration target, component source, route map or data-model constraint. The new suite starts from this plan and the repository product invariants.

The Convenience Retail Suite is a complete vertical product, not a generic maintenance application with c-store labels. It should understand stores, regions, refrigeration, HVAC, forecourt equipment, foodservice, thin store staffing, outsourced service, emergency calls and invoice references by default. Shared infrastructure may later support other purpose-built industry suites and a portfolio control tower, but V0 must optimize for convenience retail without exposing hypothetical cross-industry complexity.

## 2. Product thesis

**Promise:** Know what needs attention at every store, who owns the next action, what a vendor actually recorded onsite, what the work cost and which source records support that cost.

**Entry wedge:** Low-friction vendor accountability through operator-issued work orders and cross-channel visit check-in/out.

**Expansion value:** Store and portfolio spending visibility, preventive-maintenance control, equipment history, lifecycle planning, vendor performance and archived management reporting.

The connected evidence chain is the product:

> Issue or PM occurrence → operator work order → internal or outside assignment → vendor issuance/acceptance → observed visit → outcome/follow-up → cost or invoice link → dashboard/lifecycle/report drill-through

The operator work order is the source record. It also serves as the customer's service-authorization and billing reference, similar to a lightweight PO, without turning the suite into purchase-order or accounting software. Vendors may keep using their own dispatch, ticketing and invoicing systems; they only need to retain the operator work-order number and include it on their invoice.

### Experience principles

1. **Visual first, source records underneath.** Managers begin with store, spend, PM, lifecycle and exception views. Every number and chart segment opens its exact supporting records.
2. **Simple by default, deeper when useful.** A valid work order needs only a store, problem, priority and fulfillment choice. Category, taxonomy path, asset, component, approval, visit evidence, invoice and PM links are progressively optional.
3. **One lifecycle for internal and outside work.** Internal, external and blended fulfillment use the same work order, accountability and reporting semantics.
4. **Vendor participation stays light.** Email/SMS links, printable work orders, QR/mobile web and store kiosk flows work without a vendor account. The portal is optional.
5. **Evidence, not surveillance.** Capture location only at check-in/out when policy enables it. Onsite duration is approximate presence context, never certified labor time.
6. **Exceptions remain visible.** Missing work-order references, unmatched visits, overdue next actions, invoice differences and incomplete classification appear in review queues rather than being guessed away.
7. **Optional adoption changes the interface, not the truth model.** Disabled capabilities disappear from navigation and required fields; existing records continue to use the same underlying entities.

## 3. Suite boundaries

### Included product areas

| Area | Responsibility |
|---|---|
| Store Network | Company, optional division/region, stores, store search, contacts, hours, access notes, QR configuration and guided store setup |
| Requests & Work Orders | Employee issue intake, triage, internal/external/blended assignment, approvals when enabled, follow-ups and complete work history |
| Vendor Network | Approved vendor CRM, specialties, aliases, coverage, store/category preference, dispatch contacts, issuance history and optional portal users |
| Visit Accountability | Secure links, QR/mobile web, store kiosk, future native app, active visits, location-result evidence, no-work-order exceptions and checkout outcomes |
| Spend Intelligence | Entered work costs, approved/NTE amounts, linked invoice amounts, store/vendor/category trends, exceptions and exact record drill-through |
| Equipment, PM & Lifecycle | Flexible company taxonomy, store assets/components, warranties, PM plans/occurrences, repair history and transparent capital-review rules |
| Reports & Records | Interactive dashboards, immutable audit history and generated/versioned management snapshots with definitions and source links |
| Administration | Roles/scopes, policies, terminology, taxonomy, templates, imports, integrations and capability configuration |

### Explicitly outside the suite

- Full accounting, general ledger, AP automation, payment execution, tax, banking or accounts receivable.
- Formal purchasing/PO administration, receiving, stock replenishment or warehouse inventory.
- POS, fuel pricing, merchandising and retail inventory.
- Payroll, employee timekeeping, shift scheduling and route optimization.
- Vendor dispatch-system replacement or vendor marketplace.
- Continuous technician tracking.
- Automatic invoice rejection, fraud accusation or opaque asset-health/replacement scoring.

The platform may preserve an external PO/reference field and later exchange records with an ERP. The external accounting system remains authoritative.

## 4. Role-specific information architecture

The suite can be broad without feeling broad because each role receives a purpose-built shell.

### Owner / executive

**Primary navigation:** Overview, Stores, Spend, Vendors, PM & Lifecycle, Reports.

**Home answers:** What changed? Which stores and systems explain it? Which vendor, asset, PM exception or invoice needs attention? Every KPI drills into filtered records while preserving period, scope and cost basis.

### Facilities / maintenance manager

**Primary navigation:** Today, Work, Visits, Vendors, Stores, PM, Equipment, Spend.

**Today queues:** New requests, ready to assign, awaiting vendor response, onsite now, unmatched visits, waiting on parts, overdue follow-ups, verification needed, missing classification and optional invoice exceptions.

### Regional manager

**Primary navigation:** Region Overview, Stores, Exceptions, Work, Spend, Reports.

Region scope remains visible; the user can move from a regional outlier to one store, system, asset and source work order without losing filters.

### Store employee / storefront portal

Use large type and three obvious actions:

1. **Report an issue**
2. **Vendor sign in or out**
3. **View open store issues** when policy permits

Issue language captures observable symptoms, not diagnosis. Store staff never need to understand the equipment hierarchy to report legitimate work.

### Store manager

**Primary navigation:** Store Today, Issues, Visits, Equipment, Store Costs.

The manager can add context, review requests, see who is onsite, confirm exceptional visits/work when policy requires it and inspect store history. Submitted employee reports cannot be deleted or rewritten.

### Internal technician

**Primary navigation:** My Queue, Team Queue, Current Work, Completed.

The technician can acknowledge, start/end a visit, review useful store/equipment history, record work/cost/evidence and choose a resolved or unresolved outcome. Payroll and route planning are absent.

### Vendor office — optional portal or secure action link

**Primary actions:** Review issued work, accept, decline, propose timing, ask a question, add the vendor's ticket number and upload permitted documents. A full account is optional.

### Vendor technician — mobile task flow

**Primary actions:** Identify/select work order, check in, see permitted problem/asset context, add optional evidence, choose outcome and check out. The technician never sees another vendor's pricing, unrelated work or internal notes.

### Finance / AP reviewer — optional safeguard

**Primary navigation:** Invoice Review, Unmatched, Exceptions, Evidence Packets.

This role links invoices to operator work orders and reviews factual discrepancies before continuing in the customer's accounting process. There is no payment status workflow.

### Organization administrator

**Primary navigation:** Organization, Stores, People & Access, Vendors, Taxonomy, Templates, Policies, Imports, Audit.

Demo role switching must remain visibly labeled **Demo Mode** and is not production authentication.

## 5. Navigation and route model

Suggested manager routes:

```text
/app/today
/app/overview
/app/stores
/app/stores/:storeId
/app/work
/app/work/:workOrderId
/app/vendors
/app/vendors/:vendorId
/app/visits
/app/spend
/app/equipment
/app/equipment/:assetId
/app/pm
/app/reports
/app/invoices                 # hidden when invoice safeguard is disabled
/app/setup
```

Focused experiences:

```text
/store/:token                # authenticated store device or purpose-bound store session
/vendor-action/:token        # accept/decline/propose/clarify without an account
/visit/:token                # QR/mobile check-in and checkout
/vendor                      # optional authenticated vendor portal
```

A persistent organization-scoped search must find stores by number/name/address/alias, vendors by name/specialty/alias/coverage, work orders by number/title, assets by code/name/model/serial and invoices/documents by reference. Results use server-side filtering, stable ordering and pagination.

## 6. Core domain model

All tenant-owned entities begin with `organization_id`. Stable internal IDs are separate from display numbers and external references.

| Domain | Core entities |
|---|---|
| Tenant and scope | `Organization`, optional `Division`, optional `Region`, `Store`, `StoreAlias`, `Person`, `RoleGrant` |
| Service network | `InternalTeam`, `TeamMembership`, `Vendor`, `VendorContact`, `VendorSpecialty`, `VendorAlias`, `VendorCoverage`, `VendorPreference` |
| Taxonomy and equipment | `TaxonomyNode`, `TaxonomyAlias`, `StoreTaxonomyActivation`, `Asset`, `Component`, `Warranty`, `EquipmentDocument` |
| Work | `Request`, `WorkOrder`, `Assignment`, `VendorIssuance`, `VendorResponse`, `FollowUp`, `Verification`, `Communication` |
| Presence and evidence | `Visit`, `VisitIdentity`, `VisitLocationEvidence`, `VisitOutcome`, `VisitCorrection`, `Document` |
| PM and lifecycle | `PMPlan`, `PMOccurrence`, `ChecklistResult`, `CapitalReview`, `CapitalDecision` |
| Money | `Estimate`, `Quote`, `Authorization`, `CostLine`, `Invoice`, `InvoiceLink`, `InvoiceAllocation`, `ExternalReference` |
| Records and access | `AuditEvent`, `ActionToken`, `ReportSnapshot`, `ReportVersion`, `SavedView`, `ImportBatch` |

### Required data rules

- Store identity uses separate stable ID, store number, name, structured/normalized address and searchable aliases.
- Organization scope (`company → optional division → optional region → store`) is independent from maintenance taxonomy (`category → uneven nested groups → asset → optional components`).
- A work order is valid at store level; deeper classification may be deferred and later appended with a reclassification audit event.
- Money is stored in integer minor units plus currency. Estimate, authorization/NTE, entered cost and linked invoice bases remain distinct.
- Original requests, issuance revisions, vendor responses, visit timestamps/evidence, invoice links and finalized cost facts are never silently overwritten. Corrections append actor, reason, prior value and new assertion.
- Every unresolved non-terminal work order exposes the accountable party, next required action, due timestamp and escalation destination.
- Work-order state, assignment state, visit state and invoice-review state are separate. The UI may present a friendly combined status, but the data model must not collapse them.
- All domain commands append an organization-scoped audit event in the same transaction.
- Files are private and served through permission checks or short-lived URLs.
- QR/action tokens are opaque, purpose-bound, hashed at rest, expiring and rotatable; no public route accepts an editable bare database ID.

### Suggested state model

- **Work order:** `draft | open | in_progress | completion_review | closed | cancelled`
- **Assignment:** `pending | issued | acknowledged | accepted | declined | active | released | completed`
- **Visit:** `active | ended | corrected | voided`
- **Outcome:** `resolved | temporary_resolution | waiting_on_parts | unresolved | unable_to_diagnose | no_issue_found | unable_to_perform`
- **Invoice review:** `received | unmatched | matched | review_needed | evidence_ready | archived`

Friendly labels such as **Awaiting vendor response**, **Technician onsite** or **Waiting on parts** are projections derived from these facts and next-action records.

## 7. Principal workflows

### 7.1 Report, triage and create work

1. Employee selects the store automatically or through permitted search, describes the observable problem, chooses urgency and optionally adds media/name/employee ID.
2. The immutable request enters triage. Policy may auto-create a work order or require manager review.
3. Work-order creation requires store, concise problem, priority and requested timing. Category, taxonomy path, asset and component can be selected or explicitly deferred.
4. The first fulfillment decision is **Who should handle this?**
   - **Internal maintenance** — first choice in the selector.
   - **Outside vendor** — opens approved vendor search.
   - **Choose later** — creates an accountable assignment task.
5. A manager may later change internal to external, external to internal or use blended fulfillment without creating disconnected work.

### 7.2 Internal assignment

Internal work can be assigned to a team queue or a person. Assignment includes requested/scheduled window, scope, acknowledgement state and next action. Internal technicians use the same visit, outcome, evidence, follow-up and cost semantics as vendors.

If an internal technician diagnoses work that requires an outside specialist, the same work order gains an external assignment and vendor issuance. History shows the responsibility transition.

### 7.3 Search and select an outside vendor

Vendor search supports company name, aliases, formal trade, plain-language specialty, description, equipment type, coverage area, store and dispatch contact. Queries such as `plumber`, `beer cave`, `walk-in freezer`, `fuel pump`, `parking lot lights` and a vendor name must work.

Ranking is deterministic:

1. Preferred vendor for the selected store/category.
2. Other approved vendors covering the store.
3. Other organization vendors visible to the user.
4. Inactive/unapproved vendors only for authorized administrators.

Each result explains why it appears. Approval is an administrator decision, not an automatically inferred score.

### 7.4 Issue the operator work order to a vendor

After vendor selection, the manager chooses:

- **Send now** by email and optional SMS.
- **Save without sending**.
- **Already contacted by phone/email**, preserving who recorded it and when.

Issuance creates an immutable, versioned **Work Order / Service Authorization** containing:

- Operator work-order number.
- Store number, address, contact and access instructions.
- Problem, requested scope, priority and service window.
- Optional category/asset/model/serial/warranty context and request photos.
- Optional NTE/authorized amount and approval instructions.
- Billing instruction: include the operator work-order number on the invoice and service documents.
- Secure action link plus printable PDF.

The operator work-order number, vendor ticket number, vendor invoice number and optional external accounting PO are separate fields. Example:

```text
Operator work order: NLM-2026-0004
Vendor service ticket: SUM-26-0704
Vendor invoice: SUM-260187
External accounting PO: PO-991482 (optional)
```

Scope or NTE changes produce a numbered issuance amendment; they never rewrite what was originally sent.

### 7.5 Vendor response without forced adoption

The secure link provides **Accept**, **Decline**, **Propose date** and **Ask a question**. The vendor may add its own ticket number. Delivery, view and response timestamps are recorded when observable.

A vendor is not required to create an account, assign technicians in the suite or reproduce its dispatch process. If it never responds digitally, the operator can record a phone/email response and continue. The work remains visibly **issued but unacknowledged** until an observed or manually recorded response exists.

### 7.6 Cross-channel visit and no-work-order path

Supported V0 channels are mobile web through store QR, secure vendor/work-order link and technician self-service on a trusted store device. A future native app must invoke the same commands.

1. Technician identifies themselves using a stable vendor-scoped identifier and selects their vendor.
2. The store is resolved by the secure QR/device context. When policy enables location evidence, the browser requests a fresh reading only at check-in and/or checkout.
3. The technician sees only open work orders issued to that vendor at that store.
4. **I don't see my work order / No work order provided** remains available. It captures why the technician is present and creates an unmatched visit for review.
5. Check-in creates one channel-independent active visit. The technician may check in by QR and check out on the store device or future app.
6. Checkout accepts optional notes/files/photos and requires a useful outcome. An unresolved outcome atomically creates the next follow-up, owner and due timestamp.

The system preserves channel, recorded timestamp, actor, location accuracy/distance/consent/result and verification state. It never backdates verified time. A missed check-in can add a separate **reported arrival** assertion marked unverified with reporter and reason. Observed onsite duration is clearly labeled approximate and is never automatic proof of billable labor.

### 7.7 Optional invoice safeguard

1. Finance uploads/imports an invoice or records header details.
2. Exact operator work-order reference is the first match key. Vendor, store, dates, amount and description may suggest candidates when the reference is absent or mistyped, but a person confirms the link.
3. One invoice may link to multiple work orders/visits/assets through explicit allocations. Allocations must reconcile; unlinked balance stays visible and over-allocation is rejected.
4. Review surfaces factual exceptions: duplicate reference/file, absent operator WO number, vendor/store mismatch, invoice versus NTE/quote difference, unmatched amount, visit count, approximate observed duration, unresolved outcome and missing enabled evidence.
5. Reviewer generates an evidence packet or archives the review before continuing in the external AP/accounting process.

The platform never concludes that elapsed presence proves labor, a photo proves quality or a mismatch proves invalid billing. It does not approve or pay the invoice.

### 7.8 PM and lifecycle

Company PM templates target a taxonomy branch, optional asset class and selected stores. Plans define cadence/season, completion window, checklist/evidence policy, internal/vendor fulfillment, estimated cost and escalation. Materialized occurrences may create the same canonical work orders used for reactive service.

PM compliance always shows numerator, denominator, window and source occurrences. Missed, waived-with-reason and not-applicable occurrences remain separate.

Assets may start with store, taxonomy path and name. Progressive fields include tag, manufacturer, model, serial, supplier, purchase/install dates, warranty, expected useful life, replacement estimate, criticality, manuals, components and PM plans.

Lifecycle review compares same-class assets inside the organization using age, expected life, reactive cost, repeat work/visits, warranty and PM history. Rules expose thresholds and exact drivers, then recommend human capital review—not automatic replacement. Recorded downtime is not inferred.

## 8. Dashboard and reporting contract

The manager home is the suite's star. It must support two independent selectors:

- **Operating scope:** company → optional division → optional region → store.
- **Maintenance depth:** category → any number of nested groups → asset → component.

A user can drill:

> Company spend → Metro Region → Store 104 → Refrigeration → Walk-ins → Beer Cave → Beer Cave Refrigeration System → work orders → visits/invoice

Every principal metric carries visible period, cost basis, comparison basis, scope, taxonomy path and classification coverage. Store-only/category-only work remains in totals through explicit **Unclassified below this level** buckets.

V0 principal views:

- Selected maintenance cost and prior-period change.
- Cost by store, category and vendor.
- Reactive versus planned/PM cost.
- Open critical work and overdue accountable actions.
- Vendor acceptance, observed visit and unresolved-follow-up facts.
- PM due/missed/compliance.
- Repeat repair and rule-based capital-review candidates.
- Optional invoice exceptions and unmatched invoice amount.

Generated reports are immutable/versioned snapshots of the selected dashboard scope, period, basis, filters, definitions and source links. Regeneration creates a new version.

## 9. V0 demo scope

V0 must be a connected demonstration, not a collection of static screens.

### Required functional slices

- Organization/division/region/store hierarchy and universal search by store number or address.
- Store dashboard with useful work, visit, cost, PM, equipment and vendor links.
- Searchable five-vendor directory with specialties, aliases, coverage and preferred-store/category relationships.
- Work-order creation with Internal / Outside vendor / Choose later and deferred equipment classification.
- Vendor issuance by secure link plus printable service-authorization view and separate vendor-ticket field.
- Vendor accept/decline/propose-date/clarify flow without account creation.
- Mobile QR and store-device check-in/out using the same active visit.
- Vendor/work-order filtering plus no-work-order unmatched visit.
- Checkout outcomes, follow-up creation and audit trail.
- Interactive company/region/store spending and taxonomy drill-through to source records.
- Equipment records with HVAC/Refrigeration depth, warranties, history and transparent lifecycle candidates.
- PM plan, occurrence, issued work, visit, completion and compliance drill-through.
- Optional invoice upload/demo import, operator-WO matching, allocation and evidence review.
- Versioned management report generation.
- Guided new-store creation with immediate usability and optional later equipment/PM setup.

### Capability configuration

Organization policies control whether the UI exposes or requires vendor acceptance, scheduling, geofence checks, store confirmation, assets, PM, invoice safeguard, approvals/NTE and vendor portal. Disabling a capability removes its navigation and validation burden; it must not fork the work-order data model or invalidate existing records.

Preset onboarding profiles may accelerate setup:

- **Essential:** work orders, vendor issuance and basic outcomes.
- **Accountable:** adds check-in/out, follow-ups and exception queues.
- **Controlled:** adds authorization, evidence policy and invoice safeguard.
- **Complete:** adds equipment depth, PM, lifecycle and expanded analytics.

These are starting configurations, not separate products or code branches.

## 10. Fifteen-store, five-vendor demonstration

### Fictional operator

**Clark Pump and Shop** operates 15 synthetic stores across three regions. Store numbers, people, addresses, phone numbers, emails, invoices, photos and financial values must be clearly fictional. The software itself carries a neutral temporary label; Clark Pump and Shop is only demo data.

Store mix should create believable differences:

- Five stores per region: Metro, Lakes and Interstate.
- All stores have refrigeration and HVAC.
- Selected stores add prepared food, car wash, expanded beer cave and/or high-volume fuel forecourt.
- Mixed building ages and equipment vintages.
- Optional region hierarchy proves portfolio drill-down; store identity remains directly tied to the organization.
- At least one newly opened store and one older cost-outlier store.

### Five approved vendors

| Vendor | Primary specialties | Narrative role |
|---|---|---|
| ColdLine Refrigeration & HVAC | Commercial refrigeration, walk-ins, beer caves, ice machines and HVAC | Preferred refrigeration vendor; deepest visit/invoice history |
| ClearFlow HVAC, Plumbing & Kitchen Repair | HVAC, plumbing and foodservice equipment | Broad mechanical coverage plus the emergency no-work-order drain visit |
| PumpPro Fuel & Dispenser Repair | Dispensers, payment terminals and fuel equipment | Specialized forecourt work across fuel-selling stores |
| BrightLine Electrical & Lighting | Electrical, canopy lighting, signs and low-voltage security | Demonstrates electrical/signage service and unmatched-visit review |
| GreenLot Landscaping & Snow Removal | Landscaping, snow, parking lots and exterior facilities | Demonstrates shallow taxonomy and recurring seasonal PM/service |

The demo also includes a two-person internal maintenance team so internal, external and blended work all have credible stories.

### Deterministic source data

Seed approximately 24 months of coherent requests, work orders, assignments, issuance revisions, vendor responses, visits, outcomes, follow-ups, PM occurrences, costs, invoices, allocations, files and audit events. HVAC and Refrigeration receive the deepest histories; other trades prove breadth without equal depth.

The seed generator must calculate every dashboard value from source records and include automated reconciliation assertions. Do not insert independent KPI totals or narrative numbers. Provide separate fixtures for a one-store operator and approximately 65 stores to prove adaptive navigation, search, pagination and aggregate performance without crowding the 15-store presentation.

### Required demo stories

1. **Trace a refrigeration dollar:** company cost → Metro Region → Store 104 → Refrigeration → Walk-ins → Beer Cave → asset → work order → two visits → invoice allocation.
2. **Issue work externally:** create a store-only work order, search `beer cave`, choose ColdLine Refrigeration & HVAC, send the service authorization, accept through secure link and add the vendor ticket number.
3. **Cross-channel visit:** technician checks in from the store QR and checks out from the store device with `waiting on parts`; the system creates the follow-up automatically.
4. **No-WO emergency:** ClearFlow HVAC, Plumbing & Kitchen Repair arrives for a drain backup without an operator WO, records an unmatched visit, and a manager later creates/links the work order without pretending it predated arrival.
5. **Blended work:** internal technician diagnoses an RTU problem and retains history while ColdLine Refrigeration & HVAC receives the external assignment.
6. **Invoice safeguard:** one invoice correctly carries its operator WO; another omits/mistypes it and exceeds NTE, producing factual review exceptions and a human-confirmed match.
7. **PM evidence:** seasonal RTU PM moves from occurrence through vendor issuance, visit and completion; the PM card drills to the exact records.
8. **Lifecycle review:** an older refrigeration asset is flagged for capital review using visible age, repeat reactive work, cost-to-replacement threshold, warranty and PM history—never inferred downtime.
9. **Store search/setup:** find stores by number and partial address, then create a usable new store before optional taxonomy/equipment/PM setup is complete.
10. **Executive handoff:** filter a regional spending view, generate a report snapshot and open its preserved source records.

The scripted presentation should lead with `Who is onsite?`, perform a live check-in, connect that visit to the issued work order, then reveal the cost/invoice/lifecycle drill-through. This demonstrates the customer's immediate accountability need before exposing the broader suite.

## 11. Technical build shape

Use a modular monolith for V0: one web deployment, one relational database and one domain-command layer. Do not split into microservices before operational load requires it.

Recommended boundaries:

```text
Web UI / focused mobile shells
        ↓
Server routes and authorization
        ↓
Domain commands and policies
        ↓
Transactional relational database + append-only audit events
        ↓
Private object storage / email-SMS adapters / scheduled-job adapter
```

Domain commands such as `createWorkOrder`, `issueToVendor`, `acceptAssignment`, `startVisit`, `endVisit`, `recordOutcome`, `linkInvoice`, `materializePMOccurrence` and `generateReportVersion` are the only mutation path regardless of UI channel. Commands are organization-scoped, idempotent where retries are expected and transactional with audit/follow-up changes.

Read models may optimize dashboard aggregates and queues, but they must remain rebuildable from source records. Search and list pages use database-side filtering, indexed ordering and cursor/stable pagination.

For a future cross-industry Portfolio product, this suite may publish a small versioned contract (`work.created`, `visit.started`, `visit.ended`, `cost.recorded`, `invoice.received`, `exception.opened`, `capital_review.created`) with organization/business/store/vendor, amount/currency where applicable, timestamp and source-record URL. V0 should define these events but does not build the master portfolio UI.

## 12. Render portability

The hosted web project must remain portable to a future Render project without a rewrite.

- Package the web app with a production `Dockerfile` or documented Node build/start commands; bind to Render's injected `PORT` and `0.0.0.0`.
- Use environment variables for `DATABASE_URL`, public base URL, token/encryption secrets, object-storage credentials, email/SMS providers and optional geocoding/maps. No host-specific URLs or credentials belong in source.
- Use PostgreSQL-compatible migrations and a separate, repeatable release/migration command. Application startup must not perform uncontrolled schema mutation.
- Store uploads in private S3-compatible object storage. Do not rely on ephemeral local filesystem or a single server disk.
- Expose unauthenticated liveness and database-aware readiness endpoints that reveal no tenant data.
- Keep scheduled PM materialization, reminders and stale-visit checks in an idempotent worker/cron entry point that can become a Render background worker or cron job.
- Make demo seeding explicit and environment-gated (for example, `seed:demo`, `seed:one-store`, `seed:scale`). Never seed production automatically.
- Use UTC for persistence and preserve store time zones for display and due-date calculation.
- Keep application sessions/tokens stateless or in shared storage so horizontal scaling does not depend on server affinity.
- Produce structured logs with correlation ID, organization ID when authorized, command name and audit-event ID; never log action tokens or sensitive location payloads.
- Provide `render.yaml` only when the user creates the Render project; the application should already conform to this deployment contract.

## 13. Delivery sequence

### Phase 1 — Foundation and design system

- New application shell, responsive typography, accessible components and Demo Mode treatment.
- Organization-first authorization, identities/roles, audit event framework and private-file abstraction.
- Core schema, migrations, deterministic seeds and source-derived metric tests.

### Phase 2 — Manager star experience

- Universal search, overview, store directory/detail and interactive scope/taxonomy drill-through.
- Useful record tables behind every principal metric and visible cost-basis/classification definitions.

### Phase 3 — Work and vendor issuance

- Request intake, work-order composer, Internal/Outside/Choose later routing, vendor search, versioned issuance, secure vendor response and work detail timeline.

### Phase 4 — Visit accountability

- QR/mobile web, store-device self-service, cross-channel active visit, no-WO queue, location evidence, checkout outcomes and automatic follow-up.

### Phase 5 — Spend, PM and lifecycle

- Cost lines and explicit bases, optional invoice match/allocation/review, PM plans/occurrences/compliance, asset history and transparent capital-review rules.

### Phase 6 — Reports, polish and deployment readiness

- Versioned report snapshots, demo story scripting, responsive/accessibility pass, error/empty/loading states, Render contract and full browser QA.

## 14. Demonstration acceptance criteria

The suite is demoable only when:

1. Every creation action persists and appears on relevant detail pages, queues, audit timelines and derived dashboards.
2. A manager can search a store by number/address and a vendor by name/specialty without loading all records into the browser.
3. A work order can be created without an asset, routed internal or external and enriched later with audited classification.
4. An outside vendor receives a versioned service authorization, can respond without an account and can preserve its own ticket reference separately.
5. A technician can check in and out through different supported channels, use the no-WO path and create an accountable unresolved follow-up.
6. Invoice review uses the operator WO number as the primary reference while clearly separating invoice, vendor ticket and external PO identifiers.
7. Company, region, store, taxonomy, asset, vendor, PM and invoice metrics drill to exact source records with stable filters and visible definitions.
8. All 15-store demo totals reconcile from seeded records; separate one-store and 65-store fixtures pass automated checks.
9. Tenant isolation, state transitions, close gates, taxonomy belonging, invoice allocation and append-only audit behavior have unit/integration coverage.
10. Type checking, lint, unit/integration/end-to-end tests and production build pass, followed by browser inspection of manager, store, internal technician, vendor-action, technician mobile and finance journeys.
