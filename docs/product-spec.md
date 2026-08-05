# Clark's Operations Product Specification

**Version:** Demonstration v1  
**Date:** August 5, 2026  
**Status:** Approved implementation baseline for this repository

## Product thesis

Clark's Operations is a web-first maintenance operations and asset-intelligence platform for convenience-store operators ranging from a single independent location to regional chains. The first pilot is expected to include approximately 65 stores. Its source of truth is the **operator's internal work order**, not the vendor's dispatch job, an employee task, an invoice, or a dashboard summary.

The platform gives Clark's a durable chain from frontline symptom to management decision:

> Report or planned maintenance → internal review → Clark's work order → vendor acceptance → verified visit(s) → accountable follow-up → completion verification → documents and invoices → asset/component history → cost and performance analytics → capital review.

The platform controls Clark's side of that chain while asking independent vendors to change as little as possible about how they run their businesses.

## Customer and tenancy model

The product is a multi-tenant SaaS application. Each customer operator is an isolated **organization** with its own stores, members, roles, work-order numbering, vendors, policies, documents, financial records, controlled names and analytics. Clark's is the seeded pilot organization, not a hardcoded tenant.

Supported operating shapes:

- **Independent store:** one organization and one store; region is absent, and one person may hold owner, facilities and store-manager permissions.
- **Small operator:** several stores with no regional layer; owner/facilities users compare stores directly.
- **Regional operator:** stores grouped into optional regions with regional-manager scope.
- **Pilot / growing chain:** approximately 65 stores with bulk filters, exception queues, saved scope, pagination and controlled taxonomy.

Region is optional. The organization-to-store relationship is always authoritative; a region is a grouping layer, not a required placeholder. The UI removes region controls and peer-store panels when they add no value. Single-store operators receive historical, category, system, asset, PM and vendor comparisons rather than an empty store-ranking experience.

No customer data is used for cross-operator benchmarks by default. Future anonymized benchmarking requires an explicit product/privacy decision and customer consent.

## Demonstration outcomes

The demonstration succeeds when an owner can:

1. Start with company exceptions and drill into Refrigeration, Store 45, Beer Cave Refrigeration, CU-1, and its fan motor.
2. See why Store 45 is an outlier and open the exact work orders and financial records behind each driver.
3. Follow one cashier report through review, Clark's work order creation, vendor acceptance, two verified visits, unresolved follow-up, later asset classification, invoice allocation, completion, and rollup.
4. See actual PM occurrences produce company/store/system compliance and exceptions.
5. Understand why CU-1 is recommended for capital review without seeing an opaque score or automatic replacement claim.
6. Switch roles and demonstrate the cashier, manager, vendor-office, and technician experiences without separate demo credentials.

## Primary users and permissions

| Persona | Default scope | May do | May not do |
|---|---|---|---|
| Owner / Executive | Entire organization | View all operational and financial data; compare; drill down; set watchlist disposition | Alter original reports; act as vendor without switching demo role |
| Facilities Manager | Entire organization | Create/manage/close WOs; issue to vendor; approve; classify; allocate; manage PM, files and follow-ups | Rewrite original report; see outside tenant |
| Regional Manager | Assigned region/stores | See reports immediately; review/escalate; compare stores; monitor overdue work | Delete/hide employee reports; access unrelated regions in production |
| Store Manager | Assigned store | Review reports; append context/photo; confirm/dispute; recommend escalation; verify completion | Delete or rewrite original report; hide it from region/facilities |
| Frontline Employee | Assigned store and own submissions | Submit symptom, area, urgency and photo; see receipt/status | Diagnose assets; edit submitted report; browse company analytics |
| Vendor Office | Its vendor and issued WOs | Open secure link; accept, decline or request clarification; upload allowed files; view allowed history | Assign technicians in Clark's; see other vendors' pricing, internal evaluations or unrelated stores |
| Vendor Technician | Store QR and current session | Select vendor/accepted WO; enter name; check in/out; choose basic outcome | Browse confidential history; manage dispatch; enter invoices; see unrelated work |

The demo role switcher changes presentation scope only and is visibly labeled. Production authorization remains server-enforced.

## Information architecture

### Executive and facilities navigation

- **Command Center:** company exceptions, spend, PM, commitments and drill-down.
- **Work Orders:** operational command table and internal work-order detail.
- **Preventive Maintenance:** compliance, upcoming/due/late/missed occurrences and generated WOs.
- **Stores:** store comparison, store detail and store-system detail.
- **Systems & Assets:** company category explorer, asset and optional component detail.
- **Vendors:** observed provider performance and allowed work history.
- **Files & Invoices:** searchable records, review queues and allocation status.
- **Demo Journeys:** report intake, email outbox, acceptance, QR technician flow and simulation states.

Frontline, vendor-office and technician pages use focused shells rather than the executive navigation.

Navigation adapts to customer size:

- One store: default landing is that store's command view; “Stores” becomes “My Store,” region controls disappear, and company/category metrics remain useful as store-level history.
- Two to nineteen stores: company command center plus direct store comparison.
- Twenty or more stores: region/saved-scope controls, exception-first tables, bulk PM/vendor issuance and paginated store/work-order lists become prominent.
- The 65-store pilot must not require loading every work order into the browser; filtering, sorting, pagination and aggregate calculation are server-side in persistent mode.

## Entity and hierarchy model

### Organizational hierarchy

`Organization → optional Region → Store → optional Area/Zone`

### Maintenance hierarchy

`Service Category → Store System → Asset → optional Component`

### Classification taxonomy

Physical instances remain separate from comparison categories:

- Physical: `Store 45 → Beer Cave Refrigeration → CU-1 → Condenser Fan Motor`
- Classification: `Refrigeration → Condensing Unit → Fan Motor`

This separation allows comparison of unlike physical layouts using controlled types.

### Core records

The domain includes organizations, regions, stores, areas, service categories, system types, store systems, asset classes, assets, component types, components, vendors, people/role assignments, employee reports, review steps, work orders, work-order associations, vendor responses, visits, follow-ups, PM plans, PM occurrences, quotes, authorizations, invoices, credits, cost allocations, documents, communications, demo emails, audit events and token records.

Required cardinalities include:

- Many employee reports may link to one work order.
- A work order may exist without an employee report or originate from PM.
- A work order has one current store and category but optional system/asset/component.
- A work order may have many visits, follow-ups, files, communications and financial events.
- One invoice may allocate to several systems/assets/components; allocation sum cannot exceed invoice total.
- Assets and components inherit related work and allocated cost through explicit associations, not text matching.

## Progressive asset onboarding

Work never waits for inventory completeness. A valid work order may be attached at any of these depths:

1. Store only.
2. Store + category.
3. Store + category + store system.
4. Store + category + system + asset.
5. Store + category + system + asset + component.

Association rules:

- System must belong to the selected store and category.
- Asset must belong to the selected system.
- Component must belong to the selected asset.
- A later reclassification appends an audit event with prior and new IDs, actor, reason and timestamp.
- Historical financial records are reprojected through their current explicit allocation targets; the audit log preserves what changed and when.
- General work retains store/category value. Unknown deeper fields are null, never fake “unassigned asset” instances.

Coverage indicators shown with analytics:

- Percent of WOs categorized to service category.
- Percent mapped to a store system.
- Percent of invoiced spend mapped to an asset.
- Percent mapped to a component.

## Employee report and review lifecycle

Default demo policy is **required store-manager review with immediate regional visibility**. Configurable modes are required review, optional input, notification only, and bypass.

Lifecycle:

1. Employee submits observable symptom, store area, urgency and optional photo.
2. Server creates an immutable report and audit event immediately; UI returns a reference number.
3. Store manager and regional manager can see it; store manager receives a review requirement under the demo policy.
4. Store manager appends confirmation, context, photo/reading and recommendation.
5. Regional or facilities authority approves escalation or records duplicate/no-action/internal handling.
6. Escalation creates or links an internal work order without deleting the report.

Original reporter, timestamp, description, store, area and submitted media are immutable. Reviews and decisions are separate append-only records.

## Internal work-order lifecycle

### Origins

Employee report, manager issue, facilities issue, PM occurrence, inspection, warranty callback, capital replacement, or emergency response.

### Core fields

Number, title, description, origin, store, category, optional system/asset/component, priority, work type, status, accountable party, next required action, due date, escalation destination, vendor, vendor response, requested window, NTE, related reports, visits, follow-ups, files, quotes, invoices, allocations, verification and audit timeline.

### State groups

- **Intake:** draft, pending review, approved.
- **Vendor initiation:** issued, awaiting acceptance, accepted/declined/clarification requested.
- **Service:** visit active, follow-up required, waiting on vendor update/quote/approval/parts, return visit scheduled.
- **Completion:** pending store verification, pending invoice, closed.
- **Exceptions:** reopened, cancelled.

Most transitions are inferred from recorded events. Vendors do not maintain Clark's internal state list.

### Invariant

Every non-terminal unresolved work order must have current accountable party, next action, due date and escalation destination. A command-center exception explicitly identifies any record that violates this invariant.

## Vendor workflow

When Facilities issues a WO:

1. The email service creates a message containing Clark's WO number, store, symptom/summary, priority, requested date, instructions and opaque secure link.
2. Development writes it to the demo outbox; production adapters may send through a configured provider.
3. Vendor office opens the link and may accept, decline or request clarification.
4. The response records identity/email, timestamp, token ID and audit event.
5. Acceptance does not require a technician selection. Vendor dispatch continues in the vendor's own system.

Optional vendor pages show only its issued/accepted WOs, allowed files, invoice state and permission-filtered technical history.

## Technician store-QR workflow

### Arrival

1. Store QR contains a signed opaque token, never a plain store ID.
2. Page lists vendors and accepted Clark's WOs at the token's store.
3. Technician selects vendor/WO, enters name and requests check-in.
4. Browser requests a fresh geolocation reading.
5. Server computes Haversine distance to store and classifies the reading as verified, outside radius, inaccurate or unavailable/denied.
6. Visit stores minimized point/accuracy/distance/time/token/session evidence. There is no continuous tracking.

### Departure

On rescan, the same browser/session sees “Your active visits at this store.” It chooses a visit without re-entering vendor, name, store, WO or arrival data, selects one outcome, and provides a fresh location reading.

Required outcomes and resulting control events:

| Outcome | Internal effect |
|---|---|
| Completed — issue resolved | Pending store/management verification |
| Temporary resolution | Keep open; create follow-up |
| Diagnosed — unresolved | Create Facilities-owned repair-plan follow-up due the same business day |
| Unable to diagnose | Create vendor escalation/alternative-vendor decision |
| No issue found | Require store confirmation before closure |
| Unable to perform service | Create access/authorization/reschedule follow-up |

The technician never has to write a detailed diagnosis. Exception check-in after denied/inaccurate/outside state is possible only after clear warning and remains unverified.

### Demo simulation

A visible “Demo Mode” control may supply inside-geofence, outside-geofence, permission-denied or inaccurate readings and deterministic acceptance/email states. Simulation adapters use the same domain functions and response types as real behavior and never label simulated visits as production verified without the Demo Mode badge.

## Follow-up control

Follow-ups contain owner type and ID, action, due timestamp, escalation destination, status, source event, completion note and audit timestamps.

Rules:

- Unresolved technician outcomes create a follow-up in the same transaction as checkout.
- Open follow-up is overdue when `now > dueAt`; the original due date is immutable after escalation. Rescheduling appends a new due-date event with reason.
- Completing a follow-up must set the WO's next state or create the next follow-up; it cannot silently leave unresolved work with no action.
- Overdue follow-ups generate exception and reminder events and appear in the accountable manager's queue.
- Closing a WO is rejected while any required follow-up remains open or store verification is outstanding.

## Preventive-maintenance lifecycle

A PM plan defines scope, category, selected stores/systems/asset class/assets, frequency, start, early/late window, vendor, required evidence, authorization policy, escalation and active state.

The scheduler materializes occurrences for the horizon. Each occurrence may create a Clark's PM work order and moves among scheduled, due soon, acceptance pending, accepted, completed early/on-time/late, documentation pending, missed, rescheduled, waived-with-reason and not-applicable.

Eligible compliance denominator excludes not-applicable and properly waived occurrences. Numerator contains verified occurrences completed from `dueAt - earlyWindow` through `dueAt + lateWindow`, inclusive. “Completed late” remains visible but does not count on time. The UI displays numerator and denominator alongside the percent.

## Files, communications and financial model

### Files

Accepted classes: quote, service ticket, invoice, credit, proof of work, correspondence, warranty, equipment record, manual and other. File metadata may link to WO, store, system, asset, component, visit, vendor and/or financial record. Blob access is permission-checked; the database stores metadata while a storage adapter stores bytes.

The seeded story includes employee photo, vendor acceptance message, service ticket, proof photo, quote, approval, invoice and allocation evidence.

### Communications

Email, clarification, internal note and vendor communication records are append-only with visibility class: internal, vendor-shared, or store-shared.

### Finance

Financial stages remain distinct: estimate, diagnostic authorization, quote, approved, committed, change authorization, invoice, credit, warranty adjustment and paid amount.

Invoices accept normal vendor PDFs. Internal allocation lines target store/category and optionally system/asset/component with work classification and optional cost category. The system displays allocated total and unallocated balance and rejects allocations exceeding invoice total. Credits are separate negative financial events linked to an invoice.

Dashboards distinguish paid spend, invoices pending review, approved-but-uninvoiced, quotes awaiting approval, potential credits and warranty recovery.

## Dashboard metrics

Every metric is computed from work orders, visits, occurrences, follow-ups, financial events, allocations and assets for the active filters. No summary constants exist separately.

| Metric | Definition |
|---|---|
| Open critical WOs | Non-terminal WOs with critical priority |
| Overdue follow-ups | Open required follow-ups whose due timestamp has passed |
| Missing next action | Non-terminal unresolved WOs missing accountable party, action, due date or escalation |
| Awaiting vendor acceptance | Issued WOs with no accepted/declined response |
| PM compliance | Eligible verified occurrences completed within their allowed windows / eligible occurrences |
| TTM maintenance spend | Posted invoice allocations less posted credits in the trailing 12 months |
| Current vs prior | Calendar-year or selected period totals compared with the immediately preceding equal period |
| Approved not invoiced | Approved/committed authorizations less linked posted invoice amount |
| Invoices awaiting review | Submitted invoices in review state |
| Reactive/planned ratio | Reactive + emergency posted spend / planned PM posted spend |
| Repeat visit count | Visits after the first on a WO, plus repeat WOs for same asset/failure window where classified |
| Verified visit rate | Visits with both accepted check-in and checkout verification / completed visits |
| Documentation completeness | Closed/ready-to-invoice WOs meeting type-specific required file rules |

Metric cards and table counts link to the filtered supporting records.

## Comparative and outlier logic

Supported views include calendar year vs prior year, TTM vs prior TTM, same-store periods, store vs company median, category across stores, asset class across stores, reactive vs planned, emergency rate, PM compliance and repeat-repair rate.

Store cohorts use the same organization, category and similar installed-asset count when at least five peers have sufficient data. Data never crosses organizations. If five peers are unavailable, the UI labels the comparison “organization store median” or suppresses it. A single-store organization substitutes same-store period, system and asset-class comparisons and does not render a meaningless store median.

An outlier flag requires:

- At least $5,000 of TTM posted category spend, and
- Spend per installed category asset at or above 1.75× cohort median or the 90th percentile, and
- At least one visible driver such as a high-cost asset, repeat visits, emergency premium, or missed PM.

Store 45 Refrigeration is seeded at approximately 2.1× its valid peer median. Driver links apply filters; descriptions use “associated with” or “driven in the records by,” not unproven causal language.

## Replacement watchlist

The watchlist is rule based. It displays reasons, inputs, source period and threshold—never a hidden health score.

Possible reasons:

- Age ≥ 80% of expected service life.
- TTM reactive repairs ≥ 40% of estimated replacement cost.
- TTM reactive repairs increased ≥ 35% vs prior TTM with at least $2,500 absolute increase.
- At least three reactive WOs or five verified visits in TTM.
- At least two repeat failures/callbacks.
- PM compliance below 80% for applicable asset/system occurrences.
- Meaningful downtime or expired warranty on a critical asset.

“Capital review recommended” appears when at least three reasons are true and one reason is repair burden, age, or cost trend. The displayed recommendation is narrative assembled from triggered reasons; it never says the asset must be replaced.

Management dispositions: add to capital plan, monitor, defer with required reason, approve replacement, and record replacement complete. Every disposition is audited.

## Vendor accountability

Only observed data is reported: issue-to-accept duration/rate, issue-to-first-verified-visit, verified visits, unresolved outcome rate, return visits, vendor-owned overdue work, documentation completeness, completed-awaiting-invoice, invoice amount, quote-to-invoice variance, repeat issues and PM performance.

The product does not infer dispatch efficiency, en-route time or internal vendor scheduling. Vendor technical-history projection excludes other-vendor pricing, internal notes/evaluations, confidential approvals and unrelated data.

## Deterministic demonstration data

The seed uses fictional identities and reconciled records:

- One organization, three regions and fifteen stores.
- HVAC and Refrigeration categories.
- Four vendors, thirty store systems, forty-eight assets and selected components.
- 128 WOs over approximately twenty-four months with visits, follow-ups, quotes, invoices, credits, allocations and audit events.
- Eight PM plans with materialized occurrences.

Intentional stories include Store 45 Refrigeration outlier; progressive classification of WO `CWO-0245`; first unresolved and later resolved verified visits; a complete document/invoice chain; a missed PM; CU-1 capital-review evidence; and believable vendor differences.

The presentation seed remains intentionally compact for owner storytelling. A separate scale fixture/test represents a 65-store pilot and verifies that list/query boundaries, aggregate services, pagination and tenant scoping do not assume the 15-store demo size.

## Demo scenarios

1. **Company visibility:** Command Center → Refrigeration → Store 45 → Beer Cave system → CU-1 → fan motor.
2. **Work-order lifecycle:** cashier report → reviews → `CWO-0245` → vendor email/acceptance → unresolved visit/follow-up → reclassification → return visit → invoice/allocation → rollups.
3. **PM:** company compliance → missed occurrence → generated PM WO → vendor/visit → affected store/system.
4. **Vendor and technician:** email outbox → secure acceptance → store QR → real/demo geofence states → active visit checkout → follow-up result.

## Explicit non-goals

Payroll, employee scheduling, POS, retail inventory, full accounting/AP, payments, banking, vendor credential management, vendor dispatch or technician roster, native apps, continuous tracking, routes, parts inventory, predictive AI, full email ingestion, production accounting integration, SSO, vendor marketplace, and broad trade coverage. The data model may admit future categories, but the demo UI focuses on HVAC and Refrigeration.

## Product risks and safeguards

- **Incomplete classification:** display coverage and keep claims at the deepest supported level.
- **Vendor adoption:** minimize required steps and support later integration rather than duplicate entry.
- **False location confidence:** show accuracy/distance/evidence type; keep exception path and review.
- **Metric mistrust:** expose formulas, date ranges, numerator/denominator and supporting rows.
- **Capital overreach:** provide rule reasons and management disposition, not automatic decisions.
- **Workflow decay:** surface missing/overdue next actions as first-class exceptions.
