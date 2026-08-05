# Clark's Operations Product Specification

**Version:** Clean rebuild 1.0
**Date:** August 5, 2026
**Status:** Approved product and implementation baseline

## Product definition

Clark's Operations is a multi-tenant, multi-site maintenance intelligence platform for operators ranging from one independent store to regional and national portfolios. It connects portfolio reporting, maintenance execution, maintenance-financial accounting and internal/vendor accountability in one system.

The product is not a lightweight work-order demo and it is not an accounting-system replacement. Its job is to answer, with supporting records:

- What maintenance requires attention now?
- Who owns the next action, when is it due and where does it escalate?
- What has each store, trade, system, asset, vendor and team cost?
- What is requested, approved, committed, accrued, invoiced, credited and paid?
- Which records explain a variance, outlier, repeat failure or budget risk?
- What work should management plan, approve, verify or investigate next?

The operator's work order is the primary maintenance record. Requests, PM occurrences, assignments, visits, follow-ups, documents and financial records connect to that work order rather than creating disconnected narratives.

The main operating chain is:

> Request, inspection or PM -> triage -> work order -> internal and/or vendor assignment -> work and evidence -> unresolved follow-up or completion -> verification -> quote/approval/PO/invoice/credit/payment -> allocation and accrual -> reporting and capital review.

## Product pillars

### Portfolio intelligence

Managers see portfolio condition, exceptions, trends and outliers across stores, trades, equipment, internal teams, vendors and periods. Every value drills to its supporting records.

### Connected maintenance

Requests, reactive work, projects and preventive maintenance share a coherent work-order model. Classification can deepen later without blocking service.

### Maintenance-financial accounting

Budgets, estimates, quotes, approvals, purchase orders, commitments, invoices, credits, allocations, payment status, accruals and GL dimensions form a traceable maintenance subledger.

### Low-friction accountability

Every unresolved item identifies an accountable party, next action, due timestamp and escalation destination. Internal teams and external vendors use the same accountability semantics even when their interaction channels differ.

## Product principles

1. **Manager first.** Default navigation and home views prioritize search, decisions, financial position, exceptions and drill-down.
2. **Source-record truth.** No dashboard has independent summary numbers. All totals are derived from persisted operational and financial facts.
3. **Progressive depth.** A store-level work order is valid. Category, equipment group, asset and component may be added when known.
4. **Canonical meaning, familiar language.** Stable taxonomy concepts support organization-specific labels and aliases.
5. **One work model, multiple fulfillment modes.** Internal, external and blended work remain comparable without forcing identical authentication or dispatch tools.
6. **Financial stages are not synonyms.** Requested, approved, committed, accrued, invoiced, credited and paid amounts remain distinct.
7. **Exceptions remain visible.** Missing ownership, overdue action, unallocated money and incomplete classification are shown rather than hidden.
8. **Every important number is explainable.** Users can see formula, period, filters, classification coverage and underlying records.
9. **Single-store dignity, multi-site scale.** Independent operators receive a complete product without enterprise clutter; a 65-store portfolio remains fast and navigable.
10. **All trades, focused seed.** The platform supports configurable maintenance trades while the demonstration provides its deepest data and workflows for HVAC and Refrigeration.

## Customer and tenancy model

Each customer operator is an isolated **organization** with its own:

- Stores and optional regions.
- Members, teams, roles and scopes.
- Work-order numbering and workflow policies.
- Maintenance taxonomy, aliases and preferred labels.
- Internal service groups and external vendors.
- Equipment, PM templates and checklists.
- Budgets, approval rules, accounting dimensions and external accounting mappings.
- Documents, audit history, saved views and reports.

Clark's is the fictional demonstration organization, never a product assumption.

Supported customer shapes:

| Shape | Expected experience |
|---|---|
| Independent store | No required region; one person may hold owner, manager, finance and maintenance roles; landing view is the store's operating command center. |
| Small operator | Direct store comparison, shared vendors and lightweight central controls without forced regional hierarchy. |
| Regional operator | Optional regions, regional scopes, portfolio comparisons, shared teams/vendors and accounting dimensions. |
| 65-store pilot | Indexed global search, saved scopes, exception queues, server aggregates, stable pagination, bulk setup and import. |

A store belongs directly to its organization. Region is an optional grouping that can change without changing store identity or history. Cross-organization comparison is prohibited by default and requires a future privacy-reviewed opt-in product decision.

## Primary users and permissions

One person may hold multiple roles. Production authorization is server enforced and scope aware.

| Persona | Primary jobs |
|---|---|
| Owner / Executive | Review portfolio risk, financial position, store/vendor/team comparisons, budgets and capital-review evidence. |
| Facilities / Maintenance Leader | Triage work, assign internal or external fulfillment, manage PM, enforce accountability, approve work and inspect performance. |
| Regional Manager | Monitor assigned stores, resolve escalations, compare performance and verify significant work. |
| Store Manager | Submit and review requests, add context, coordinate access, verify completion and see store-level history/cost. |
| Frontline Employee | Submit an observable issue with location, urgency and optional media; see receipt and permitted status. |
| Internal Technician | Work an assigned/team queue, acknowledge, check in, review useful context, record work/evidence/cost and produce a completion or unresolved outcome. |
| Finance / Accounting Reviewer | Manage budget views, approvals, POs, invoice/credit review, allocations, payment status, accruals and GL exports. |
| Vendor Office | Accept, decline or clarify issued work; manage allowed work, quotes, documents, invoices and status through a deep link, optional portal or future API. |
| Vendor Technician | Open assigned work through an allowed mobile link/QR, check in, perform work, add permitted evidence and check out. |
| Organization Administrator | Configure roles, terms, taxonomy, templates, accounting dimensions, integrations and policies. |

Demo role switching is clearly labeled presentation tooling. It does not model production authentication.

## Information architecture

### Manager navigation

- **Portfolio**
  - Overview
  - Stores
  - Spend and financial position
  - Exceptions and outliers
- **Accountability**
  - My actions
  - Internal actions
  - Vendor actions
  - Approvals
  - Follow-ups and verification
- **Work**
  - Requests
  - Work orders
  - Preventive maintenance
  - Calendar and assignment windows
- **Equipment**
  - Equipment groups/systems
  - Assets and components
  - Classification coverage
  - Capital review
- **Financials**
  - Budgets
  - Quotes and approvals
  - Purchase orders and commitments
  - Invoices, credits and allocations
  - Payments and accruals
  - GL exports
- **People and Providers**
  - Internal teams
  - Vendors
  - Observable performance
- **Insights**
  - Saved reports
  - Comparisons
  - Exports
- **Admin**
  - Stores and templates
  - Taxonomy and labels
  - Roles and scopes
  - Workflow and finance settings

Frontline, internal-technician and vendor-technician experiences use focused responsive shells. The vendor portal is optional, not a prerequisite for accountability.

### Adaptive navigation

- A one-store organization lands on that store's command view; region controls and empty store rankings disappear.
- A small operator compares stores directly.
- A larger operator receives region/saved-scope selectors, bulk actions, pagination and exception-first lists.
- The active organization, scope, period and financial basis remain visible when navigating or drilling down.

## Manager-first universal search

A persistent command/search control is available from every manager page. Search is organization scoped and server executed.

Minimum searchable fields:

- Store number, store name, normalized street/city/state/postal address, aliases and legacy/external IDs.
- Work-order number, title and exact reference.
- Asset/equipment code, name, serial number, model and alias.
- Vendor name and external vendor ID.
- Request, PM occurrence, PO, invoice, quote, credit, payment and document reference.

Results group by record type and show identifying context. Example:

> Store #1427 - 2505 Palomar Airport Rd - Carlsbad, CA

Selecting a result opens its primary detail or a clearly labeled filtered list. Search supports exact identifiers, prefixes and forgiving text matching while preserving deterministic ordering and stable pagination. Previous store numbers and aliases resolve to the canonical record. No cross-tenant search index is allowed.

## Organizational and store model

### Organizational hierarchy

`Organization -> optional Region -> Store -> optional Area/Zone`

Each store has:

- Stable internal ID.
- Organization-unique store number.
- Display name.
- Structured and normalized address.
- Time zone, status and operating dates.
- Optional region and local contacts.
- Aliases, prior store numbers and external-system IDs.
- Coordinates only when needed for map or policy-controlled visit verification.
- Store-level policies, accounting mappings and template provenance.

Closing, selling or renumbering a store never destroys its history.

## Physical equipment and taxonomy model

### Physical hierarchy

`Store -> optional Area -> optional Equipment Group/System -> Asset -> optional Component`

Examples:

- `Store 45 -> Sales Floor -> Comfort HVAC -> RTU-3 -> Compressor`
- `Store 45 -> Beer Cave -> Refrigeration Rack -> Condensing Unit CU-1 -> Fan Motor`
- `Store 12 -> Kitchen -> Cooking Equipment -> Oven 2 -> Igniter`

The physical equipment-group concept may be displayed to a customer as **System**, **Equipment Group**, **Cost Center** or another preferred term. It remains semantically distinct from an accounting cost center.

### Canonical taxonomy

Physical instances and comparison concepts are separate:

- Physical instance: the actual equipment at one store.
- Canonical concept: a stable trade, class or component type used for reporting.
- Preferred label: the organization's chosen visible name for a concept.
- Alias: an alternate or legacy term that resolves to the same concept.

For example, “Roof AC,” “Rooftop Unit” and “RTU” may map to canonical equipment class `ROOFTOP_UNIT`. Renaming a label never changes semantic identity or breaks history, templates or reports.

The starter taxonomy covers common maintenance trades, including HVAC, Refrigeration, Electrical, Plumbing, General Building, Foodservice Equipment, Fire/Life Safety, Fuel/Forecourt, Security, Grounds and other organization-defined categories. Organizations can extend it without exposing their terms to other tenants.

Imports may suggest alias or concept matches but require confirmation before merging. Reclassification is effective dated and audited.

### Progressive classification

A work order may be saved at any depth:

1. Store only.
2. Store plus category/trade.
3. Store, category and equipment group/system.
4. Store, category, group/system and asset.
5. Store, category, group/system, asset and component.

“Decide later” is a first-class work-order creation choice for optional classification. The platform never creates fake “Unknown Asset” objects to satisfy relationships. When a deeper node is selected, physical belonging is validated.

Analytics display coverage for each depth and retain explicit unclassified buckets. Reclassification appends prior/new associations, actor, timestamp and reason so historical understanding remains reconstructable.

## Accounting dimensions are separate from physical hierarchy

Maintenance may roll up by both physical and accounting views, but those dimensions are not interchangeable.

Physical rollups include store, area, trade, equipment group/system, asset and component. Accounting dimensions include account/GL code, accounting cost center or department, project, budget line and organization-defined segments.

An oven may be an asset inside a physical “Cooking Equipment” group that the customer labels “Cost Center.” Its expenses may simultaneously allocate to accounting cost center `STORE_OPS`, GL account `REPAIRS_MAINTENANCE` and project `KITCHEN_REFRESH_2027`.

Every dimension has a stable ID, display label, effective dates and optional external-system mapping. Reports group through explicit IDs, never free-text names.

## Core records

The connected domain includes:

- Organizations, regions, stores, areas and store aliases.
- Canonical taxonomy concepts, preferred labels, aliases and mappings.
- Equipment groups/systems, assets, components and meters.
- People, roles, scopes, internal teams and vendors.
- Requests/reports, reviews, inspections and decisions.
- Work orders, assignments, schedules/windows, work logs, visits, checklists and outcomes.
- Follow-ups, verification requirements and escalation events.
- PM plans, rounds, occurrences and generated work orders.
- Budgets, estimates, quotes, approvals, purchase orders, commitments and change authorizations.
- Invoices, credits, warranty recoveries, allocations, payment records and accruals.
- Accounting dimensions, mappings and export batches.
- Files, communications, tokens and append-only audit events.

Important relationships:

- Many requests may link to one work order.
- A work order may exist without a request and may originate from PM, inspection, project or management.
- A work order has one store and progressively optional classification.
- A work order may have multiple sequential or concurrent assignments, but unresolved work has one explicit current accountable party.
- Work may be internal, external or blended.
- A work order may have many visits, logs, outcomes, files, follow-ups and financial records.
- A quote or PO may cover one or more work orders when policy permits.
- An invoice or credit may allocate across multiple work orders, stores, equipment nodes and accounting dimensions.

## Store creation and onboarding

Store setup is a guided, resumable workflow rather than a single shallow modal:

1. **Identity:** store number, name, address, time zone, operating status and optional region.
2. **Contacts and access:** managers, internal teams and escalation destinations.
3. **Terminology and trades:** organization defaults plus any store-specific applicability.
4. **Equipment structure:** create manually, import, copy a template or copy from a similar store; review equipment groups, assets and components.
5. **Preventive maintenance:** apply store opening templates and confirm responsible parties.
6. **Financial setup:** accounting dimensions, budget ownership, approval routing and external mappings.
7. **Vendors and coverage:** preferred providers, service categories, contacts and allowed interaction channel.
8. **Readiness review:** missing recommended setup is visible but does not prevent legitimate reactive work.

The store detail becomes available immediately after identity is saved. Users can leave and resume setup. Imports provide row-level validation, duplicate detection and a downloadable error report. Template application records provenance so later edits do not silently rewrite the store.

## Request and intake workflow

Employees and managers describe observable symptoms rather than being forced to diagnose equipment. A request requires store and description; area, urgency, category and media may be added.

The original submission is immutable. Reviews, clarifications, corrections and triage decisions append separately.

Triage may:

- Create a new work order.
- Link to an existing work order.
- Request clarification.
- Mark duplicate with a referenced source.
- Record no-action or local resolution with reason.
- Escalate immediately under policy.

Visibility and review policy are organization configurable without changing the underlying audit model.

## Work-order creation

The creation workflow is useful for both a quick emergency and detailed planned work.

### Minimum valid record

- Store.
- Problem/title or linked source that supplies it.
- Work type and priority, with sensible defaults.

### Progressive optional context

- Category/trade.
- Area.
- Equipment group/system.
- Asset.
- Component.
- Requested/scheduled window.
- Internal team/person and/or external vendor.
- Estimated/NTE amount, budget and accounting dimensions.
- Checklist, files, related requests, PM or warranty.

Asset selection offers **Decide later** and never blocks submission. Policy may create a classification follow-up with an owner and due date.

The creation flow supports save-and-continue, templates and copy-from-similar work while still creating one canonical work order.

## Work-order detail

A work order must contain enough information for an internal maintenance person or external provider to act without reconstructing the story elsewhere.

The detail view includes:

- Number, status, priority, work type and origin.
- Current accountable party, next action, due time and escalation.
- Store identity, access context and equipment hierarchy.
- Problem statement, request history and permitted prior equipment history.
- Internal/vendor assignments, acknowledgements and scheduled/requested windows.
- Visits, check-in/out, work log, labor, materials, miscellaneous costs and outcomes.
- Checklists, readings, photos, service tickets and other evidence.
- Open follow-ups, blockers and completion verification.
- PM, project, warranty and related-work context.
- Estimate, quote, approval, PO, invoice, credit, payment and allocation chain.
- Communications, files and append-only audit timeline.

Tabs and summary panels may organize this information, but no core workflow should terminate at a non-functional control.

## Work-order lifecycle

Operational status and financial status are orthogonal. A repair can be operationally complete while an invoice remains pending; an approved PO can exist before work begins.

Typical operational states:

- Draft / intake.
- Pending triage or approval.
- Ready to assign.
- Assigned / issued.
- Awaiting acceptance or acknowledgement.
- Planned / scheduled.
- In progress.
- Follow-up required / blocked / waiting on quote, approval, material, access or return visit.
- Work complete, pending verification.
- Verified.
- Closed or cancelled with reason.

Transitions are domain commands backed by events, not arbitrary status edits. Every non-terminal unresolved record has an accountable party, next action, due timestamp and escalation destination. Closing is rejected while required follow-up, evidence or verification remains open. Financial completion may continue after operational closure according to policy.

## Internal execution

Internal maintenance is a first-class fulfillment mode.

An internal technician can:

1. Open a personal or team queue on mobile or desktop.
2. See priority, store, address, access notes, symptom, equipment context, safety instructions, checklist and allowed history.
3. Acknowledge or request clarification.
4. Start travel/work states only when the organization uses them; check-in is policy controlled.
5. Record concise work performed, readings, checklist results, photos, labor time, materials and miscellaneous costs.
6. Choose completed or a structured unresolved outcome.
7. Create or trigger the next required follow-up in the same action.
8. Submit for verification and see permitted return-work context.

Maintenance assignment, requested/scheduled windows, queues and workload visibility are in scope. Payroll, employee shift management, route optimization and continuous location tracking are not.

## External vendor workflow

External vendors use the same work-order and accountability model without being forced to adopt the operator's software as their own dispatch system.

Supported interaction channels:

- Purpose-bound email/deep links for accept, decline or request clarification.
- Optional vendor portal for recurring providers who want a queue and document/financial history.
- Purpose-bound technician mobile link or store QR for permitted check-in/work/checkout.
- Future API/webhook integration for high-volume providers using their own system.
- Authorized manager-recorded phone response, permanently labeled with recorder and channel.

All channels execute the same domain commands and write the same audit events.

Vendor office actions may include acceptance, decline, clarification, proposed timing, quote/proposal, allowed status updates, service documents and invoice submission. The allowed actions depend on policy and work state. Acceptance does not require the vendor to expose or maintain its full technician roster.

Vendor access excludes other vendors' information, internal evaluations/notes, confidential approvals, unrelated stores and financial information outside the vendor's engagement.

## Visits and technician interaction

Internal and vendor visits share visit, evidence and outcome semantics. Authentication differs by actor type.

Where check-in verification is enabled:

- A fresh location reading is requested only at check-in and checkout.
- Accuracy, distance, timestamp, consent/result and verification state are preserved.
- Denied, inaccurate or outside-radius states have a reviewable exception path and remain visibly unverified.
- Continuous tracking is prohibited.

Minimum outcome choices include resolved, temporary resolution, diagnosed/unresolved, unable to diagnose, no issue found and unable to perform work. Organization policy controls which additional fields or checklist evidence are required by trade/work type. An unresolved outcome atomically creates the next follow-up.

## Accountability and exception control

Every non-terminal unresolved work order has:

- Accountable party.
- Next required action.
- Due timestamp.
- Escalation destination.

These fields may be fulfilled by a linked assignment, approval, follow-up, verification or vendor response, but they must be queryable as a common accountability projection.

Manager queues include:

- Needs triage.
- Ready to assign.
- Awaiting internal acknowledgement.
- Awaiting vendor acceptance or clarification.
- Response, arrival or work overdue.
- Quote or approval needed.
- PO or budget exception.
- Unresolved follow-up overdue.
- Work complete, awaiting verification.
- Invoice or allocation exception.
- Accrual or payment-status review.
- Missing classification.

Completing one action must either resolve the work or create/set the next action. Rescheduling requires a reason and preserves the original/missed due date. Counts open directly to the responsible filtered queue.

## Preventive maintenance

A PM plan defines:

- Trade and progressively optional equipment scope.
- Included stores or store template.
- Calendar, meter or seasonal frequency.
- Early/late completion window.
- Internal team and/or vendor fulfillment rule.
- Checklist/evidence and qualification policy.
- Estimated budget, approval/PO behavior and accounting defaults.
- Escalation and active dates.

The scheduler materializes occurrences with stable identity. An occurrence may generate a canonical work order and moves through scheduled, due soon, issued/assigned, accepted/acknowledged, completed early/on-time/late, documentation pending, missed, rescheduled, waived-with-reason or not applicable.

Compliance shows its numerator, denominator and allowed window. Waived and not-applicable occurrences are reported separately. PM cost and completion drill to occurrences, work orders, visits and allocations.

## Maintenance-financial accounting

### Purpose and boundary

Clark's Operations is the operational maintenance subledger: it connects money to work, location, equipment, responsibility and evidence. It does not calculate tax, move money, connect bank accounts, run payroll, manage accounts receivable or replace the customer's general ledger.

All money is stored in integer minor units with currency. The initial demonstration uses one organization base currency; the model retains currency on every financial record.

### Financial chain

`Budget -> estimate/request -> quote -> approval -> purchase order/commitment -> work receipt -> invoice -> credit/warranty recovery -> allocation -> payment status -> GL export`

Accruals represent period-specific recognized maintenance expense that has not yet reached the selected actual basis. They have their own creation, posting and reversal history.

Stages remain distinct. Reports never add overlapping stages without an explicit non-overlap formula.

### Budgets

Budgets support fiscal period and organization-defined dimension combinations such as region, store, trade, accounting cost center, GL account, project or vendor. Budgets have versions, owners, notes, status and append-only revisions.

Views show:

- Original and revised budget.
- Approved actual basis.
- Open commitments.
- Active accruals.
- Forecast according to a visible formula.
- Remaining or over-budget amount.
- Supporting source records.

### Quotes, approvals and purchase orders

Quotes preserve vendor, scope, version, expiration, attachments, line/subtotal/total and linked work. A revised quote does not overwrite a prior version.

Approval policies may consider amount, store, trade, work type, budget, emergency flag and accounting dimensions. Decisions record actor, timestamp, reason and authorized amount. Approval and rejection are immutable decisions; changes use a new decision or change authorization.

Purchase orders include organization-scoped number, vendor, approved amount, currency, status, accounting dimensions, linked work/quote, issued date and external accounting ID. PO revisions and change authorizations remain auditable. A PO represents commitment, not payment.

### Invoices, credits and allocations

Invoices preserve vendor invoice number, dates, amount, currency, files, review state, linked work/PO and duplicate-detection evidence. Credits and warranty recoveries are separate records tied to their sources; they never silently reduce an invoice.

Allocation lines are the financial reporting grain. A line may target:

- Store and work order.
- Trade/category.
- Equipment group/system, asset and component when known.
- Vendor.
- GL account, accounting cost center/department, project and budget line.
- Cost type such as internal labor, vendor labor, materials, travel or miscellaneous.

Allocations must reconcile to the financial record. Unallocated balance remains visible and over-allocation is rejected. Split invoices across stores, assets or accounting dimensions are supported. Rollups use allocation IDs, never description matching.

### Payment tracking

Payment tracking records observed status, amount, date, method label and external payment/reference ID. It supports unpaid, partially paid, paid, disputed, voided and other organization-configured states. It never initiates a bank or card payment.

### Accruals

Accruals may be suggested from accepted work, received service, approved commitments or other configured evidence, but posting requires an accountable rule or user decision. Each accrual records period, amount, source, dimensions, rationale and expected reversal. Invoice matching or period close produces explicit reversal/adjustment events rather than editing history.

### GL dimensions and exports

Organizations configure accounts and additional dimensions with effective dates and external IDs. Export batches contain exact allocation/accrual/payment-status source references, period, mappings, currency, debit/credit representation where required, creation actor and export status.

Re-export and correction use versioned batches or reversal entries. A “sent” flag is not proof of posting; acknowledgement from a future integration is recorded separately. CSV and integration-ready exports are in scope; general-ledger posting logic remains owned by the accounting system.

## Documents and communications

Files may include request photos, quote/proposal, service ticket, inspection/checklist, proof of work, invoice, credit, warranty, PO, manual, equipment record, correspondence and other organization-defined classes.

Metadata links files to permitted stores, work orders, equipment, visits, vendors and financial records. Blobs remain private and are served through permission-checked routes or short-lived URLs.

Communications are append-only and have an audience such as internal, store-shared or vendor-shared. Structured decisions use explicit commands; free-form email text is not silently interpreted as an approval or state transition.

## Portfolio and reporting experience

### Portfolio home

The default manager home answers “what needs attention and why?” It includes:

- Open critical and high-priority work.
- Overdue accountable actions and missing next-action controls.
- Work awaiting internal acknowledgement, vendor acceptance, approval or verification.
- Budget, actual, open commitment, accrual and forecast position with a clearly selected basis.
- Invoices awaiting review, unallocated balance, credits/recoveries and payment exceptions.
- PM due/missed/compliance.
- Stores, trades, equipment and vendors driving exceptions or variance.
- Classification and documentation coverage.

Cards prioritize actionable exceptions over decorative KPIs. Every card, chart segment and count opens a filtered supporting list.

### Drill path

The standard physical drill is:

`Portfolio -> optional region -> store -> trade -> equipment group/system -> asset -> component -> work orders and allocation lines`

Additional dimensions include internal team/person, vendor, work type, financial stage, accounting dimension, PM/reactive, priority and period.

At each physical depth, show:

- Selected financial basis and amount.
- Work-order and visit count.
- Open/unresolved work and accountable actions.
- Median and percentile context where useful.
- PM compliance.
- Classification coverage and explicit unclassified amount/count.
- Links to exact records.

### Financial position language

Avoid ambiguous “spend posture” presentation. Use plain stage labels:

- Budget.
- Approved.
- Open commitments.
- Active accruals.
- Invoiced net of posted credits.
- Paid.
- Forecast, with formula shown.
- Remaining or variance.

The user selects date period, accounting basis and whether credits/warranty recoveries are netted. These choices remain visible through drill-down and export.

### Principal metric definitions

| Metric | Definition |
|---|---|
| Open critical work | Non-terminal work orders with critical priority in active scope. |
| Overdue accountable action | Current required action whose due timestamp has passed. |
| Missing control | Non-terminal unresolved work missing accountable party, action, due time or escalation. |
| Awaiting acknowledgement/acceptance | Assigned internal or issued external work lacking the required response. |
| PM compliance | Eligible occurrences completed within the configured window / eligible occurrences; numerator and denominator shown. |
| Invoiced maintenance cost | Posted invoice allocations less posted credit/warranty allocations for the selected period/basis. |
| Open commitment | Approved/PO allocation not yet relieved by matched invoice allocation. |
| Active accrual | Posted accrual allocation not yet reversed in the selected period. |
| Paid amount | Recorded payment allocations for the selected period; not inferred from invoice status. |
| Unallocated balance | Financial-record total less valid allocations, shown by record and in aggregate. |
| Budget variance | Selected non-overlapping actual/forecast basis less revised budget. |
| Repeat work | Transparently defined repeat visits or work orders for the same classified target/window; coverage shown. |
| Verification rate | Completed work satisfying configured verification evidence / eligible completed work. |

### Comparisons and outliers

Supported comparisons include current vs prior equal period, same-store periods, store vs organization median, trade across stores, equipment class across stores, internal vs external fulfillment, vendor/team observable performance, reactive vs planned work and budget vs actual/forecast.

Cohorts remain inside one organization and state their scope, period and eligibility. Prefer medians and percentiles where skew makes averages misleading. When a one-store organization lacks a peer cohort, substitute same-store period, trade, system and asset comparisons.

Outlier rules show threshold, source period, cohort, coverage and record-level drivers. Wording describes association, not unproven causation.

## Capital review

Capital-review recommendations are transparent management aids, not automatic replacement decisions. Reasons may include age/service-life position, repeated reactive work, maintenance cost relative to replacement estimate, downtime, PM history, warranty, safety/criticality or energy/operating evidence when provided.

Every reason shows input, threshold, period and source records. Management may monitor, defer with reason, add to capital plan, approve replacement or record replacement complete. Decisions are audited and do not erase maintenance history.

## Vendor and internal-team performance

Only observed measures are reported, including:

- Assignment/issue to acknowledgement or acceptance.
- First recorded visit/check-in.
- Completion and unresolved-outcome rates.
- Return visits and callbacks according to visible rules.
- Overdue actions owned by the party.
- Documentation and verification completeness.
- Quote, commitment, invoice, credit and allocation amounts.
- Quote-to-invoice variance.
- PM completion for assigned occurrences.

The platform never infers dispatch efficiency, en-route performance, employee productivity or causation it cannot observe. Comparisons show volume and coverage so small samples are not presented as certainty.

## Deterministic demonstration data

The primary presentation seed is clearly fictional and represents the pilot shape directly:

- One Clark's demonstration organization.
- Exactly 12 story-rich showcase stores with synthetic store numbers, names, structured addresses and optional regions.
- A separate 65-store automated scale fixture proving indexed search, pagination and aggregate behavior without cluttering the presentation demo.
- Organization roles, regional scopes, store managers, finance users, internal maintenance teams and external vendors.
- Configurable all-trades taxonomy, with the deepest and most numerous histories in HVAC and Refrigeration and smaller examples in other common trades.
- Equipment groups/systems, assets and selected components at intentionally mixed classification depth.
- At least 24 months of coherent requests, WOs, assignments, visits, follow-ups, PM occurrences, files and audit events.
- Reconciled budgets, quotes, approvals, POs, invoices, credits, allocations, payment-status records, accrual/reversal events and GL export batches.

Seeded journeys include:

1. Search for a store by number and address, then drill through its work and financial position.
2. Create a store, resume its guided setup, apply templates and add equipment progressively.
3. Create a work order while deferring asset selection, assign it and classify it later with audit history.
4. Complete useful internal-technician work from queue through verification and cost capture.
5. Issue external work through a deep link, optionally continue in the vendor portal and capture a vendor-technician visit.
6. Demonstrate blended internal/vendor responsibility on one work order.
7. Follow PM occurrence through work, evidence, compliance and cost.
8. Follow quote -> approval -> PO -> work -> invoice -> split allocation -> credit -> payment status -> GL export.
9. Show an accrued received service, later invoice match and explicit accrual reversal.
10. Drill a portfolio/store/equipment outlier to exact work orders and financial allocations.

All totals and narratives derive from seeded source records. No independent presentation constants may contradict them. Simulated actions and identities are visibly marked Demo Mode. Separate automated fixtures prove the same application with one organization and one store.

## Non-functional expectations

- Responsive desktop and mobile web experiences for each persona's principal workflow.
- Server-side filtering, search, sorting, aggregates and stable pagination at and beyond 65 stores.
- Organization-first authorization on reads, writes, search, files, exports, jobs and tokens.
- Idempotent and transactional domain commands for money, audit, follow-up and state transitions.
- Accessible keyboard navigation, labels, focus handling and status communication.
- Store-local time presentation with preserved UTC event timestamps and organization fiscal-period rules.
- Clear loading, empty, partial-data, error and permission-denied states.
- Import/export jobs with progress, row-level errors and immutable batch history.

## Explicit non-goals

The clean rebuild does not include:

- Payroll, employee timekeeping administration or shift scheduling.
- Tax calculation, filing or compliance determination.
- Banking, payment execution or card/ACH processing.
- Accounts receivable or customer billing.
- General-ledger replacement or authoritative financial statements.
- POS, retail merchandising or retail inventory.
- Full warehouse purchasing, stock replenishment or route optimization.
- Continuous technician location tracking.
- A vendor marketplace or vendor credentialing network.

Work-order labor/material cost capture, maintenance assignment windows, POs, invoice review, payment-status tracking, accruals and GL exports are explicitly in scope and must not be removed under these exclusions.

## Release quality bar

The rebuild is ready for demonstration only when:

1. The manager can search and drill from a principal metric to source records with no dead end.
2. The 12-store showcase remains easy to navigate, while separate 65-store and one-store fixtures render appropriate navigation and results.
3. Store creation connects to equipment, PM, financial mappings and responsibility setup.
4. Work-order creation permits deferred classification and later audited enrichment.
5. Internal, external and blended workflows reach completion or an accountable unresolved state.
6. Financial stages remain distinct, allocations reconcile, unallocated balances remain visible and GL export traces back to sources.
7. Tenant, role, file, token and vendor-projection boundaries are server enforced.
8. Type checking, lint, unit/integration/end-to-end tests and production build pass.
9. Principal owner/manager, store setup, internal technician, vendor deep-link/portal, finance and mobile journeys are inspected in a browser.
10. The experience feels like one interconnected platform, not a collection of static demo pages.
