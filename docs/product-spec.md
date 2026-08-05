# Maintenance Intelligence Product Specification

**Version:** Clean rebuild 1.0
**Date:** August 5, 2026
**Status:** Approved dashboard-first product and implementation baseline

## Product definition

**Maintenance Intelligence** is a temporary, changeable product label for a multi-tenant maintenance spending and lifecycle intelligence platform serving operators from one independent store to regional portfolios. Its star experience is visual, interactive visibility: managers can move between company, division, region and store scope, then drill through the organization's maintenance taxonomy to the exact work, visit, PM, invoice or asset records behind a number. Clark's is only the fictional pilot/demo tenant and is never the software brand.

The product is not a dispatch system, a heavy CMMS workflow or an accounting-system replacement. Its job is to answer, with supporting records:

- Where is maintenance money going across the company, divisions, regions and stores?
- Which category, equipment group, asset, component or vendor explains an outlier?
- Which assets are becoming expensive relative to their peers, age, warranty and expected life?
- Is preventive maintenance happening on time, and what work and cost sit behind the compliance number?
- Which vendor visits and evidence support the work being reviewed for payment?
- What maintenance requires attention now, who owns the next easy action and when is it due?

The operator's work order is the primary maintenance source record. Requests, PM occurrences, assignments, visits, follow-ups, documents, costs and optional invoice links connect to it rather than creating disconnected narratives. Workflows stay intentionally light because their purpose is to create trustworthy visibility and accountability.

The main evidence chain is:

> Request, inspection or PM -> quick review/approval when required -> work order -> internal and/or vendor assignment -> observed visit and optional evidence -> unresolved follow-up or completion -> cost or invoice link -> dashboards, PM reporting and lifecycle review.

## Product pillars

### Spending intelligence and dashboards

Managers see spend, trends, exceptions and outliers across organization scopes, taxonomy branches, assets, vendors and periods. The same visual dashboard works at company, division, region and store level, and every value drills to supporting records.

### Preventive maintenance and lifecycle

PM plans, occurrences, asset identity, warranty, expected life, repair history, peer comparisons and transparent capital-review rules create a usable lifecycle-management layer. Recommendations expose reasons and thresholds; they are never opaque replacement commands.

### Evidence-based vendor accountability

Email/deep links, optional vendor portal access and low-burden store QR check-in/out capture the facts the operator can observe: response, planned date, visits, approximate onsite time, outcome, notes and optional photos. The platform never claims to observe vendor dispatch or prove labor from elapsed time alone.

### Simple connected maintenance

Requests, reactive work and PM share one coherent work-order model. Classification can deepen later without blocking service. Every unresolved item identifies the next accountable action, while routine interactions remain short enough for store teams and vendors to adopt.

### Reports and records

Dashboards are interactive exploration surfaces. Reports are generated, named snapshots with visible scope, period, basis and source links that can be handed up the management chain or archived as records.

## Product principles

1. **Dashboards are the product star.** Default navigation and home views prioritize visual spending visibility, PM, lifecycle, vendor evidence, search and drill-down.
2. **Source-record truth.** No dashboard has independent summary numbers. All totals are derived from persisted work, PM, visit, cost and optional invoice facts.
3. **Progressive depth.** A store-level work order is valid. Category, equipment group, asset and component may be added when known.
4. **Canonical meaning, familiar language.** Stable taxonomy concepts support organization-specific labels and aliases.
5. **Two independent axes.** Company/division/region/store scope never becomes the equipment taxonomy; users can filter and drill either axis without corrupting the other.
6. **One work model, multiple fulfillment modes.** Internal, external and blended work remain comparable without forcing identical authentication or dispatch tools.
7. **Cost bases are explicit.** Estimated/entered, approved and invoiced amounts remain distinct, and every view states which one it uses.
8. **Exceptions remain visible.** Missing ownership, overdue action, unmatched invoice evidence and incomplete classification are shown rather than hidden.
9. **Every important number is explainable.** Users can see formula, period, filters, classification coverage and underlying records.
10. **Single-store dignity, multi-site scale.** Independent operators receive a complete product without enterprise clutter; the same model remains fast and navigable for a roughly 65-store operator.
11. **All trades, focused seed.** The platform supports configurable maintenance trades while the demonstration provides its deepest data and workflows for HVAC and Refrigeration.

## Customer and tenancy model

Each customer operator is an isolated **organization** with its own:

- Stores and optional divisions/regions used for reporting scope.
- Members, teams, roles and scopes.
- Work-order numbering and workflow policies.
- Maintenance taxonomy, aliases and preferred labels.
- Internal service groups and external vendors.
- Equipment, PM templates and checklists.
- Approval limits, cost-attribution rules and optional invoice/import mappings.
- Documents, audit history, saved views and reports.

Clark's is the fictional demonstration organization, never a product assumption.

Supported customer shapes:

| Shape | Expected experience |
|---|---|
| Independent store | No required division/region; one person may hold owner, manager, AP reviewer and maintenance roles; landing view is the store dashboard. |
| Small operator | Direct store comparison, shared vendors and lightweight central controls without forced regional hierarchy. |
| Regional operator | Optional divisions/regions, scoped dashboards, portfolio comparisons and shared teams/vendors. |
| 65-store pilot | Indexed global search, saved scopes, exception queues, server aggregates, stable pagination, bulk setup and import. |

A store belongs directly to its organization. Region is an optional grouping that can change without changing store identity or history. Cross-organization comparison is prohibited by default and requires a future privacy-reviewed opt-in product decision.

## Primary users and permissions

One person may hold multiple roles. Production authorization is server enforced and scope aware.

| Persona | Primary jobs |
|---|---|
| Owner / Executive | Review portfolio spend, trends, outliers, PM, vendor evidence and lifecycle/capital-review evidence. |
| Facilities / Maintenance Leader | Triage work, assign internal or external fulfillment, manage PM, enforce accountability, approve work and inspect performance. |
| Regional Manager | Monitor assigned stores, resolve escalations, compare performance and verify significant work. |
| Store Manager | Submit and review requests, add context, coordinate access, verify completion and see store-level history/cost. |
| Frontline Employee | Submit an observable issue with location, urgency and optional media; see receipt and permitted status. |
| Internal Technician | Work an assigned/team queue, acknowledge, check in, review useful context, record work/evidence/cost and produce a completion or unresolved outcome. |
| Finance / AP Reviewer | Optionally match uploaded/imported invoices to work orders and visits, review evidence and export or hand off exceptions to the authoritative accounting process. |
| Vendor Office | Accept, decline or clarify issued work; propose timing and add allowed job documents/status through a deep link, optional portal or future API. |
| Vendor Technician | Open assigned work through an allowed mobile link/QR, check in, perform work, add permitted evidence and check out. |
| Organization Administrator | Configure roles, organization scopes, taxonomy, templates, cost/import mappings, integrations and policies. |

Demo role switching is clearly labeled presentation tooling. It does not model production authentication.

## Information architecture

### Manager navigation

1. **Portfolio dashboard** - company/division/region/store spending, trends, outliers and exact record drill-down.
2. **Stores** - universal store search, store dashboards, setup and equipment depth.
3. **PM & lifecycle** - compliance, due/missed work, asset cost outliers and repair-versus-replace evidence.
4. **Vendor accountability** - acceptance, planned arrival, visit evidence, outcomes, return visits and optional portal access.
5. **Reports & records** - generate, hand off and archive management snapshots with their definitions and source links.
6. **Maintenance workspace** - requests, approvals when required, work orders, internal assignments and follow-ups.
7. **Equipment & taxonomy** - company-owned language/tree, store activation, assets, components, warranties and history.
8. **Invoices (optional safeguard)** - upload/import, match to work and visits, review exceptions; never payment execution or an AP replacement.
9. **Administration** - organization scopes, stores/templates, roles, policies, taxonomy, imports and audit.

Frontline, internal-technician and vendor-technician experiences use focused responsive shells. The vendor portal is optional, not a prerequisite for accountability.

### Adaptive navigation

- A one-store organization lands on that store's dashboard; division/region controls and empty store rankings disappear.
- A small operator compares stores directly.
- A larger operator receives division/region/saved-scope selectors, bulk actions, pagination and exception-first lists.
- The active organization scope, taxonomy path, period and cost basis remain visible when navigating or drilling down.

## Manager-first universal search

A persistent command/search control is available from every manager page. Search is organization scoped and server executed.

Minimum searchable fields:

- Store number, store name, normalized street/city/state/postal address, aliases and legacy/external IDs.
- Work-order number, title and exact reference.
- Asset/equipment code, name, serial number, model and alias.
- Vendor name and external vendor ID.
- Request, PM occurrence, invoice and document reference.

Results group by record type and show identifying context. Example:

> Store #1427 - 2505 Palomar Airport Rd - Carlsbad, CA

Selecting a result opens its primary detail or a clearly labeled filtered list. Search supports exact identifiers, prefixes and forgiving text matching while preserving deterministic ordering and stable pagination. Previous store numbers and aliases resolve to the canonical record. No cross-tenant search index is allowed.

## Organizational and store model

### Organizational reporting hierarchy

`Organization/company -> optional Division -> optional Region -> Store`

This scope axis answers **where in the operator** a result belongs. Division and region are optional, can be renamed or changed, and never determine equipment identity. A store retains a direct stable organization relationship even when optional groupings change.

Each store has:

- Stable internal ID.
- Organization-unique store number.
- Display name.
- Structured and normalized address.
- Time zone, status and operating dates.
- Optional division/region scope and local contacts.
- Aliases, prior store numbers and external-system IDs.
- Coordinates only when needed for map or policy-controlled visit verification.
- Store-level policies, cost/import mappings and template provenance.

Closing, selling or renumbering a store never destroys its history.

## Physical equipment and taxonomy model

### Company-owned maintenance taxonomy and store equipment

`Category/department -> zero or more nested grouping concepts -> store asset instance -> optional nested components`

The organization owns the taxonomy language and stable reporting identities so all stores compare cleanly. Branches can be uneven: Refrigeration may use `Refrigeration -> Coolers -> Walk-ins -> Beer Cave`, while Landscaping may stop at `Landscaping`. Each store activates only the branches it uses and creates physical asset instances beneath the relevant path. Optional areas/zones describe where an instance sits but do not replace the company taxonomy.

Examples:

- `Refrigeration -> Coolers -> Walk-ins -> Store 45 Beer Cave -> Condensing Unit CU-1 -> Fan Motor`
- `HVAC -> Rooftop Units -> Store 45 RTU-3 -> Compressor`
- `Landscaping -> Store 12 grounds service` (no deeper asset required)

Any grouping level may be displayed as **System**, **Equipment Group**, **Cost Center**, **Type** or another organization-preferred term. Its stable canonical ID remains intact when the label changes.

### Canonical taxonomy

Physical instances and comparison concepts are separate:

- Physical instance: the actual equipment or maintainable item at one store.
- Canonical concept: a stable category or nested grouping used for company-wide reporting.
- Preferred label: the organization's chosen visible name for a concept.
- Alias: an alternate or legacy term that resolves to the same concept.

For example, “Roof AC,” “Rooftop Unit” and “RTU” may map to canonical equipment class `ROOFTOP_UNIT`. Renaming a label never changes semantic identity or breaks history, templates or reports.

The starter taxonomy covers common maintenance trades, including HVAC, Refrigeration, Electrical, Plumbing, General Building, Foodservice Equipment, Fire/Life Safety, Fuel/Forecourt, Security, Grounds and other organization-defined categories. Organizations can extend it without exposing their terms to other tenants.

Imports may suggest alias or concept matches but require confirmation before merging. Reclassification is effective dated and audited.

### Progressive classification

A work order may be saved at any depth:

1. Store only.
2. Store plus category/department.
3. Store plus any known portion of the nested taxonomy path.
4. Store, taxonomy path and asset.
5. Store, taxonomy path, asset and component depth.

“Decide later” is a first-class work-order creation choice for optional classification. The platform never creates fake “Unknown Asset” objects to satisfy relationships. When a deeper node is selected, physical belonging is validated.

Analytics display coverage for each depth and retain explicit unclassified buckets. Reclassification appends prior/new associations, actor, timestamp and reason so historical understanding remains reconstructable.

## Cost attribution is separate from maintenance taxonomy

Maintenance reporting may use the organization scope axis, the maintenance taxonomy and optional imported accounting references, but those dimensions are not interchangeable.

Maintenance rollups include company/division/region/store, category, any configured grouping depth, asset and component. Optional cost references may include an external account, department, project or invoice code. An oven can remain an asset inside the `Cooking Equipment` taxonomy branch while an imported invoice line carries the customer's accounting reference `REPAIRS_MAINTENANCE`.

Every grouping uses stable IDs and explicit associations, never free-text inference. Maintenance Intelligence may preserve and export external accounting references without becoming the system that owns the chart of accounts or general ledger.

## Core records

The connected domain includes:

- Organizations, optional divisions/regions, stores, areas and store aliases.
- Canonical taxonomy concepts, preferred labels, aliases and mappings.
- Equipment groups/systems, assets, components and meters.
- People, roles, scopes, internal teams and vendors.
- Requests/reports, reviews, inspections and decisions.
- Work orders, assignments, schedules/windows, work logs, visits, checklists and outcomes.
- Follow-ups, verification requirements and escalation events.
- PM plans, rounds, occurrences and generated work orders.
- Cost estimates/lines, quotes or authorization decisions when used.
- Optional invoices, invoice-to-work links, cost attributions and imported accounting references.
- Files, communications, tokens and append-only audit events.

Important relationships:

- Many requests may link to one work order.
- A work order may exist without a request and may originate from PM, inspection, project or management.
- A work order has one store and progressively optional classification.
- A work order may have multiple sequential or concurrent assignments, but unresolved work has one explicit current accountable party.
- Work may be internal, external or blended.
- A work order may have many visits, logs, outcomes, files, follow-ups and cost/invoice records.
- A quote or approval decision may cover one or more work orders when policy permits.
- An optional invoice may link across multiple work orders or cost targets when every attributed amount reconciles without double counting.

## Store creation and onboarding

Store setup is a guided, resumable workflow rather than a single shallow modal:

1. **Identity:** store number, name, address, time zone, operating status and optional division/region.
2. **Contacts and access:** managers, internal teams and escalation destinations.
3. **Taxonomy activation:** choose the applicable branches from the company-owned category and nested grouping tree.
4. **Equipment structure:** create manually, import, copy a template or copy from a similar store; review assets, components and their taxonomy paths.
5. **Preventive maintenance:** apply store opening templates and confirm responsible parties.
6. **Cost visibility:** approval limits, optional invoice-review policy and external reference mappings.
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
- Known nested taxonomy path.
- Asset.
- Component.
- Requested/scheduled window.
- Internal team/person and/or external vendor.
- Estimated/NTE amount, approval context and optional external cost references.
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
- Estimated/approved cost, optional linked-invoice evidence and explicit cost attribution.
- Communications, files and append-only audit timeline.

Tabs and summary panels may organize this information, but no core workflow should terminate at a non-functional control.

## Work-order lifecycle

Operational status and optional invoice-review status are orthogonal. A repair can be operationally complete while an uploaded invoice still awaits matching or review.

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

Transitions are domain commands backed by events, not arbitrary status edits. Every non-terminal unresolved record has an accountable party, next action, due timestamp and escalation destination. Closing is rejected while required follow-up or configured verification remains open. Optional invoice review may continue after operational closure without reopening the maintenance job.

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
- Optional vendor portal for recurring providers who want a job queue, permitted asset/service history and document history.
- Purpose-bound technician mobile link or store QR for permitted check-in/work/checkout.
- Future API/webhook integration for high-volume providers using their own system.
- Authorized manager-recorded phone response, permanently labeled with recorder and channel.

All channels execute the same domain commands and write the same audit events.

Vendor office actions may include acceptance, decline, clarification, proposed timing, quote/proposal, allowed status updates and service documents. The allowed actions depend on policy and work state. Acceptance does not require the vendor to expose or maintain its full technician roster or require every technician to create an account.

Vendor access excludes other vendors' information, internal evaluations/notes, confidential approvals, unrelated stores and financial information outside the vendor's engagement.

## Visits and technician interaction

Internal and vendor visits share visit, evidence and outcome semantics. Authentication differs by actor type.

Where check-in verification is enabled:

- A fresh location reading is requested only at check-in and checkout.
- Accuracy, distance, timestamp, consent/result and verification state are preserved.
- Denied, inaccurate or outside-radius states have a reviewable exception path and remain visibly unverified.
- Continuous tracking is prohibited.

At store QR check-in, the technician enters a name and vendor and selects the operator work order when it is visible. **I don't see my work order / no work order provided** is a supported exception path that creates a reviewable unmatched visit rather than blocking entry. Rescanning shows active visits at that store so the technician can select the visit, add optional notes/photos, choose an outcome and check out. Signatures and photo uploads are never globally required.

Minimum outcome choices include resolved, temporary resolution, diagnosed/waiting on parts, diagnosed/unresolved, unable to diagnose, no issue found and unable to perform work. Organization policy controls which additional evidence is required for exceptional work types. An unresolved outcome atomically creates the next follow-up. Check-in/out creates an approximate observed onsite duration and visit count; it is context for review, not a certified labor-time record.

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
- Approval-limit exception.
- Unresolved follow-up overdue.
- Work complete, awaiting verification.
- Optional invoice/work mismatch.
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
- Estimated cost, approval behavior and cost-attribution defaults.
- Escalation and active dates.

The scheduler materializes occurrences with stable identity. An occurrence may generate a canonical work order and moves through scheduled, due soon, issued/assigned, accepted/acknowledged, completed early/on-time/late, documentation pending, missed, rescheduled, waived-with-reason or not applicable.

Compliance shows its numerator, denominator and allowed window. Waived and not-applicable occurrences are reported separately. PM cost and completion drill to occurrences, work orders, visits and source cost records.

## Asset lifecycle record

An asset can be useful with only a store, taxonomy path and local name. Optional setup can add:

- Asset code/tag, manufacturer, model and serial number.
- Supplier name/contact and purchase/installation dates.
- Purchase cost and current replacement-cost estimate.
- Warranty provider, term, reference, coverage summary and expiration.
- Expected useful life, maintenance strategy, criticality and meter details.
- Photos, manuals, components, PM plans and full work/visit/cost history.

Lifecycle views compare same-class assets inside the organization and show age/service-life position, reactive cost, repeat work, downtime when recorded, PM history, warranty and replacement-cost relationship. Missing data remains visible. Rules show inputs and thresholds and can recommend human review, never automatically order replacement.

## Spending visibility and optional invoice safeguard

### Purpose and boundary

Maintenance Intelligence connects maintenance cost to scope, taxonomy, assets, vendors, work and observable visit evidence. It is a management visibility layer, not an accounting suite, AP automation product, ERP, general ledger or payment system. Customers can use the maintenance dashboards without adopting invoice review at all.

All money is stored in integer minor units with currency. Cost views always name their basis, such as entered work-order cost, approved amount or linked invoice amount. The product never silently combines overlapping bases.

### Cost sources

Supported sources include:

- Work-order estimates and cost lines.
- Quotes and simple approval/NTE decisions when an operator uses them.
- Uploaded or imported vendor invoices.
- Explicit warranty or credit adjustments when supplied by the operator.
- Future accounting/ERP imports through organization-scoped mappings.

Every source retains its reference, vendor, date, amount, currency, file/evidence links and audit history. Dashboards roll up only explicit associations and show unmatched or unclassified amounts rather than guessing from descriptions.

### Optional invoice-to-work review

An operator may upload an invoice and link it to one or more work orders, visits, stores, taxonomy nodes or assets. A review can compare:

- Invoice vendor and amount against the selected work.
- Duplicate invoice number/file evidence.
- Number of observed visits and approximate check-in/out duration.
- Work outcomes, return visits, notes, photos and service documents that were actually captured.
- Classification coverage and any unlinked balance.

The result is an evidence packet and exception list for a human reviewer. Elapsed onsite time is not proof of billed labor, a photo is not proof of repair quality and a mismatch is not an automatic rejection. The product does not approve payment, post to a ledger, calculate tax or move money.

### Attribution and integrations

One invoice may be explicitly attributed across multiple work orders or equipment targets. Attributed amounts must reconcile to the invoice total; unlinked balances remain visible and over-attribution is rejected. Optional external account, department, project or ERP references are preserved as mappings, not owned accounting structures.

Future integrations may import invoice/payment-status references or export evidence packets and cost detail. The customer's accounting system remains authoritative, and the maintenance workflow cannot depend on an integration being present.

## Documents and communications

Files may include request photos, quote/proposal, service ticket, inspection/checklist, proof of work, invoice, warranty, manual, equipment record, correspondence and other organization-defined classes.

Metadata links files to permitted stores, work orders, equipment, visits, vendors and cost/invoice records. Blobs remain private and are served through permission-checked routes or short-lived URLs.

Communications are append-only and have an audience such as internal, store-shared or vendor-shared. Structured decisions use explicit commands; free-form email text is not silently interpreted as an approval or state transition.

## Dashboard and reporting experience

### Interactive spending dashboard

The default manager home answers **where is maintenance money going, what changed and what record explains it?** It is visual-first and includes readable KPI cards, trend charts, category/store/vendor distributions, outlier callouts, PM/lifecycle signals and a source-record table. Charts support direct selection rather than acting as decoration.

Two independent selectors remain visible:

- **Organization scope:** company -> optional division -> optional region -> store.
- **Maintenance classification:** category/department -> any number of nested company taxonomy groups -> asset -> component.

A manager can begin with company refrigeration cost and drill into coolers, freezers and individual assets, or begin at a store dashboard and traverse the same taxonomy. Each step preserves scope, period, cost basis, cohort and classification coverage. Store-only and category-only costs remain in totals through explicit unclassified buckets.

At each depth, show:

- Selected maintenance-cost basis and amount.
- Period trend and prior-period change.
- Work-order and observed visit count.
- Reactive versus planned/PM mix.
- Vendor and internal-fulfillment contribution.
- PM compliance and overdue occurrences.
- Asset age, warranty, expected-life and lifecycle-review signals when the depth supports them.
- Median/percentile peer context where useful.
- Classification coverage and exact supporting records.

### Plain cost language

Avoid ambiguous labels such as “spend posture.” Use only bases the operator can understand and trace:

- **Recorded work cost:** explicit labor/material/vendor cost lines on work records.
- **Approved amount:** quote/NTE/authorization amount when the organization uses approvals.
- **Linked invoice amount:** uploaded/imported invoice value explicitly attributed to work or equipment.
- **Selected maintenance cost:** the non-overlapping rule currently used by the view, with its formula displayed.
- **Unmatched invoice amount:** invoice value not yet tied to supporting work/equipment.
- **Variance:** current value minus the stated comparison value.

The selected basis and period remain visible through drill-down, generated report and export. A customer who does not use invoices still receives complete work-cost, PM, lifecycle and vendor-evidence dashboards.

### Principal metric definitions

| Metric | Definition |
|---|---|
| Selected maintenance cost | Sum of the explicit, non-overlapping source basis named on the view. |
| Reactive cost | Selected maintenance cost tied to reactive work orders in scope. |
| Planned/PM cost | Selected maintenance cost tied to planned work or PM occurrences in scope. |
| Period change | Current selected cost minus the prior equal-period selected cost, with both dates shown. |
| Open critical work | Non-terminal work orders with critical priority in active scope. |
| Overdue accountable action | Current required action whose due timestamp has passed. |
| PM compliance | Eligible occurrences completed within the configured window / eligible occurrences; numerator and denominator shown. |
| Repeat work | Transparently defined repeat visits or work orders for the same classified target/window; coverage shown. |
| Observed onsite duration | Checkout timestamp minus check-in timestamp for an observed visit; not a certified labor record. |
| Evidence coverage | Eligible completed visits with the organization-selected evidence / eligible completed visits. |
| Classification coverage | Selected cost or work classified to the displayed depth / total selected cost or work in scope. |
| Unmatched invoice amount | Uploaded/imported invoice amount lacking explicit supporting work attribution. |

### Comparisons and outliers

Supported comparisons include current versus prior equal period, same-store periods, store versus organization median, taxonomy branch across stores, same-class assets, internal versus external fulfillment, vendor observable performance and reactive versus planned work.

Cohorts remain inside one organization and state their scope, period and eligibility. Prefer medians and percentiles where skew makes averages misleading. When a one-store organization lacks a peer cohort, substitute same-store period, category, grouping and asset comparisons. Outlier rules show threshold, source period, cohort, coverage and record-level drivers. Wording describes association, not unproven causation.

### Generated reports and archived records

Dashboards are for exploration and decision-making. A report is generated from the current dashboard scope and becomes a named snapshot with creator, timestamp, period, cost basis, filters, definitions, narrative notes and source-record links. Reports can be handed to regional leadership, executives or AP reviewers and archived without pretending the snapshot is a live dashboard. Regeneration creates a new version; it does not silently rewrite the handed-off record.

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
- Recorded work cost, linked invoice amount and mismatch exceptions when invoice review is used.
- Quote/approved-to-invoice variance when those optional records exist.
- PM completion for assigned occurrences.

The platform never infers dispatch efficiency, en-route performance, employee productivity or causation it cannot observe. Comparisons show volume and coverage so small samples are not presented as certainty.

## Deterministic demonstration data

The primary presentation seed is clearly fictional and represents the pilot shape directly:

- One Clark's demonstration organization.
- Exactly 12 story-rich showcase stores with synthetic store numbers, names, structured addresses and optional divisions/regions.
- A separate 65-store automated scale fixture proving indexed search, pagination and aggregate behavior without cluttering the presentation demo.
- Organization roles, division/region scopes, store managers, optional AP reviewers, internal maintenance teams and external vendors.
- Configurable all-trades taxonomy, with the deepest and most numerous histories in HVAC and Refrigeration and smaller examples in other common trades.
- Uneven-depth company taxonomy branches, store asset instances and selected components at intentionally mixed classification depth.
- At least 24 months of coherent requests, WOs, assignments, visits, follow-ups, PM occurrences, files and audit events.
- Coherent work-order cost lines, optional quotes/approvals, invoices, invoice-to-work attributions and unmatched invoice exceptions.

Seeded journeys include:

1. Switch the spending dashboard from company to division, region and store scope, then drill through a taxonomy branch to exact cost records.
2. Search for a store by number and address, create a store, activate company taxonomy branches and add equipment progressively.
3. Create a work order while deferring asset selection, assign it and classify it later with audit history.
4. Complete useful internal-technician work from queue through verification and cost capture.
5. Issue external work through a deep link, optionally continue in the vendor portal and capture a vendor-technician visit.
6. Demonstrate blended internal/vendor responsibility on one work order.
7. Follow PM occurrence through work, evidence, compliance and cost.
8. Upload/import an optional invoice, link it to work orders/visits and review evidence without approving or paying it in the platform.
9. Compare same-class assets using age, warranty, repair history, PM and replacement-cost evidence.
10. Generate a management report from a dashboard scope, hand it off and retain an archived version with source links.

All totals and narratives derive from seeded source records. No independent presentation constants may contradict them. Simulated actions and identities are visibly marked Demo Mode. Separate automated fixtures prove the same application with one organization and one store.

## Non-functional expectations

- Responsive desktop and mobile web experiences for each persona's principal workflow.
- Server-side filtering, search, sorting, aggregates and stable pagination at and beyond 65 stores.
- Organization-first authorization on reads, writes, search, files, exports, jobs and tokens.
- Idempotent and transactional domain commands for cost attribution, audit, follow-up and state transitions.
- Accessible keyboard navigation, labels, focus handling and status communication.
- Store-local time presentation with preserved UTC event timestamps and organization reporting-period rules.
- Clear loading, empty, partial-data, error and permission-denied states.
- Import/export jobs with progress, row-level errors and immutable batch history.

## Explicit non-goals

The clean rebuild does not include:

- Payroll, employee timekeeping administration or shift scheduling.
- Full accounting or AP automation, purchase-order administration, accruals or payment-status administration.
- Tax calculation, filing or compliance determination.
- Banking, payment execution or card/ACH processing.
- Accounts receivable or customer billing.
- General-ledger replacement or authoritative financial statements.
- POS, retail merchandising or retail inventory.
- Full warehouse purchasing, stock replenishment or route optimization.
- Continuous technician location tracking.
- A vendor marketplace or vendor credentialing network.

Work-order labor/material/vendor cost capture, approval limits and optional invoice-to-work evidence review remain in scope. They must not be expanded into a general accounting or payment suite without a new product decision.

## Release quality bar

The rebuild is ready for demonstration only when:

1. The manager can search and drill from a principal metric to source records with no dead end.
2. The 12-store showcase remains easy to navigate, while separate 65-store and one-store fixtures render appropriate navigation and results.
3. Store creation connects to company taxonomy activation, equipment, PM, cost visibility and responsibility setup.
4. Work-order creation permits deferred classification and later audited enrichment.
5. Internal, external and blended workflows reach completion or an accountable unresolved state.
6. Cost bases remain distinct; linked invoice attribution reconciles; unmatched amounts remain visible; every dashboard value traces to sources.
7. Tenant, role, file, token and vendor-projection boundaries are server enforced.
8. Type checking, lint, unit/integration/end-to-end tests and production build pass.
9. Principal owner/manager dashboards, store setup, internal technician, vendor deep-link/optional portal, invoice-safeguard and mobile journeys are inspected in a browser.
10. The experience feels like one interconnected platform, not a collection of static demo pages.
