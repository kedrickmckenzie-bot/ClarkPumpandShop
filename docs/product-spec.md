# TraceOps Convenience Suite Product Specification

**Status:** Approved rebuild target
**Updated:** August 15, 2026
**Primary customer:** convenience-retail operators with one to approximately 100 stores
**Showcase tenant:** fictional Northline Fuel & Market, exactly 15 stores and five outside vendors

## Product definition

TraceOps is the operator-owned facilities control system for convenience retail. It connects store issues, preventive maintenance, internal and outside work, vendor service authorizations, observed visits, outcomes, cost evidence, equipment history, provider accountability, and capital planning.

Its core promise is:

> Every service story is visible, every unresolved item has an owner, and every management insight reaches the exact records behind it.

TraceOps is not a contractor dispatch replacement, full accounting/AP suite, POS/back-office system, fuel inventory system, workforce platform, or vendor marketplace.

“TraceOps” is a temporary working label. Product name, suite label, logo, favicon, metadata, email/PDF language, support links, and brand tokens must come from one brand configuration. Routes, database tables, domain concepts, event names, component names, and CSS must remain brand-neutral so a future rename is a configuration and asset change rather than a migration.

## Product outcomes

The platform must help an operator answer, without reconstructing spreadsheets or email:

1. What needs action now, who owns it, and when is it due?
2. Who was at each store, for which authorized work, through which channel, and what happened?
3. Which work, vendors, stores, and equipment are creating repeat cost or delay?
4. What money is authorized, recorded, invoiced, unmatched, or requiring review?
5. Which PM occurrences are due, missed, completed, or excluded—and what is the denominator?
6. Which assets deserve human repair-versus-replace review, and what evidence supports the decision?
7. Which capital replacements are likely in the next one, three, and five years?
8. Which identified value opportunities became confirmed outcomes?

## Product principles

1. **One service story.** The canonical operator work order connects all service evidence.
2. **One accountable next action.** Every unresolved work item shows an owner, action, due time, and escalation.
3. **Minimum viable intake.** A store and plain problem are enough to start.
4. **Progressive depth.** Classification, assets, components, PM, approvals, visits, invoices, and portals are additive.
5. **Vendor adoption is optional.** Secure links and store/QR flows work without an account.
6. **Evidence is not accusation.** Visits, duration, amount differences, and missing documents are review facts.
7. **No invented intelligence.** Recommendations show inputs, rules, coverage, and source records.
8. **Dashboards lead to action.** No principal metric ends at a dead card or decorative chart.
9. **C-store language first.** The interface speaks in store symptoms, systems, and service impacts.
10. **Readable before dense.** Everyday screens are understandable in seconds; depth is available on demand.

## Product boundaries

### In scope

- Organization, optional division, optional region, and store network.
- Store issue reporting and manager review.
- Canonical operator work orders.
- Internal maintenance and outside-vendor fulfillment.
- Direct service authorization and competitive estimate requests.
- Vendor CRM, specialties, aliases, coverage, and preferred relationships.
- Accountless vendor response and optional portal.
- Cross-channel technician check-in/out and visit evidence.
- Outcomes, unresolved follow-up, and store review.
- Work cost, authorization/NTE, optional invoice evidence, and reconciliation.
- Equipment templates, store equipment, components, warranty, and history.
- Preventive maintenance plans, occurrences, and compliance.
- Lifecycle review and capital outlook.
- Spend, store, equipment, provider, PM, visit, and value dashboards.
- Generated, versioned reports and audit history.

### Explicitly out of scope

- General ledger, payments, tax, formal purchasing/receiving, three-way matching, or payment approval.
- POS, pricebook, merchandising, fuel inventory, lottery, or retail inventory.
- Vendor technician route optimization, dispatch board replacement, payroll, timecards, pricebooks, commissions, or sales CRM.
- Vendor marketplace or pay-to-play network.
- Continuous/background location tracking.
- Automatic fraud findings, invoice rejection, or replacement decisions.
- Inferred downtime from ordinary work records.

## Operating hierarchy and maintenance taxonomy

Operating scope and maintenance taxonomy are independent.

```text
Organization
├── optional Division
├── optional Region
└── Store

Service category
└── zero or more organization-defined equipment groups
    └── Equipment asset
        └── optional component tree
```

Examples:

```text
Northline Fuel & Market
└── Central Region
    └── Store 104

Refrigeration
└── Walk-ins
    └── Beer cave condensing unit
        ├── Compressor
        ├── Condenser fan motor
        └── Controls
```

A work order may remain unclassified. The product uses an explicit Unclassified bucket rather than inventing placeholder equipment.

## Users, scopes, and home experiences

The primary navigation remains recognizable across roles, while the landing screen, available data, actions, and labels change materially.

### Executive

Home emphasizes:

- Network spend and service exposure.
- Money requiring review.
- Store outliers.
- Provider performance.
- PM compliance.
- One-, three-, and five-year capital outlook.
- Confirmed value ledger.

Executives receive exact drill-through but not operational create/edit clutter.

### Facilities manager

Home is the portfolio control tower:

- Requests and approvals needing action.
- Vendor responses and proposals due.
- Live and exception visits.
- Stalled work and unresolved outcomes.
- PM exceptions.
- Warranty, repeat-service, cost, and lifecycle opportunities.

### Regional manager

Home is scoped to assigned regions/stores:

- Store comparison.
- Critical and aging work.
- Approvals within authority.
- Onsite providers.
- Spend outliers.
- PM and repeat-service exceptions.

### Store manager

Home becomes the store today view:

- Report issue.
- Requests awaiting review.
- Providers onsite or expected.
- Work awaiting store confirmation.
- Open and recent issues.
- Upcoming PM.
- Store equipment and service history.

The store manager cannot browse companywide financial or vendor data.

### Finance reviewer

Home emphasizes optional safeguards:

- Work cost and authorization basis.
- Linked and unmatched invoice amounts.
- Missing operator WO references.
- Visit and outcome evidence.
- Exceptions requiring human reconciliation.

TraceOps never executes payment.

### Store employee

The store-facing portal prioritizes:

- Report an issue.
- Vendor sign in/out on a trusted store device.
- View the status of requests they are permitted to see.
- Optional visit confirmation when customer policy enables it.

### Internal technician

Mobile view prioritizes assigned work, store/access context, equipment history, check-in/out, instructions, notes/files, outcome, and follow-up.

### Outside vendor and technician

The public secure link or optional portal shows only that vendor's authorized work, relevant store/access details, scoped equipment history, estimates, visits, and outcomes.

## Primary navigation

Use no more than six primary destinations:

1. **Overview**
2. **Work**
3. **Stores**
4. **Equipment**
5. **Vendors**
6. **Spend & planning**

Administration, templates, permissions, imports, integrations, audit, and support are behind Setup.

### Work sections

- Action queue.
- Requests.
- Work orders.
- Visits.
- Estimate requests.

### Equipment sections

- Equipment portfolio.
- Preventive maintenance.
- Capital review.
- Equipment templates for permitted administrators.

### Spend & planning sections

- Spend.
- Store performance.
- Vendor performance.
- Money requiring review.
- Value ledger.
- Optional invoice safeguards.
- Reports.

## Global context and search

Every dashboard displays a context strip with:

- Organization/region/store scope.
- Period.
- Cost basis.
- Taxonomy path when applicable.
- Comparison cohort.
- Classification coverage or Unclassified value where relevant.

Global search is server-side, tenant-scoped, role-scoped, indexed, ordered, and paginated. It searches:

- Store number, name, structured address, and aliases.
- Operator work-order number.
- Request reference.
- Vendor name, specialty, aliases, equipment type, and coverage.
- Equipment name, tag, type, location, manufacturer, model, and serial.
- Vendor ticket and invoice reference where permitted.

Search results group by Stores, Work, Vendors, and Equipment. A manager searching “104”, “Main Street”, or “beer cave” must reach the appropriate record directly.

## Canonical service record

### Immutable request

A service request captures:

- Store.
- Reporter name and optional employee identifier.
- Plain-language problem.
- Priority or impact answers.
- Submitted timestamp.
- Optional photos/files.
- Optional category, equipment, and component.

The source request cannot be deleted by a store manager. Corrections are append-only amendments. Review may mark it duplicate, decline it with reason, or convert it into a canonical work order.

### Operator work order

The operator work order is the customer's canonical service authorization and billing reference. Minimum valid fields:

- Organization.
- Store.
- Problem.
- Priority.
- Work-order number.
- Accountable party.
- Next required action.
- Due timestamp.
- Escalation destination.

Optional fields include category, equipment, component, authorized scope, NTE, assignment, vendor, internal assignee, schedule, documents, external references, and accounting dimensions.

The operator WO number, vendor ticket number, vendor invoice number, and optional external accounting PO remain separate.

### Underlying state machines

The UI must not collapse these into one overloaded status.

Request:

```text
Submitted → In triage → Approved / Declined / Duplicate → Converted
```

Operator work:

```text
Open → Authorized → In progress → Needs follow-up → Resolved → Closed
                         └──────────── Cancelled with reason
```

Assignment/service authorization:

```text
Draft → Issued → Opened → Accepted / Declined / Date proposed / Question
                    → Scheduled → Work reported → Reviewed
```

Visit:

```text
Not started → Checked in → Active → Checked out → Amended
```

Cost evidence:

```text
Estimate → authorization/NTE → entered work cost → invoice link → reconciliation
```

### Derived plain-language state

Every open work order derives one sentence, owner, and deadline from the underlying facts, for example:

- Waiting on regional approval · due in 3 hours.
- Waiting on Summit Refrigeration to accept · due today at 4:00 PM.
- Summit is scheduled for Tuesday at 9:00 AM.
- Technician onsite since 10:18 AM.
- Waiting on parts; vendor update due Friday.
- Work reported fixed; store review due tomorrow.
- Cost entered; invoice is optional and not yet linked.

## Work-order screen

### Fixed header

- Operator WO number.
- Store number/name.
- Plain state sentence.
- Accountable party.
- Next required action.
- Due time and escalation.
- Priority.
- Authorization/NTE.
- Fulfillment type.
- Classification state.
- One contextual primary action.

### Five information tabs

1. **Activity** — immutable timeline across request, approval, issuance, vendor response, visit, outcome, cost, and amendments.
2. **Service** — source request, scope, assignment, bid/proposals, authorization revisions, provider contacts.
3. **Visits** — expected and observed visits, channel, check-in/out, location evidence, approximate onsite duration, outcome, files.
4. **Cost** — estimate, approved amount, NTE, entered work cost, linked invoice amount, unmatched balance, allocation.
5. **Equipment** — classification, asset/component, warranty, related history, PM, and lifecycle evidence.

The page opens Activity by default and keeps the state header visible.

## Assignment and service authorization

Routing begins with exactly three choices:

- Internal maintenance.
- Outside vendor.
- Choose later.

Outside-vendor search covers name, specialty, plain-language aliases, equipment type, region/store coverage, preferred relationship, status, and recent relevant performance.

Issuing outside work creates an immutable, versioned Work Order / Service Authorization containing:

- Operator WO number and billing instruction.
- Store/address/access details.
- Problem and authorized scope.
- Priority and requested timing.
- Equipment context if known.
- NTE/authorization basis if used.
- Attachments.
- Response link and expiry.
- Revision number.

Revisions supersede but never overwrite prior issuance.

The vendor may accept, decline, propose a date, or ask a question without an account. A manual phone/email response is allowed and visibly attributed to the internal recorder.

## Competitive estimate workflow

The user must choose between:

- **Send work to a provider**, which authorizes service and permits visits.
- **Request estimates**, which asks for numbers by a deadline and does not authorize service or allow check-in.

An estimate request stores vendor, requested scope, kind, deadline, channel, status, and proposals. Proposals are immutable revisions with amount, currency, scope, exclusions, lead time, validity, and source document.

Selecting one proposal:

- Marks exactly one request selected.
- Marks competing requests not selected or withdrawn.
- Records the human decision.
- May create or prepare one service assignment under the same operator work order.
- Never creates multiple billable work orders for the same approved scope.

## Visit accountability

QR/mobile web, secure service link, trusted store device, vendor portal, and future app create the same visit entity. A technician may start and end through different channels.

### Check-in

The technician provides:

- Name.
- Vendor/internal team.
- Eligible work order, or “No work order provided / I don't see my work order.”
- Optional vendor ticket number.
- Optional note.
- Point-in-time location consent when policy requests it.

The location observation preserves timestamp, latitude/longitude, accuracy, distance, consent/result, and channel. It is classified as verified, outside policy, low accuracy, unavailable, permission denied, not requested, or trusted store device.

No-WO check-in creates an unmatched visit and review exception. It does not block legitimate service.

### Active visit

Mobile tabs:

- Details.
- Work.
- Conversation.

The technician may add notes, photos, files, reported parts/time, or equipment details. These are optional unless customer policy makes a particular field required for a service category.

### Checkout

Outcome choices include:

- Fixed.
- Temporary repair.
- Diagnosed; waiting on part.
- Needs estimate/approval.
- Return required.
- Unable to complete.
- Unable to reproduce.
- No issue found.
- Inspection/PM complete.
- Other.

Checkout captures an optional second point-in-time location observation. Unresolved outcomes atomically create follow-up with accountable party, next action, due time, and escalation.

Observed onsite duration is approximate presence evidence. It is not certified labor or automatic invoice proof. A reported arrival time is stored separately as an unverified assertion with reporter and reason; verified timestamps are never backdated.

## Store portal and store confirmation

The trusted store portal offers:

- Report an issue.
- Vendor sign in/out.
- Active onsite visits.
- Optional Confirm visit or Review completion when policy enables it.

Store confirmation is flexible and never silently required. If enabled, the store confirms presence/outcome, not invoice validity or technical quality. Failure to confirm creates a visible incomplete-evidence fact rather than blocking closure indefinitely.

## Action queue

The Action queue is not a generic exception list. It groups items by responsibility:

- **Needs you** — the current user/role can act now.
- **Waiting on others** — vendor, store, internal technician, or higher approver owes the next action.
- **Watching** — deadline or condition is approaching.

Examples:

- New request review.
- Approval/NTE decision.
- Vendor has not opened or accepted authorization.
- Estimate due or proposal awaiting selection.
- Missing checkout.
- No-WO/unmatched visit.
- Outside-policy location evidence.
- Unresolved outcome with overdue follow-up.
- PM occurrence overdue.
- Repeat service or warranty opportunity.
- Lifecycle review before service authorization.
- Cost/invoice exception.

Each item shows why it exists, exact source record, owner, next action, due time, and available resolution.

## Overview / control tower

All dashboard elements preserve scope and period through drill-through.

### Facilities view anatomy

1. Context strip.
2. “What needs attention now” grouped queue.
3. Network pulse: recorded work cost, open critical work, active visits, PM compliance.
4. Service pipeline from intake to closed.
5. Money requiring review.
6. Store outliers.
7. Provider response/resolution trends.
8. Recent visit ledger.
9. Capital/PM horizon.

### Executive view anatomy

1. Portfolio outcome summary.
2. Recorded work cost and comparison.
3. Work exposure by stage and criticality.
4. Store and category outliers.
5. Provider performance with coverage.
6. PM compliance and capital outlook.
7. Confirmed value ledger.
8. Exact source table for the selected insight.

## Stores

### Store directory

Search by number, name, address, city, state, ZIP, or alias. Rows/cards show:

- Store number/name and address.
- Region.
- Open critical work.
- Providers onsite.
- Current-period recorded cost.
- PM compliance.
- Attention state.

### Store workspace

Header actions: Report issue, Create work order, Vendor sign in/out, Add equipment.

Tabs:

- Overview.
- Work.
- Visits.
- Equipment.
- Spend.
- Preventive maintenance.

Overview shows open work, onsite/expected providers, 90-day cost, PM compliance, capital horizon, what needs attention, category cost, recent service, and equipment program coverage.

## Vendor CRM and accountability

### Vendor directory

Search by name, specialty, aliases such as plumber, equipment type, coverage, and preferred relationship. Show approved/restricted/inactive state, primary contact, specialties, coverage, open work, response state, and recent service.

### Vendor workspace

Tabs:

- Overview.
- Assigned work.
- Visits.
- Performance.
- Cost.
- Coverage and contacts.
- Documents/compliance when configured.

Transparent measures include:

- Issuance-to-open and issuance-to-accept time.
- Acceptance/decline count.
- Scheduled-date adherence when a date exists.
- Check-in/out evidence coverage.
- First observed visit resolution numerator/denominator.
- Return-visit rate.
- Overdue next actions.
- Documentation completeness.
- Median recorded work cost by comparable service category/cohort.
- PM completion where applicable.

No opaque composite grade is required for V0. Every measure shows denominator, period, cohort, missing-data coverage, and exact work/visit records.

## Equipment templates and store setup

### Organization equipment template

A template defines:

- Service category.
- Optional equipment group.
- Equipment type.
- Plain aliases/symptoms.
- Default expected-life range.
- Optional replacement profile.
- Optional default components.
- Optional default PM plans.
- Required versus optional fields.

Everyday setup hides arbitrary tree mechanics. Administrators see a simple category → equipment type → optional components editor.

### New store workflow

1. **Store details** — number, name, region, address, timezone, manager, geofence policy.
2. **Choose blueprint** — full c-store + fuel, store-only, fuel kiosk, or blank/custom.
3. **Select equipment** — each category shows equipment types with quantity steppers.
4. **Name and locate** — one quick row per created unit; generated default name plus practical name/location such as “Open-air cooler — checkout wall.”
5. **Optional details** — model, serial, install date, warranty, supplier; all skippable.
6. **Review and activate** — summary, exceptions, and vendor/PM coverage.

Components are instantiated from templates but remain optional depth. A vendor may later enrich or correct make/model/serial/part data through an auditable suggestion.

## Equipment portfolio and asset card

Equipment portfolio supports organization → region → store and category → group → type → asset drill-down. It shows counts, recorded cost, repeat work, warranty, PM, and lifecycle review without hiding unclassified records.

Asset card header:

- Stable asset identity and store.
- Practical name/location.
- Category/group/type.
- Status and classification state.
- Manufacturer/model/serial if known.
- Warranty.
- Create work order / scan QR.

Tabs:

- Overview.
- Work history.
- Preventive maintenance.
- Costs.
- Documents and photos.
- Timeline.
- Components when present.

Renaming or reclassifying an asset never silently changes the historical snapshot attached to prior service records.

## Preventive maintenance

Data model:

```text
PM template → plan → asset/store cohort → schedule → occurrence → canonical work order
```

The PM page leads with clickable tiles that immediately filter the table/calendar:

- Upcoming.
- Due.
- Overdue.
- Missed.
- Completed.
- Waived/excluded.
- Follow-up required.

Compliance always shows numerator, denominator, window, and source occurrences. Clicking a tile or chart opens those occurrences and related work orders. Overlapping unresolved occurrences remain visible; the system never silently hides one by generating another.

## Spend visibility

Spend is interactive and supports company, region, store, category, group, equipment type, asset, vendor, and time drill-down.

Cost bases stay distinct:

- Recorded work cost.
- Approved amount/NTE.
- Submitted proposal amount.
- Linked invoice amount.
- Unmatched invoice amount.

The interface never labels a blended number simply “spend.”

Principal views:

- Trend by month.
- Category/group/equipment breakdown.
- Store and region comparison.
- Vendor comparison.
- Repeat and multi-visit work.
- Unclassified cost.
- Exact source work/cost table.

## Money requiring review and invoice safeguards

The financial review queue may include:

- Above authorization/NTE.
- Invoice missing operator WO reference.
- Invoice-to-work suggestion requiring confirmation.
- Amount variance.
- Duplicate invoice reference.
- More visits or less visit evidence than expected.
- Warranty opportunity.
- Proposal or rate outlier.

These are review facts, not fraud or nonpayment decisions. Invoice upload/import is optional. Operations, vendor performance, PM, lifecycle, and capital planning cannot depend on invoice completeness.

Invoice allocation must reconcile without double counting. Suggested matches need human confirmation. TraceOps does not approve or pay invoices.

## Value ledger

Value events have:

- Type.
- Source work/order/visit/invoice/proposal/asset.
- Identified amount or operational measure.
- Evidence and caveat.
- Owner.
- Review state: Identified, Under review, Confirmed, Realized, Rejected.
- Customer-confirmed amount where known.
- Decision and timestamp.

Supported types may include warranty-covered service, duplicate dispatch avoided, invoice overage corrected, selected proposal difference, callback charge prevented, and customer-confirmed administrative avoidance. TraceOps never automatically monetizes PM completion or modelled downtime.

## Lifecycle and capital review

### Inputs

- Asset install/in-service date or age range.
- Expected-life range from replacement profile.
- Current installed replacement benchmark and source date.
- Current repair/proposal amount.
- Related repair count and recorded cost over configurable periods.
- Same-component repeat work.
- Visit outcomes and unresolved follow-up.
- Warranty state.
- PM compliance.
- Criticality/operating impact.
- Vendor-stated replacement lead time or repair warranty when supplied.

### Review threshold

The platform may flag a work authorization for human review when:

```text
repair amount >= max(
  organization/category minimum review dollars,
  current replacement benchmark × dynamic remaining-life share
)
```

The dynamic share declines as expected remaining life declines and may be lowered by repeat related work, but never below the configured dollar floor. The exact rule and inputs are displayed. The flag is an opportunity to review, not a replacement recommendation.

This means:

- A small repair with little expected life left usually does not trigger a capital review.
- A large repair relative to current replacement cost may trigger review even with useful life remaining.
- Repeat related repairs may trigger review earlier.
- Warranty-covered work routes to warranty review instead of capital logic.

### Decision packet

Show:

- Repair now cash amount.
- Replace now installed estimate.
- Extra capital required now.
- Age, expected-life range, and expected replacement window.
- 12-/36-month related work and cost.
- Same-component repeats.
- Warranty and PM.
- Vendor proposal scope/exclusions/lead time.
- What is known, missing, and asserted.
- Prior human decisions.

Do not show an opaque health score, inferred downtime, or “lifetime repairs reached X% so replace.”

### Dynamic replacement benchmark

Assets reference an effective-dated replacement profile rather than copying a price. Approved replacement proposals create a benchmark-update suggestion containing source quote, date, scope, cohort/template, optional size class, and affected asset count. A human may publish, adjust, or reject it.

One accepted quote is allowed as a reference and described plainly. Multiple comparable sources may produce a median and range. Old benchmarks remain in history; outlier quotes never silently update the fleet.

### Capital outlook

Forecast assets by expected replacement window and current benchmark for the next one, three, and five years. Allow scenario changes to timing and benchmark without rewriting source facts. Group by store, region, category, equipment type, and confidence/source recency.

## Reports and records

Dashboards are live interactive tools. Reports are generated handoff records.

A generated report preserves:

- Name and report type.
- Scope.
- Period.
- Cost basis.
- Filters and taxonomy path.
- Classification coverage.
- Generated by/at.
- Version.
- Source query/record references.
- Archived file/object reference.

Regenerating creates a new version; it never silently changes a prior report.

## Visual and interaction system

The current prototype UX and palette are not a design foundation. Replace the operator shell, generic presenter components, color tokens, dashboard cards, forms, tables, navigation, and responsive behavior as one coherent enterprise system.

- Base body text is at least 15–16 px; ordinary labels are at least 12–13 px.
- Use neutral cool-gray canvases, white work surfaces, deep slate navigation, and one restrained cobalt action color.
- Status colors are semantic and consistent: red for critical/overdue, amber for review/waiting, blue for active/informational, green for completed/verified, and gray for neutral/closed.
- Do not use the current teal/coral visual identity, oversized rounded marketing cards, decorative gradients, glass effects, or playful illustration language.
- Use an enterprise density scale: comfortable by default, compact for high-volume tables, never tiny.
- Use cards only for genuine summaries; records belong in strong tables, queues, timelines, and split views.
- Use split-pane interaction for high-frequency triage on desktop and full record pages for consequential decisions.
- Keep column headers, key record identity, filters, and current action visible during long workflows.
- Provide stable sorting, pagination, saved views, bulk selection where a real batch action exists, and keyboard/focus behavior.
- Use one primary action per context and visually subordinate secondary actions.
- Keep contextual tabs visible but limited; use progressive disclosure for infrequent detail.
- Mobile screens retain the same information architecture with one prominent next action near the bottom.
- Charts are restrained, readable, accessible, and connected directly to the source table; avoid decorative charts.
- Essential mobile workflows require no horizontal scrolling.
- Loading, empty, error, permission, stale-data, and partial-data states are designed components, not afterthoughts.

## Demo data contract

The fictional Northline tenant has:

- Exactly 15 stores.
- Three regions with five stores each.
- Exactly five approved outside vendors:
  1. Summit Refrigeration.
  2. Cedar Mechanical.
  3. Forecourt Systems Group.
  4. BrightPath Electrical.
  5. Four Seasons Site Services.
- Two internal maintenance technicians.
- Realistic HVAC/R depth and smaller forecourt, plumbing, foodservice, electrical, exterior, snow, landscaping, and car-wash stories.
- Work at every meaningful service stage.
- Direct service authorization and competitive estimate stories.
- Cross-channel check-in/out.
- No-WO unmatched visit.
- Resolved, temporary, waiting-part, return-required, unable-to-reproduce, and PM outcomes.
- Costs derived from work records.
- Optional invoice matches and unmatched examples.
- PM numerator/denominator examples.
- Lifecycle review, replacement benchmark update, and capital forecast examples.
- Value-ledger items in different review states.

Separate automated fixtures prove one-store and approximately 65-store behavior. The 15-store presentation is never the prospect's real network.

## Release acceptance

A release is not acceptable until:

- Every principal metric/chart/outlier reaches exact source records with preserved context.
- Every non-terminal work order has owner, next action, due time, and escalation.
- A work order can be created with store and problem only.
- Internal, outside, and choose-later routing work.
- Estimate requests cannot create duplicate service authorization.
- Vendor accountless response works.
- QR, secure link, and trusted store device share one visit entity.
- No-WO service creates a reviewable unmatched visit.
- Unresolved checkout creates follow-up atomically.
- Store search works by number and address.
- Store setup supports template quantities then quick naming/location.
- Vendor search works by name, specialty, alias, equipment, and coverage.
- PM tiles filter the exact occurrence list.
- Lifecycle review is transparent and available before work authorization.
- Invoice evidence remains optional.
- Role preview materially changes data, home experience, navigation, and actions.
- Responsive store/vendor flows are readable and complete.
- Tenant scope is enforced before role/location scope.
- Required seed, type, lint, test, E2E, and build checks pass.
