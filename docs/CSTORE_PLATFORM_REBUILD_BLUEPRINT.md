# Convenience Operations Platform Rebuild Blueprint

- **Status:** Product, operating, and technical source of truth for the next rebuild
- **Decision date:** August 10, 2026
- **Working product name:** TraceOps Convenience Suite; intentionally temporary and industry-neutral
- **Audience benchmark:** Compelling and credible to an owner operating approximately 63 convenience stores, without using that owner's real stores or representing the fictional showcase as their company
- **Showcase dataset:** A completely fictional 15-store operator with five fictional vendors and realistic, source-linked operating history
- **Scale validation:** A separate synthetic approximately-65-store fixture used for authorization, search, pagination, aggregate, and performance tests - not the presentation tenant
- **Launch wedge:** Service Visit Accountability
- **Platform direction:** One connected maintenance and facilities platform with optional modules, not a presentation-only demo and not a full accounting system

## 1. Executive decision

The current project is a useful concept prototype, but it is not yet a platform credible to an operator at this caliber. It should not be polished into production. The product must be rebuilt around durable data, real roles and scopes, real external communications, secure public workflows, an auditable evidence model, and an interface that remains useful after the guided story ends.

The platform promise is:

> Know who came to every store, why they came, what they were authorized to do, what happened onsite, what remains unresolved, and which source records support the next decision - without forcing stores or vendors to adopt a complicated new operating system.

The strategic entry point is exactly what the prospective customer requested: vendor accountability. The larger suite is not forced into the initial rollout. It is built on the same records and can be enabled when it earns its place.

The product should be broad underneath and restrained on the surface:

- One canonical service record model.
- One active visit across QR, secure link, store device, and a future app.
- One evidence trail from problem through authorization, visit, outcome, follow-up, cost, PM, and equipment history.
- Role-specific navigation and permissions.
- Optional modules that disappear cleanly when disabled.
- No fake controls, session-only business records, or dashboards disconnected from source data.

The CEO presentation is an acceptance test, not the architecture. If the product only works while its creator narrates a scripted path, it is not ready.

### Showcase-versus-scale rule

The presentation does **not** recreate the prospective customer's 63 stores and does not imply access to their operating data.

- Present a fictional 15-store portfolio with five fictional vendors, three regions, and a small internal maintenance team.
- Make those 15 stores deep enough to demonstrate requests, authorizations, visits, exceptions, costs, PM, equipment history, and capital review without repetitive filler.
- Use generic, changeable product branding and a clearly fictional operator identity.
- State that all names, addresses, people, vendors, work, costs, and performance are demonstration data.
- Prove larger-operator capability through architecture, server-side scope controls, indexed queries, imports, pagination, and automated scale fixtures - not by drawing 63 shallow store cards.
- Keep a separate synthetic approximately-65-store fixture for load, isolation, search, reporting, and performance tests. It should never replace the 15-store presentation tenant.
- Never load the prospect's real stores, vendors, contacts, invoices, or service history without explicit authorization and a real implementation agreement.

The objective is for a 63-store-caliber owner to recognize that the platform understands their world, not to make the demo look like their company.

## 2. Why the opportunity is real

This is a materially important operating problem for convenience retail, not a niche digital-sign-in feature.

- U.S. convenience stores generated $341.2 billion in 2025 in-store sales. Foodservice produced 38.9% of in-store gross profit, and the average store handled 1,484 transactions per day. Equipment uptime now directly protects a major profit engine. [NACS 2025 State of the Industry](https://www.convenience.org/stay-current/news/2026/april/15/u-s-convenience-in-store-sales-top-%24340-billion)
- Repairs and maintenance rose more than 10% in 2024, while foodservice spoilage rose 42% from 2022 through 2024. Direct store operating expenses, including maintenance and utilities, continued rising in 2025. [NACS operating-expense analysis](https://www.convenience.org/stay-current/news/2026/march/24/3-store-operating-expenses_research)
- Refrigeration can account for as much as 40% of a convenience store's energy cost. HVAC and refrigeration maintenance affects operating expense, food safety, merchandise availability, and customer experience at the same time. [NACS Convenience Retail Energy Use Survey](https://www.convenience.org/getContentAsset/f2d83bad-297a-4fab-95f3-7c9742c9247e/54c9dc03-01d8-4d42-9976-9f8115f6bf26/NACS-Energy-Use-Whitepaper.pdf?language=en-US)
- Store workflows must survive high employee turnover and thin staffing. NACS reports employee turnover typically exceeds 100%; the average store had 19.9 employees in 2025. [NACS employee-retention metrics](https://www.convenience.org/stay-current/news/2026/january/30/3-key-metrics-for-c-store-employee-retention_nacs)
- The NACS/Conexxus dispenser-security guide specifically tells retailers to confirm scheduled work and technician identity and maintain a forecourt log with technician, company, time in, time out, and exact equipment serviced. It warns about unscheduled technicians working on dispensers. [NACS/Conexxus dispenser-security guide](https://www.convenience.org/Topics/Skimming-and-Payments-Security/Protecting-Payment-Card-Data-At-Your-Dispensers)

The closest public case is Holiday Oil, a 75-plus-store convenience operator. Before implementing a platform, district managers reviewed emails, a shared service inbox coordinated work, employees called vendors for status, and spreadsheets carried the history. Holiday Oil specifically wanted useful internal data without burdening vendors with fees or difficult workflows. That is unusually close to this prospective customer's current process. The case study is vendor-published, so it is directional evidence rather than a guaranteed outcome. [Ecotrak/Holiday Oil case study](https://www.ecotrak.com/case-studies/case-study/holiday-oil-powers-their-convenience-stores-with-ecotrak)

## 3. Competitive conclusion

QR check-in is already commodity functionality. ServiceChannel, Fexa, Corrigo, Ecotrak, Vixxo, Accruent, MaintainX, UpKeep, Limble, and FMX all cover meaningful parts of work orders, vendors, assets, PM, invoices, or reporting.

| Market pattern | What established products prove | Product implication |
|---|---|---|
| Enterprise multi-site FM | ServiceChannel supports provider apps, IVR, GPS, badge scanning, geofence rules, NTEs, invoices, assets, PM, scorecards, and automation. [ServiceChannel work orders](https://servicechannel.com/products/work-orders/) | More menus or a generic scorecard will not differentiate this platform. |
| C-store asset-first CMMS | Ecotrak markets work orders, vendor management, PM, invoices, equipment history, and repair-versus-replace for convenience operators. [Ecotrak convenience retail](https://www.ecotrak.com/industry/convenience) | C-store language and equipment depth are table stakes for the expansion suite. |
| Configurable orchestration | Fexa supports internal/external work, provider workflows, GPS/IVR/manual check-in, NTEs, invoices, PM, budgets, and analytics. [Fexa work-order management](https://fexa.io/work-order-management/) | Do not expose enterprise workflow complexity to ordinary store and facilities users. |
| Managed-service outcome | Vixxo combines provider operations with geofenced field data and invoice review. [Vixxo technology overview](https://www.vixxo.com/facilities-management-news/how-vixxos-fm-technology-works-vixxoverify-field-tech-ai-and-vixxolink) | Observed presence may inform human review, but it must never be represented as certified labor. |
| Low-friction external work | MaintainX and Limble use share links so outside vendors can interact without a normal account. [MaintainX external work orders](https://help.getmaintainx.com/external-work-orders), [Limble vendor links](https://help.limblecmms.com/en/articles/3610812-how-to-share-a-task-with-a-vendor) | Account-free participation is a proven adoption pattern, not a risky novelty. |

The defensible whitespace is the combination of:

- Account-free vendor participation.
- QR/mobile web, secure work-order link, trusted store device, and future app as equal channels.
- One active visit that can start and end through different channels.
- A supported No work order provided / I do not see it lane.
- One-time location evidence without continuous tracking.
- Honest separation of observed, self-reported, proxy-entered, and later-corrected facts.
- C-store-sensitive service controls for forecourt, payment, fuel, and other high-risk equipment.
- Exception-first executive visibility with exact source-record drill-through.
- A zero-data-debt launch in which a store and problem are enough to begin.
- Optional invoice safeguards rather than mandatory AP participation.

The position is:

> Enterprise-grade service accountability without enterprise-grade participation burden, purpose-built for convenience retail and useful from the first recorded visit.

## 4. Product strategy: land narrowly, build deeply

The platform is one product with capability modules. These are not separate databases or disconnected applications.

### 4.1 Service Visit Accountability - the launch wedge

Answers:

- Who is onsite now?
- Was the visit expected?
- Which store, vendor, technician, and work reason are associated with it?
- What evidence exists for arrival and departure?
- Did the technician leave an outcome?
- Which visit needs manager review?

This module must work with the customer's existing phone and email dispatch process. A work order makes the record stronger but does not become a hard prerequisite for emergency service.

### 4.2 Service Authorization and Maintenance Control

Adds:

- Store issue intake.
- Internal review and optional approval.
- Canonical operator work orders/service authorizations.
- Internal, outside vendor, or choose-later routing.
- Vendor selection and issuance.
- Accept, decline, propose date, and ask-a-question actions.
- Follow-up ownership and escalation.

This replaces scattered status chasing, not the vendor's dispatch system.

### 4.3 Executive Operations and Spend Evidence

Adds:

- Portfolio, region, store, trade, and vendor views.
- Raw vendor operating metrics and exception drill-downs.
- Recorded work costs.
- Optional invoice upload/reference matching.
- Evidence packets and exports for the customer's existing AP process.

It does not approve payment, execute payment, own the general ledger, or claim that a flagged difference is fraud.

### 4.4 Equipment, PM, Lifecycle, and Capital Review

Adds:

- Configurable category and equipment hierarchy.
- Asset/component identity, manufacturer, model, serial, supplier, install date, warranty, replacement estimate, and documents.
- Preventive-maintenance plans, occurrences, evidence, and compliance.
- Repair history and comparable-asset views.
- Transparent capital-review facts and forecast scenarios.

It never invents downtime and never reduces lifecycle management to repair spend divided by replacement cost.

### 4.5 Reports, Records, and Integrations

Adds:

- Generated, versioned management snapshots.
- CSV/PDF exports and scheduled delivery.
- Webhooks and APIs.
- Accounting, store-master, sensor, fuel-system, or vendor-system integrations later.

No core launch workflow depends on these integrations.

### 4.6 The fifteen-move product horizon

The platform should look simple at the first interaction while being designed fifteen moves ahead. These moves are cumulative: the user should never have to re-enter the same fact or migrate to a disconnected module to unlock the next layer.

| Move | Capability unlocked | Strategic effect |
|---|---|---|
| 1 | Frictionless QR, secure-link, or store-device check-in/out | Solves the exact requested problem |
| 2 | Server time, channel, location-result, accuracy, and identity evidence | Turns a sign-in log into a defensible observed-service record |
| 3 | Expected, no-WO, after-hours, and sensitive-service exception handling | Makes unusual activity visible without blocking legitimate emergency work |
| 4 | Canonical operator work order/service authorization | Connects presence to purpose, scope, approval, and billing reference |
| 5 | Searchable vendor CRM, specialties, aliases, coverage, and contacts | Makes vendor selection and onboarding operationally useful |
| 6 | Vendor response, visit outcome, and atomic unresolved follow-up | Replaces status chasing with accountable next action |
| 7 | Live executive and facilities control tower | Shows what changed and what needs attention across the portfolio |
| 8 | Store operating workspace and source-linked history | Creates one operational memory for each location |
| 9 | Transparent vendor performance facts and source drill-through | Supports better vendor conversations without opaque ratings |
| 10 | Recorded work cost and optional invoice evidence | Adds spend visibility without forcing AP replacement |
| 11 | Company taxonomy plus optional asset/component hierarchy | Lets simple work gradually create equipment intelligence |
| 12 | Preventive-maintenance planning, evidence, and compliance | Moves the operator from reactive service toward controlled maintenance |
| 13 | Warranty, repeat-component, lifecycle, and comparable-asset history | Makes repair-versus-replace review evidence-based |
| 14 | Capital-review queue, forecast scenarios, reports, exports, and integrations | Connects field events to executive planning and existing systems |
| 15 | A durable convenience-retail operating memory that identifies recurring store, vendor, trade, and equipment patterns with exact source records | Turns a vendor check-in tool into a compounding decision platform |

The fifteenth move is not an opaque AI score. It is the accumulated, explainable value of the operator's own authorized work, visits, outcomes, PM, costs, assets, and decisions.

### 4.7 The DockSafe-plus quality bar

DockSafe is the internal minimum benchmark for clarity and polish. This platform must exceed it in four dimensions:

1. **Immediate comprehension:** A first-time executive understands the promise and current exceptions within 30 seconds.
2. **Operational depth:** Every primary action creates a real connected record and every visible control completes a useful workflow.
3. **Progressive intelligence:** Simple role-specific home screens lead to store, vendor, work, visit, equipment, and source-record depth without exposing the whole suite at once.
4. **Trust and finish:** Readable typography, calm visual hierarchy, excellent empty/loading/error states, mobile field usability, accessible controls, consistent language, fast responses, and no fabricated confidence.

Outshining DockSafe does not mean putting more content on each screen. It means matching its simplicity at the surface while delivering a substantially deeper, more interconnected operating platform underneath.

## 5. Platform-ready release definition

A platform is ready for this operator only when real people can use it with durable records and real failure recovery. The following are launch requirements, not future polish.

| Area | Required production behavior |
|---|---|
| Tenancy | Durable organization data, real migrations, separate staging/production, backups, restore test, and no session-reset business records |
| Store network | All stores have stable IDs, store numbers, structured addresses, aliases, timezone, region, hours, coordinates, and search by number/name/address/alias |
| Vendor CRM | Approved vendors, contacts, specialties, plain-language aliases, equipment capabilities, coverage, preferred/backup relationships, and active status |
| Identity | Real customer login, MFA for privileged users, server-enforced roles/scopes, and optional account-free vendor actions |
| Requests | Store employee or coordinator can capture a problem quickly; only store and problem are essential |
| Work orders | Canonical operator number, store, priority, problem/scope, owner, next action, due time, attachments, notes, and separate vendor ticket/invoice/external-PO fields |
| Issuance | Versioned service authorization with real delivery, bounce/failure visibility, resend, revoke, print, and audit |
| Vendor response | Secure link supports accept, decline, propose date, and question; phone/email response can be recorded with attribution |
| Visits | QR, secure link, and trusted store device create the same active visit; checkout can occur through another channel |
| No-WO work | Service proceeds through an unmatched visit that enters a visible review queue |
| Evidence | Server timestamp, channel, reported identity, location result/accuracy/distance when enabled, outcome, optional files, and append-only corrections |
| Follow-up | Any unresolved outcome atomically creates owner, next action, due time, and escalation |
| Dashboards | Every total and chart opens exact source work orders/visits; denominators and missing data remain visible |
| Reporting | Operational exports, source-linked reports, data offboarding, and no hardcoded totals |
| Audit | Immutable or amend-only business timeline plus separate technical/security logs |
| Operations | Monitoring, alerting, retries, support console, incident runbooks, and no routine direct database editing |
| Accessibility | Complete primary journeys meet WCAG 2.2 AA, including mobile, keyboard, screen reader, zoom, focus, and non-color status |

The broader suite is only shown in production navigation when the module itself meets this standard. A half-functional lifecycle or invoice area damages trust more than a clearly disabled module.

## 6. The connected operating model

The canonical lifecycle is:

```text
Employee report, call, email, PM, or direct coordinator entry
    -> Request review
    -> Operator work order / service authorization
    -> Internal assignment, outside vendor, or choose later
    -> Vendor issuance and response
    -> One or more visit sessions
    -> Outcome
    -> Required follow-up when unresolved
    -> Recorded cost and optional invoice evidence
    -> Store, vendor, PM, equipment, and executive reporting
```

### 6.1 Request rules

- Original report content is append-only.
- Store, reporter name/employee ID, observable problem, and timestamp are captured.
- Photos, category, equipment, asset, and component are optional.
- The employee reports symptoms, not a forced diagnosis.
- A submitted report can be merged, closed with an auditable reason, escalated, or turned into a work order. It cannot silently disappear.

### 6.2 Work-order rules

- The operator work-order number is immutable and is the customer's service-authorization and billing reference.
- Operator WO, vendor ticket, vendor invoice, and external accounting PO remain separate fields.
- Store and problem are sufficient for creation.
- Classification may deepen later without rewriting original facts.
- Fulfillment is Internal maintenance, Outside vendor, or Choose later.
- Every open item identifies the accountable party, next required action, due time, and escalation path.
- Status changes occur through named domain commands, not arbitrary field edits.
- Optional approval/NTE rules do not burden customers that do not use them.

### 6.3 Vendor issuance rules

- Issue a versioned service authorization by real email, SMS, or print.
- Show store, problem, authorized scope, requested timing, contacts, access notes, NTE when used, and billing-reference instructions.
- Delivery success, bounce, failure, resend, and revocation remain visible.
- Vendor can accept, decline, propose timing, or ask a question without creating an account.
- Manual responses are allowed, but display who entered them and that they came by phone/email.
- Revisions never silently replace the terms the vendor originally received.

### 6.4 Visit rules

One logical visit session can be accessed through:

- Store QR/mobile web.
- Secure work-order link.
- Trusted store device.
- Optional vendor portal.
- Future native app.

A technician can begin through one channel and finish through another.

The check-in flow captures:

- Store context.
- Claimed technician name and vendor.
- Eligible work order or No work order provided / I do not see it.
- Reason for visit when unmatched.
- Server receipt time.
- Channel.
- One-time location result when enabled: coordinates, accuracy radius, derived distance, permission/result, and capture time.
- Optional sensitive-service acknowledgment.

The checkout flow captures:

- Active visit selection.
- Actual checkout action time.
- Outcome: resolved, temporary repair, diagnosed/waiting on parts, return required, unable to complete, no issue found, inspection/PM complete, or organization-defined other.
- Optional notes, photos, documents, parts/reference, and vendor ticket.
- One-time checkout location result when enabled.
- Required next step when not resolved.

Observed onsite duration is approximate presence context. It is not certified labor, payroll time, or automatic invoice proof.

### 6.5 Evidence vocabulary

The UI must distinguish facts rather than hide them behind one green verified badge.

| Evidence fact | Meaning |
|---|---|
| Server-confirmed action | The platform received the action at this time |
| Device-reported action | The device says the user acted at this time; retain separately when offline/retried |
| Location observed within radius | A location result, including accuracy, was within policy radius |
| Location outside radius | The reported point/accuracy did not meet policy |
| Location low accuracy | The result is too imprecise for the selected policy |
| Permission denied | The user declined browser/app location access |
| Location unavailable/timeout | The device or browser could not return a result |
| Trusted store device | An authenticated store device recorded the action |
| Link-bound action | A person holding the purpose-bound vendor link acted; this is not proof of personal identity |
| Reported arrival | Someone later stated an earlier arrival; it is never converted into a verified timestamp |
| Administrative correction | A new amendment corrects association or description without erasing the source event |

W3C describes geolocation accuracy as a confidence radius, not an exact point. The platform must preserve this nuance. [W3C Geolocation](https://www.w3.org/TR/geolocation/)

### 6.6 Sensitive-service policy

Convenience retail creates a useful differentiator for forecourt, POS/payment, UST, networking, and other sensitive work.

When enabled by category/equipment:

- Notify the store that an expected technician is onsite.
- Show vendor, technician, work reason, WO number, and equipment.
- Let the store record Seen onsite or This visit was not expected.
- Preserve the staff action at its actual timestamp.
- Alert the facilities/security queue for unexpected or no-WO sensitive work.
- Produce a forecourt maintenance log containing the fields recommended by NACS/Conexxus.

This remains exception-based. Requiring a cashier to confirm every routine landscaping or refrigeration visit would create avoidable burden.

## 7. Information architecture

The product should not expose every module equally to every role. Effective access is:

```text
permission x organization scope x region/store scope x data class
```

### 7.1 Executive shell

Primary navigation:

1. Overview
2. Stores
3. Vendors
4. Spend and Operations
5. PM and Capital
6. Reports

Home answers:

- What changed?
- What needs attention now?
- Which stores changed most?
- Which vendors need a conversation?
- What remains unsupported or unresolved?
- Which source records explain the result?

The executive shell is read-only by default and does not expose operational forms unless the user also has an operations role.

### 7.2 Facilities shell

Primary navigation:

1. Today
2. Requests
3. Work Orders
4. Visits
5. Vendors
6. Stores
7. Equipment and PM
8. Spend
9. Reports

Today is an exception/action queue, not a decorative dashboard.

### 7.3 Regional shell

- Assigned region is always visible.
- Stores, active visits, requests, work, vendor performance, PM, and spend are limited server-side.
- Drill-down never leaks another region through search, URL, export, attachment, or aggregate.

### 7.4 Store shell

Large type and a very small decision set:

1. Report an issue
2. Vendor sign in or out
3. Who is onsite now
4. Open store issues and work, when permitted

Store employees do not need corporate taxonomy knowledge.

### 7.5 Vendor office shell

Optional account or account-free job link:

- Review issued work.
- Accept, decline, propose date, or ask a question.
- See only that vendor's permitted jobs, visits, and relevant asset history.
- Add vendor ticket/reference and documents.
- Never see another vendor's pricing, unrelated jobs, or internal notes.

### 7.6 Technician shell

A mobile-first task, not a miniature desktop application:

- Confirm store.
- Identify vendor and technician.
- Select eligible WO or no-WO lane.
- Check in.
- See only the context needed to perform work.
- Add optional evidence.
- Select outcome and check out.

### 7.7 Finance-review shell

Optional and clearly bounded:

- Search work orders, visits, recorded costs, and uploaded invoice references.
- Review differences and evidence.
- Export/handoff to the authoritative AP system.
- No payment execution and no automatic rejection.

### 7.8 Platform support shell

No tenant content by default. Time-limited, consented, auditable support access when needed. Support tools cover delivery retries, QR rotation, stale-visit amendment, import errors, failed uploads, account suspension, and data export. Routine support never requires direct database editing.

## 8. Principal product surfaces

### 8.1 Executive Control Tower

Above the fold:

- Onsite now.
- Needs attention.
- Visits recorded this period.
- WO-linked rate.
- Closed-with-outcome rate.
- No-WO visits.
- Open follow-ups.
- Region/store comparison.

Every tile is a button opening the exact filtered records. The page prefers exception and trend information over generic totals.

### 8.2 Live Visits

Shows:

- Technician/vendor.
- Store and work reason.
- Check-in time and channel.
- Location evidence state.
- Expected/no-WO/sensitive status.
- Elapsed observed time.
- Manager action when stale or mismatched.

Supports list and map views without implying continuous movement.

### 8.3 Needs Review

Default exception types:

- No checkout.
- No work order.
- Assigned-vendor mismatch.
- Unknown/unapproved vendor.
- Outside-radius/low-accuracy/unavailable location.
- Unexpected after-hours visit.
- Unexpected sensitive-service work.
- Duplicate/overlapping visit.
- Missed proposed arrival.
- Vendor declined or has not responded.
- Waiting on parts with no owner/date.
- Unresolved checkout without follow-up.
- Multiple visits on the same WO.
- Possible repeat issue at the same asset/component.
- Administrative evidence correction.
- Later: invoice without matching WO/visit, amount above authorization, overdue PM, expiring credential.

Use Needs review, not Fraud, Invalid, or Theft.

### 8.4 Store Directory and Store Workspace

Search by store number, name, address, city, alias, or external ID. A store workspace opens to:

- Current state and onsite visits.
- Requests/open work.
- Recent visit timeline.
- Vendor activity.
- Recorded cost/trend.
- PM/equipment when enabled.
- Store configuration, access instructions, QR, and contacts for permitted administrators.

Organization scope and maintenance taxonomy remain independent so a manager can move company -> region -> store and separately trade -> equipment group -> asset -> component.

### 8.5 Vendor Directory and Vendor Workspace

Search by:

- Legal/display name.
- Specialty and plain-language aliases such as plumber or beer cave.
- Equipment type.
- Store/region coverage.
- Approved/preferred/backup status.

Vendor detail shows contact roles, coverage, issued work, response history, visit outcomes, return visits, open follow-ups, exceptions, and documents/credentials if enabled. Use raw measures and record counts instead of an opaque accountability score.

### 8.6 Request and Work Control

The facilities user can:

- Review immutable employee reports.
- Create a work order without choosing an asset.
- Select internal maintenance, outside vendor, or choose later.
- Search vendors and see why a result is relevant.
- Review/issue the external authorization.
- See vendor delivery/response.
- Follow every visit, outcome, cost, file, correction, and next action in one timeline.

### 8.7 External Service Authorization

This is a server-loaded, token-bound record, not an editable query-string mockup. It includes:

- Operator WO number and version.
- Customer/store and contacts.
- Problem and authorized scope.
- Requested window.
- NTE/approval only when used.
- Access and safety notes.
- Billing instruction.
- Attachments permitted for that vendor.
- Accept, decline, propose date, and ask a question.
- Revoked, expired, superseded, or already-answered states.

### 8.8 Equipment, PM, and Capital Review

Flexible hierarchy:

```text
Category
  -> zero or more organization-defined groups
      -> optional store asset/service instance
          -> optional component tree
```

Branches may be uneven. Refrigeration can be deep; landscaping can stop at the category. Company-owned labels and aliases keep store language consistent.

Asset record:

- Store, category/path, local name/tag, area.
- Manufacturer, model, serial.
- Supplier, install/purchase date and cost.
- Warranty provider/reference/end date.
- Expected-life range and replacement estimate.
- Refrigerant or specialized fields by asset class.
- Linked PM, work orders, visits, components, documents, and recorded costs.

Capital review exposes:

- Age and expected-life range.
- 12/24/36-month work count and recorded cost.
- Component-level repeats.
- Return visits.
- Warranty and PM history.
- Replacement/installation estimate.
- Comparable assets/cohort.
- The exact transparent reason the record was flagged.

It does not infer downtime. It does not tell the operator to replace an asset automatically.

## 9. Executive metrics and definitions

Do not launch an opaque vendor accountability score. Show the raw measure, numerator, denominator, time period, exclusions, and supporting records.

| Metric | Definition |
|---|---|
| Recorded visits | Visit sessions started in the selected period |
| WO-linked rate | Linked visits divided by all recorded visits |
| No-WO visits | Visits explicitly created without an eligible operator WO |
| Location evidence mix | Within radius, outside radius, low accuracy, denied, unavailable, or not required - shown separately |
| Closed-visit rate | Visits with a checkout event divided by eligible visits |
| Outcome capture | Checked-out visits with an outcome divided by checked-out visits |
| Response time | Work-order issuance to first vendor response or first observed arrival, labeled separately |
| Schedule reliability | Arrivals in the agreed window divided by visits with a comparable schedule |
| First-visit resolution | Work orders resolved on the first visit divided by WOs with a known resolved/unresolved outcome |
| Return-visit rate | Work orders with more than one visit divided by eligible WOs |
| Observed onsite duration | Median and P90 check-in-to-checkout elapsed time; explicitly approximate |
| Exception backlog | Open exceptions, age bands, and oldest open item |
| Vendor work mix | WOs/visits by vendor, store, trade, and period |
| PM compliance | Completed within policy window divided by due occurrences, with waived/missed shown separately |
| Recorded maintenance cost | Explicit cost lines recorded against work; never silently mixed with approved or invoice values |

All time calculations use the store timezone for operational display and UTC for storage. Device clocks never replace server receipt time.

## 10. Data model and invariants

### 10.1 Core entities

- Organization, division, region, store, store alias, store area.
- Person, membership, role, permission, scope grant, data-class grant.
- Vendor relationship, contact, specialty, alias, equipment capability, coverage, preferred relationship, credential.
- Service request and append-only review.
- Work order, classification event, assignment, issuance revision, vendor response.
- Visit session, visit event, identity assertion, location observation, outcome, follow-up.
- File/document and scoped entity link.
- Cost line, optional proposal/authorization, optional invoice reference/link/allocation.
- Taxonomy concept/label/alias, store activation, asset, component, warranty.
- PM plan, target, occurrence, waiver/reschedule event.
- Audit event, outbox message, delivery attempt, integration event, idempotency key.

### 10.2 Non-negotiable invariants

- Every tenant-owned query, write, search, export, file, and job starts with `organization_id`.
- Role/scope checks occur server-side; filtered client data is not authorization.
- Work orders are valid with a store and problem only.
- Original requests, issued authorization versions, visit evidence, and audit events are never silently overwritten.
- An unresolved non-terminal work order always has an owner, next action, due time, and escalation.
- A visit can exist without a work order but cannot disappear from review.
- One active visit has one stable ID independent of the channel used.
- Check-in/out retries are idempotent.
- Confirmed server timestamps cannot be backdated.
- Recorded, approved, invoiced, allocated, and paid amounts remain separate concepts.
- Invoice entry is never required for visit, PM, lifecycle, or vendor accountability.
- Every metric is computed from persisted source records and returns a supporting-record filter.
- Money uses integer minor units and explicit currency.
- Reorganizations and vendor-name changes do not rewrite historical identity.

## 11. Production architecture

### 11.1 Application shape

Use a modular TypeScript monolith for the first production system. A work-order transition often updates assignment, visit/follow-up, notification, and audit state together; one transactional boundary is safer than premature microservices.

Recommended production components:

- React/Next-compatible web application.
- TypeScript domain modules with Zod boundary validation.
- PostgreSQL on the eventual Render production environment.
- S3-compatible private object storage.
- Background worker and transactional outbox for email/SMS/webhooks.
- Real email provider and optional SMS provider with delivery events.
- OIDC/SAML-ready operator authentication; MFA/passkeys for privileged users.
- Purpose-bound, cryptographically random, expiring, revocable public tokens hashed at rest.
- Central logging, metrics, tracing/error monitoring, and uptime checks.

The current Sites/D1/R2 environment may remain a preview adapter while the product is rebuilt, but it must not dictate the production domain model. External vendor workflows cannot depend on ChatGPT-host authentication.

### 11.2 Route and module boundaries

Suggested product routes:

```text
/app/overview
/app/action-center
/app/stores
/app/stores/:storeId
/app/requests
/app/work-orders
/app/work-orders/:workOrderId
/app/visits
/app/vendors
/app/vendors/:vendorId
/app/equipment
/app/pm
/app/spend
/app/reports
/app/admin

/public/service/:token
/public/store/:token/visit
/public/store/:token/report
/public/visit/:token
```

Public routes resolve a token on the server and load only the authorized projection. They never accept displayable work-order contents from query parameters.

### 11.3 Repository and command contract

- UI, public links, imports, support console, and future API call the same domain commands.
- Repository methods require non-optional organization context.
- Lists require stable pagination and bounded page size.
- Aggregates run in SQL, not by loading the tenant into the browser.
- Domain mutation, business audit event, and outbox record commit atomically.
- External retries use idempotency keys.
- Attachments use opaque server keys and permission-checked downloads.

### 11.4 Reliability targets

Initial targets, to be validated before contractual promises:

- 99.9% monthly availability for check-in/out and core work-order workflows.
- Core API p95 under two seconds, excluding geolocation acquisition and large uploads.
- Recovery point objective no worse than 15 minutes.
- Recovery time objective no worse than four hours.
- Restore test before launch and quarterly thereafter.
- Load test at five to ten times expected peak concurrency, not merely 63 simultaneous users.

### 11.5 Security gates

- Cross-tenant negative tests for every read/write/search/export/file/token path.
- Object-level authorization on every detail and mutation endpoint. OWASP lists broken object-level authorization as the leading API risk. [OWASP API Security](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- MFA/passkeys for administrators.
- CSRF protection, session hardening, rate limits, abuse detection, and token rotation/revocation.
- Managed secrets with no production fallback in source.
- Encryption in transit and at rest.
- File allow-list, size limit, actual-content inspection, generated server filename, malware quarantine/scan, and private storage. [OWASP file-upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- Dependency, secret, static, dynamic, and authorization scans.
- OWASP ASVS review and NIST SSDF-aligned release process. [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/), [NIST SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
- No precise location, token, attachment content, or unnecessary PII in technical logs.

### 11.6 Privacy gates

- Collect location only when the person presses check in or check out.
- Explain purpose in plain language before permission.
- Preserve permission/result/accuracy rather than coercing a green result.
- Do not send technician identity or precise location to advertising analytics.
- Establish tenant-approved retention and restricted access for precise location.
- Support export and correction by amendment.
- Have privacy counsel review customer terms and location policy before production use.

### 11.7 Accessibility gates

Primary workflows conform to WCAG 2.2 AA. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

- Readable default type; no tiny labels.
- 44-48 px preferred field touch targets.
- 200% zoom and 320 px viewport support.
- Keyboard-only and visible, unobscured focus.
- VoiceOver, TalkBack, and NVDA testing.
- Text/icon status, not color alone.
- Plain-language errors with recovery.
- Alternatives when camera, location, upload, or device capability fails.
- No repeated entry of information already supplied.

## 12. Field resilience and edge cases

The production workflow must explicitly support:

- Location permission denied, timeout, unavailable, or low accuracy.
- Wrong or outdated store coordinates.
- Neighboring stores or a technician between sites.
- Weak cellular service and explicit foreground retry.
- Old browser or device limitations.
- Damaged, copied, replaced, or revoked QR.
- Wrong-store QR.
- Technician cannot find the work order.
- No work order exists.
- Email/SMS failure or bounce.
- Device dies between check-in and checkout.
- Checkout on a different device/channel.
- Duplicate tap/network retry.
- Concurrent store/vendor action.
- Technician leaves without checkout.
- File upload fails after outcome entry.
- Vendor response changes through a later phone call.
- Store closure, ownership change, or region reorganization.
- Vendor suspension, merger, or renamed business.
- Timezone, daylight-saving, and incorrect device clock.

The UI must never show false success. Public actions use explicit receipt states:

- Not submitted.
- Saved locally, not confirmed.
- Sending.
- Confirmed with receipt ID.
- Failed; tap to retry.

Do not rely on browser Background Sync as the only recovery mechanism because support is inconsistent. Use an explicit foreground retry queue; background sync is only an enhancement. [MDN Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)

An abandoned visit creates an exception. The system never invents a checkout time. Staff or support can close it only with actor, actual correction time, reason, and an amendment to the original visit.

## 13. Onboarding and administration

### 13.1 Store import

Provide an audited, idempotent CSV import with a dry run, row-level errors, and downloadable correction file.

Required store preparation:

- Stable external ID and store number.
- Name and structured address.
- Region/division.
- Timezone and service hours.
- Coordinates and proposed geofence radius.
- Search aliases.
- Contacts.
- Active/opening/closing state.

Flag duplicates, ambiguous geocodes, missing regions, conflicting store numbers, unsupported timezones, and invalid coordinates. Re-running an import updates/skips safely rather than duplicating stores.

### 13.2 Vendor import and onboarding

Import legal/display name, dispatch/billing contacts, specialties/aliases, equipment types, store/region coverage, preferred/backup status, approval status, and optional credentials.

Vendors are not required to register. Each receives:

- A one-page explanation.
- A test service authorization.
- A test check-in/out.
- Support contact.
- Clear location notice when enabled.

Test with a large dispatch organization, a small owner/operator vendor, and an unfamiliar field technician.

### 13.3 Store deployment kit

- Store-specific rotatable QR code using an opaque token.
- Printed fallback URL/short code.
- Store number/address visible on the sign.
- Simple Report issue / Vendor sign-in / Current visits instructions.
- Trusted store-device entry point.
- Ten-minute shift training.
- Failure-mode card for location denial, weak signal, damaged QR, and missed checkout.

### 13.4 Support console

Support must be able to:

- Inspect tenant/service health without casually opening business content.
- See failed communication and retry state.
- Inspect import errors and background-job failures.
- Reissue/revoke public links and rotate QR codes.
- Resend/print an authorization.
- Amend an abandoned visit with reason and attribution.
- Correct vendor/store association by amendment.
- Retry failed uploads/communications.
- Suspend a user/vendor.
- Export customer data.

No support action silently rewrites source evidence.

## 14. Current repository assessment

The present codebase should be treated as a product-learning repository, not the production foundation.

### 14.1 Confirmed systemic problems

- The primary application is a 4,600-plus-line client component holding most business collections in React `useState`, initialized from static demo data. A refresh resets the operating history.
- Three competing data families coexist: `lib/cstore`, `lib/demo`, and `lib/platform`, with different types, stories, and consumers.
- Old and new application surfaces coexist in dozens of large components. The repository contains multiple dashboard, maintenance, reporting, vendor, and finance implementations.
- API routes do not power the main product state consistently. Some routes return simulated constants; others write to a separate D1 model.
- The external work-order page receives customer work details from editable query parameters and reports vendor actions back to the opener window. It is a mock, not a secure external workflow.
- The hosted surface is protected by ChatGPT-site authentication, which is incompatible with an account-free vendor workflow.
- Role restriction is implemented by filtering an already-loaded client dataset. That may make a demo view look scoped; it is not production authorization.
- The schema includes accounting, payments, accruals, and purchase-order concepts that the product strategy explicitly puts out of scope, while launch-critical identity, external-token, and persistent visit paths are not fully connected.
- The test suite currently passes 51 tests, typecheck, and lint, but it does not catch unreachable primary flows or impossible event chronology. `test:e2e` is a Vitest domain test, not a real browser journey.

### 14.2 Specific data/UI failures already found

- A polished guided-story surface exists but is unreachable through navigation or any role default.
- The only seeded active visit is chronologically impossible: its check-in precedes the request, work-order creation, issuance, vendor acceptance, and scheduled date, and its missing-checkout exception is shown before the check-in time relative to the fixed demo clock.

### 14.3 What to retain

- The clarified product thesis and market research.
- The canonical work-order/evidence-chain idea.
- Progressive classification and independent organization/taxonomy axes.
- Transparent metric definitions and no-downtime/no-certified-labor rules.
- Selected domain formulas after validation.
- Deterministic fixture concepts after chronology and causal-integrity repair.
- Visual ideas that pass the new design system and usability tests.

### 14.4 What to rebuild

- Application shell, routing, and role-specific navigation.
- Production identity, membership, permissions, and tenant isolation.
- Repository-backed data access and server aggregates.
- Request/work/issuance/visit/follow-up domain commands.
- Secure external links and real delivery.
- QR and trusted-store-device flows.
- File storage and audit.
- Executive dashboards and source drill-through.
- Store/vendor onboarding and support administration.
- Automated browser, authorization, accessibility, and failure-mode testing.

The cleanest engineering move is a controlled strangler inside the repository: establish one new production module tree and route set, make it the only source for new work, and delete old surfaces as each bounded module reaches parity. Do not continue adding features to `traceops-app.tsx`.

## 15. Build sequence and release gates

The sequence is ordered by risk and product value, not visual excitement. A phase is complete only when its acceptance gate passes.

### Phase 0 - Product freeze and foundation decisions

Deliver:

- Freeze legacy feature additions.
- Approve this blueprint, vocabulary, capability boundaries, and data retention position.
- Select production hosting, database, object storage, authentication, email, SMS, and monitoring providers.
- Establish design tokens, accessible components, route map, domain package boundaries, migrations, environments, and CI.
- Create anonymized deterministic fixtures and a separate load-test fixture.

Gate:

- Architecture decision record approved.
- Staging and production environment strategy documented.
- Threat model and data inventory reviewed.
- No unresolved ambiguity about platform versus AP/accounting scope.

### Phase 1 - Production foundation

Deliver:

- Organization/store/person/vendor persistence.
- Real authentication, membership, roles/scopes, and server authorization.
- Production migrations, backups, restore, logs, metrics, error monitoring.
- Private file service and audit foundation.
- Store/vendor CSV dry-run/import/export.
- Role-specific shell and global search.

Gate:

- Cross-tenant negative tests pass for every implemented path.
- Restore drill passes.
- The separate synthetic approximately-65-store scale fixture loads idempotently and search/pagination meet targets.
- No primary UI reads a whole organization from static demo data.

### Phase 2 - Service Visit Accountability

Deliver:

- Rotatable store QR.
- Secure work-link and trusted store-device channels.
- One active visit across channels.
- Eligible-WO selection plus no-WO lane.
- Check-in/out location evidence and consent states.
- Sensitive-service policy.
- Outcome, evidence, automatic unresolved follow-up.
- Live visits, exceptions, notifications, stale-visit handling, support amendment.

Gate:

- Golden path passes on iOS Safari, Android Chrome, and store desktop.
- Cross-channel checkout, denied/low-accuracy location, no-WO, duplicate retry, weak-network recovery, and missed checkout pass.
- Median familiar-user check-in is under 30 seconds in moderated testing.
- No observed time is described as certified labor.

### Phase 3 - Requests, Work Orders, and Vendor CRM

Deliver:

- Store issue intake and coordinator entry.
- Request review.
- Canonical work order/service authorization.
- Internal/outside/choose-later routing.
- Searchable vendor selection and coverage.
- Real issuance with delivery state.
- Account-free accept/decline/propose/question.
- Timeline, ownership, due dates, escalation, amendments.

Gate:

- Full employee report -> review -> WO -> vendor issue -> response -> visit -> outcome -> follow-up journey passes with durable records.
- Revoked/superseded links and delivery failures recover correctly.
- Asset selection remains deferrable.

### Phase 4 - Executive Operations and Reporting

Deliver:

- Executive Control Tower.
- Store, region, vendor, and trade drill-downs.
- Raw metric definitions/denominators.
- Saved filters, exports, generated report records.
- Recorded work cost and optional invoice-reference safeguard.

Gate:

- Every important number opens exact source records with preserved period/scope/definition.
- Dashboard totals reconcile to source events.
- Role/scope restrictions apply equally to aggregates, lists, detail, search, export, and files.

### Phase 5 - Equipment, PM, Lifecycle, and Capital Review

Deliver:

- Company taxonomy/aliases and store activation.
- Assets/components/warranties/documents.
- PM plans/occurrences/compliance/evidence.
- Asset work/visit/cost history.
- Transparent capital-review queue and forecast scenarios.

Gate:

- Uneven hierarchy and unclassified work behave correctly.
- PM numerator/denominator/window open to source occurrences.
- Lifecycle facts reconcile to linked work/cost records.
- No downtime is inferred and no opaque replacement score appears.

### Phase 6 - Pilot hardening and rollout

Deliver:

- Production runbooks, support console, security review, accessibility audit, load tests, backup/restore, data offboarding.
- Store/vendor deployment materials.
- Baseline/pilot measurement instrumentation.
- Controlled rollout and rollback plan.

Gate:

- All production acceptance criteria in Section 16 pass.
- Customer process, privacy, and security owners sign off.
- Support staffing can meet the promised service level.

## 16. Production acceptance scorecard

### Platform and security

- 100% tenant-isolation and negative-authorization tests pass.
- No unresolved critical/high security findings.
- MFA enabled for privileged users.
- Backup restore completed successfully.
- Production changes use migrations and rollback procedures.
- No routine direct production-data edits.
- Public tokens are random, purpose-bound, hashed, expiring, revocable, and rate-limited.

### Data

- For an authorized production deployment, all customer stores in the agreed scope load and reconcile. The fictional showcase remains separate.
- Every store has approved number, address, region, timezone, and coordinates.
- No duplicate stable IDs/store numbers.
- Vendor contacts, specialties, aliases, and coverage approved.
- Import/export totals reconcile.
- Event chronology and causal ordering invariants pass.

### Functional

- Store report, coordinator entry, and request review work.
- Internal, outside, and choose-later work routing work.
- Vendor authorization delivery and response work.
- QR, secure-link, and store-device visit paths work.
- Cross-channel checkout works.
- No-WO lane works.
- Denied/low-accuracy/unavailable location states work.
- Missed checkout and unresolved follow-up work.
- Communication failure is visible/recoverable.
- Every dashboard metric opens its supporting records.
- Every mutation writes business audit in the same transaction.

### Usability and accessibility

- At least 95% task completion in moderated store/vendor tests.
- Median familiar-vendor check-in under 30 seconds.
- Median store issue report under 60 seconds.
- No critical WCAG 2.2 AA blockers.
- VoiceOver, TalkBack, NVDA, keyboard, zoom, and outdoor/mobile contrast walkthroughs pass.

### Reliability

- Load and soak tests meet target.
- Idempotent retry prevents duplicate visits/actions.
- Restore and incident drills pass.
- Monitoring detects core workflow outage, delivery failure, job backlog, and error-rate change.
- Required runbooks and escalation contacts exist.

### Product truth

- No fake or dead controls.
- No session-only record is presented as durable.
- No client-side role filter is presented as security.
- No QR scan alone is presented as proof of presence.
- No geofence duration is presented as labor proof.
- No invoice difference is presented as fraud.
- No inferred downtime.
- No independent hardcoded dashboard totals.

## 17. Future production rollout pattern for an operator at this scale

This section describes a future, customer-authorized implementation after the fictional platform showcase earns the engagement. It is not a requirement to put the prospect's 63 real stores into the demo. Engineer for that operating scale from day one, but do not launch a real customer in one uncontrolled wave.

### Readiness

- Name executive sponsor, facilities owner, IT/security contact, data owner, privacy/location owner, regional champions, implementation owner, and production-support owner.
- Agree on location policy, radius/accuracy treatment, no-WO policy, sensitive-service categories, store confirmation, visit timeout, notification, retention, and support.
- Establish baseline visit volume, calls/emails, missing status, and coordinator/store interruption.

### Staging rehearsal

- Import only the stores and vendors authorized for that future implementation into a customer-isolated staging environment.
- Validate permissions, communications, QR kits, geolocation, search, dashboards, exports, failure modes, restore, and incident procedures.

### Controlled production pilot

- Use 3-5 representative stores across regions, shifts, signal conditions, and management styles.
- Include a large vendor, small vendor, after-hours visit, sensitive forecourt visit, no-WO visit, denied location, and missed checkout.
- Preserve the customer's existing fallback process.

### Regional waves

- Add 15-20 stores per wave.
- Review adoption, unmatched visits, missing checkout, delivery failures, denied/low-accuracy location, duplicate/orphan sessions, support contacts, and vendor completion time daily.

### Full operation and stabilization

- Roll to the customer's remaining authorized stores with heightened monitoring and after-hours support.
- Review the first 30 days before turning on additional modules.
- Select expansion from observed operational needs, not from a preloaded upsell script.

## 18. Value measurement and stop rules

Do not promise savings from synthetic demo data. Establish a baseline and measure the same workflow during rollout.

### Core customer inputs

- Outside-vendor visits per month.
- Coordinator minutes per visit before/after.
- Store interruption minutes per visit before/after.
- AP matching minutes per invoice when invoice safeguard is enabled.
- Customer-approved loaded labor rates.
- Confirmed duplicate/unauthorized corrections, labor corrections, warranty/go-back credits.
- Setup, rollout, software, and support cost.

Maintain three separate value ledgers:

1. **Verified cash impact:** issued credit, waived charge, or confirmed correction only.
2. **Measured labor capacity:** baseline-versus-pilot time difference at customer-approved loaded rate; never called headcount reduction.
3. **Exposure surfaced:** unsupported or mismatched dollars awaiting human review; never called savings.

Operational measures:

- Expected visit capture.
- Technician-initiated rate.
- WO-linked/no-WO rate.
- Checkout/outcome completeness.
- Check-in P50/P90 completion time.
- Location-result mix.
- Unmatched-visit age.
- Status-chasing calls/emails.
- Repeat visit and unresolved follow-up.
- Support contacts per 100 attempts.
- Vendor/store satisfaction.

Immediate stop conditions:

- Any cross-tenant exposure.
- Material public-link security incident.
- Verified timestamps silently altered or backdated.
- Poor/unavailable location labeled as verified.
- Continuous tracking.
- Systemic wrong-store/wrong-vendor association.
- Inability to produce complete business audit.
- Legal/privacy determination that the workflow is unsafe.

Suggested adoption gates, to be negotiated with the customer rather than presented as industry promises:

- Median technician check-in/out no more than 60 seconds after the first correction cycle.
- No more than five support contacts per 100 visit attempts.
- Duplicate/orphan active visits below 2%.
- At least 80% of eligible visits technician-initiated after two vendor coaching cycles.
- At least 90% of initiated visits contain checkout plus outcome or explicit exception.
- At least 99% of visit records searchable/reconcilable by store, vendor, and date.
- Store burden does not increase.
- At least one recurring management decision is materially improved by the records.

If vendor accountability is not trusted, adopted, and measurably easier, do not force invoice, asset, PM, or lifecycle expansion on this customer.

## 19. What not to build now

- Full accounting/AP, general ledger, payments, tax, receivables, accrual engine, or formal purchasing/receiving.
- Vendor marketplace.
- Dispatch route optimization or workforce scheduling.
- Mandatory vendor app/account/PIN.
- Continuous location tracking.
- Universal store confirmation for every visit.
- Asset-required issue/work-order creation.
- Opaque vendor/accountability/asset-health scores.
- AI fraud verdicts or automatic invoice rejection.
- Automatic replacement commands.
- Native iOS/Android before the web workflow proves adoption and offline needs.
- Customer-facing generic workflow builder.
- Any module whose only implementation is a visual mock.

## 20. Final product test

The platform succeeds when the operator can say:

> We started by solving vendor check-in. Now, without adding burden to stores or vendors, we can see every outside visit, every exception, every unresolved next action, which stores and vendors need attention, and the source facts behind the decision. When we are ready, the same history can support work orders, spend review, PM, warranties, and capital planning without moving to another system.

That is the above-and-beyond outcome: not a larger demo, but a trustworthy operating platform whose first module solves the requested problem completely and whose architecture makes the broader suite credible.
