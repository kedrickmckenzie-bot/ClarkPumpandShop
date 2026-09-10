# Convenience Facilities Platform Rebuild Blueprint

**Approved:** August 15, 2026
**Decision:** selective clean-slate rebuild
**Working product name:** TraceOps; temporary and centrally configurable
**Product target:** enterprise-grade c-store facilities control, not a guided-demo shell

This is the primary product, UX, architecture, and execution source of truth. Detailed market evidence is in [`competitive-research.md`](competitive-research.md), the full behavior contract is in [`product-spec.md`](product-spec.md), and technical boundaries are in [`architecture.md`](architecture.md).

## 1. Executive decision

The current product contains a credible service-evidence engine and several correct domain behaviors. It does not contain the singular enterprise platform the customer should buy.

Retain:

- Tenant-scoped domain concepts.
- Canonical operator work order.
- Internal/outside/choose-later routing.
- Versioned vendor issuance.
- Distinct competitive estimate workflow.
- Accountless vendor response.
- Cross-channel visit evidence.
- No-work-order exception.
- Unresolved follow-up.
- Audit, idempotency, and concurrency concepts.
- Transparent replacement intelligence.
- D1/PostgreSQL and R2/S3 adapter direction.
- Deterministic source-record fixtures.

Replace:

- Entire operator UX and color system.
- Teal/coral prototype identity.
- Generic dashboard, list, detail, and presenter components.
- Full-tenant snapshot loading.
- 3,700-line generic presenter.
- Role-preview-as-authorization assumptions.
- Parallel dead c-store/demo/platform UI stacks.
- SQLite-to-PostgreSQL statement translation as the long-term repository architecture.
- Fixture-thin equipment, PM, request, invoice, value, and capital stories.

The product must feel like one operating system:

> Issue or PM signal → review and authorization → canonical work-order case → direct provider work or competitive estimate → provider response → observed visit → outcome and follow-up → cost evidence → store, provider, PM, equipment, and capital insight → exact supporting record.

## 2. Why the wedge expands

The customer initially asked for vendor check-in/accountability. The durable value is broader because check-in becomes credible only when it is connected to:

- The customer work-order number.
- The authorized scope and provider.
- The vendor's response and proposed date.
- The observed visit and outcome.
- Repeat/return service.
- Recorded cost and optional invoice evidence.
- Store, equipment, warranty, PM, and lifecycle history.

The platform therefore lands with low-friction vendor accountability but is architected as the facilities control layer.

At the NACS 2024 average of $5,719 repairs and maintenance per store per month, a $150 monthly subscription is about 2.62% of the cost base. The product must visibly help control or explain more than that threshold without manufacturing savings.

## 3. Product thesis

### Three promises

1. **Nothing gets lost.** Every unresolved item has one owner, next action, due time, and escalation.
2. **Every visit has context.** The system connects authorization, provider, store, arrival/checkout evidence, outcome, and follow-up without burdening the vendor.
3. **Every insight has proof.** Spend, vendor, PM, store, repeat-work, and capital insights open the exact records underneath.

### Defining UX rule

The platform-wide [review experience contract](PLATFORM_REVIEW_EXPERIENCE.md) also applies when a user is browsing history or reviewing data without making a decision. Every view should assemble useful context and evidence, preserve scope, make missing information clear, and provide relevant connections without requiring a new task or action.

> One service story, one accountable next action, many optional depths.

The platform stores detailed state but translates it into plain language. A user sees “Waiting on ColdLine Refrigeration & HVAC to schedule by 4:00 PM,” not a chain of assignment, visit, and workflow codes.

## 4. Enterprise visual direction

The current visual language is discarded.

### New system

- Neutral cool-gray application canvas.
- White working surfaces.
- Deep slate navigation and record headers.
- One restrained cobalt action and focus color.
- Semantic red, amber, blue, green, and gray statuses.
- 15–16 px base text and readable labels.
- Strong tables, queues, timelines, sticky headers, and split views.
- Comfortable default density; compact density for high-volume records.
- Cards only for true summaries.
- Restrained charts with exact record tables underneath.
- One primary action per context.
- Designed loading, empty, stale, partial, error, and permission states.

### Explicitly rejected

- Current teal/coral palette.
- Marketing-style gradients or glass effects.
- Oversized rounded card grids.
- Tiny labels and low-contrast helper text.
- Decorative charts.
- Generic pages that differ only by heading and rows.
- Playful “vibe-coded” visuals in the operator application.

### Rename rule

Product name, edition, logo, favicon, metadata, email/PDF language, support links, and brand colors come from one brand configuration. Routes, database names, domain types/events, component names, CSS names, and storage keys are brand-neutral.

## 5. Information architecture

Use no more than six primary destinations:

1. Overview.
2. Work.
3. Stores.
4. Equipment.
5. Vendors.
6. Spend & planning.

Setup lives behind profile/administration.

### Overview

Role-specific outcome and action surface. It is not a generic dashboard.

### Work

- Action queue.
- Requests.
- Work orders.
- Visits.
- Estimate requests.

### Stores

- Searchable directory.
- Store overview.
- Work, visits, equipment, spend, and PM tabs.
- Store setup and blueprint commissioning.

### Equipment

- Portfolio hierarchy.
- Asset workspace.
- Preventive maintenance.
- Capital review.
- Templates for administrators.

### Vendors

- Searchable CRM.
- Coverage/specialties.
- Work and visits.
- Transparent performance.
- Optional portal/onboarding.

### Spend & planning

- Spend exploration.
- Store and vendor performance.
- Money requiring review.
- Value ledger.
- Invoice safeguards.
- Reports.

## 6. Role projections

All roles use the same underlying service facts.

| Role | Home priority | Key restrictions |
|---|---|---|
| Executive | spend, service exposure, outliers, provider performance, PM, capital, confirmed value | no operational edit clutter |
| Facilities | action queue, authorizations, vendor responses, live/exception visits, stalled work, PM/lifecycle | companywide permitted scope |
| Regional | store comparison, aging/critical work, local approvals, visits, outliers | only granted regions/stores |
| Store manager | requests, onsite/expected providers, work review, upcoming PM, store history | no companywide data |
| Finance | cost basis, invoice links, unmatched amounts, evidence and reconciliation | no payment action |
| Store employee | report issue, vendor sign-in, permitted request status | store-only public/trusted surface |
| Internal technician | assigned work, store/equipment history, visit, outcome | assigned/permitted work |
| Vendor/technician | only that vendor's authorized work and scoped history | no customer portfolio access |

The fictional role picker must visibly change home, navigation, scope, rows, metrics, and actions. Production identity remains a separate gate.

## 7. Core screen blueprints

### 7.1 Facilities Control Tower

1. Persistent context strip: scope, period, cost basis, comparison cohort, updated time.
2. Needs you / Waiting on others / Watching queue.
3. Network pulse: recorded work cost, critical open work, active visits, PM compliance.
4. Service pipeline with exact stage records.
5. Money requiring review.
6. Store outliers.
7. Provider response and first-observed-resolution trend.
8. Recent visit ledger.
9. PM and capital horizon.

### 7.2 Executive Overview

1. Portfolio outcome statement.
2. Spend and service exposure.
3. Highest-impact stores/categories.
4. Provider comparison with denominators/coverage.
5. PM compliance.
6. Capital outlook.
7. Confirmed value ledger.
8. Supporting records for the selected insight.

### 7.3 Work queue

- Saved views.
- Search, stable sorting, filters, pagination.
- Stage, priority, store, vendor, category, due, owner, and next action.
- Split view for rapid triage.
- Full page for consequential work.

### 7.4 Work-order case

Fixed header:

- Customer WO number.
- Store.
- Plain state sentence.
- Accountable party.
- Next required action.
- Due/escalation.
- Priority, authorization/NTE, fulfillment, classification.
- One contextual primary action.

Tabs:

1. Activity.
2. Service.
3. Visits.
4. Cost.
5. Equipment.

### 7.5 Store workspace

- Store number/name/address/region.
- Report issue, create work, vendor sign-in, add equipment.
- Open critical work, onsite providers, current cost, PM compliance, capital horizon.
- What needs attention.
- Category cost and work.
- Recent service timeline.
- Equipment program coverage.

### 7.6 Vendor workspace

- Approved/restricted/inactive status.
- Contact, specialty/aliases, coverage, preferred relationship.
- Open work and responses.
- Visit evidence coverage.
- First observed visit resolution and return visits.
- Overdue next actions.
- Comparable recorded cost.
- Exact records and denominator for every measure.

### 7.7 Spend workspace

- Organization/region/store scope switcher.
- Category/group/type/asset drill path.
- Period, cost basis, cohort, classification coverage.
- Trend, category mix, store outliers, vendor comparison.
- Source work/cost table.
- Never blend recorded, approved, proposed, invoiced, and unmatched amounts.

### 7.8 PM workspace

- Numerator / denominator / window.
- Clickable Upcoming, Due, Overdue, Missed, Completed, Waived, Follow-up tiles.
- Calendar and stable table.
- Exact occurrences and generated WOs.

### 7.9 Lifecycle and capital

- Review queue before service authorization.
- Repair-now versus replace-now cash.
- Extra capital pulled forward.
- Age, expected-life range, and replacement window.
- 12-/36-month related work and cost.
- Component repeats, warranty, PM, proposal scope, lead time.
- Transparent trigger and human decision.
- One-, three-, and five-year capital outlook.
- Replacement benchmark update review.

## 8. C-store setup model

### Organization templates

Initial service programs:

- Refrigeration.
- HVAC.
- Forecourt/fuel.
- Foodservice.
- Electrical/lighting.
- Plumbing.
- Exterior/site.
- Security/IT.
- Car wash when applicable.

Each program contains equipment types, plain aliases/symptoms, expected-life defaults, optional replacement profile, optional components, and optional PM templates.

### Store commissioning

1. Store details.
2. Choose blueprint.
3. Select equipment types and quantities with steppers.
4. Immediately name/locate each created unit in a fast bulk sheet.
5. Add optional model/serial/install/warranty details or skip.
6. Review coverage and activate.

Example:

```text
Open-air cooler × 5
  1. Checkout wall
  2. Front window
  3. Aisle 2 north
  4. Aisle 2 south
  5. Deli grab-and-go
```

Default components are created from the template. Vendors may enrich equipment later. Store employees never need to verify voltage, exact replacement fit, or specialist specifications before calling the expert vendor.

## 9. Direct work versus competitive estimate

The user must make an explicit choice:

### Send work

- Select internal maintenance or one outside vendor.
- Issue versioned Work Order / Service Authorization.
- Vendor can accept, decline, propose date, or ask a question.
- Visit check-in becomes eligible.

### Request estimates

- Select one or more providers.
- Define scope and response deadline.
- No service authorization and no check-in.
- Compare immutable proposal revisions.
- Select one; mark others not selected/withdrawn.
- Create exactly one service assignment under the original WO.

## 10. Visit accountability model

Channels:

- QR/mobile web.
- Secure work-order link.
- Trusted store device.
- Optional vendor portal.
- Future app.

All channels call the same commands and create the same visit.

Check-in captures technician/provider, eligible WO or no-WO reason, vendor ticket, note, channel, timestamp, and optional point-in-time location evidence. Checkout captures outcome, optional files/notes, optional second location observation, and follow-up.

No continuous tracking. No backdating a verified timestamp. Approximate onsite duration is evidence, not labor certification. No-WO service remains allowed and reviewable.

## 11. Transparent lifecycle model

Do not use “lifetime repairs are X% of replacement” as replacement logic.

The review threshold is:

```text
repair amount >= max(
  configured minimum review dollars,
  active replacement benchmark × remaining-life-weighted share
)
```

Repeat related work may lower the share but not the dollar floor. Warranty changes the route. The system shows the exact rule and inputs.

A small repair near expected end of life remains a reasonable repair and normally does not trigger capital review. A large repair relative to current replacement cost may trigger review even with years left. The human decides.

Replacement prices live in effective-dated equipment profiles. An approved replacement quote proposes a benchmark update. A reviewer sees cohort, source, date, scope, optional size class, and affected assets before publishing. One source is permitted and described plainly; an outlier never silently updates all stores.

## 12. Value system

The product distinguishes:

- Money requiring review.
- Identified value opportunity.
- Confirmed outcome.
- Realized customer value.

Potential events:

- Warranty-covered cost.
- Duplicate dispatch avoided.
- Invoice overage corrected.
- Competitive proposal difference with scope caveat.
- Callback charge prevented.
- Customer-confirmed administrative intervention avoided.

PM completion and unmeasured downtime are not automatically monetized.

## 13. Data and architecture invariants

- `organization_id` first on every tenant-owned operation.
- Server-enforced role and scope.
- Stable IDs separate from store numbers/names.
- Server-side search/filter/order/pagination.
- Money in minor units plus currency.
- Distinct cost bases.
- Immutable or amended evidence.
- Audit and mutation in one transaction.
- Shared domain commands across channels.
- Purpose-bound hashed public tokens.
- Private object storage.
- Native D1 and PostgreSQL adapters behind one contract.
- No full tenant loaded into browser or presenter.
- No hardcoded dashboard totals.

## 14. Current repository verdict

### Retain and refactor

- `lib/ops/types.ts` and service domain behavior.
- `lib/ops/commands.ts` behavior, split into use cases.
- `lib/ops/estimate-commands.ts`.
- `lib/ops/concurrency.ts`.
- `lib/ops/lifecycle-analytics.ts`.
- `lib/ops/replacement-intelligence.ts`.
- Tenant/audit concepts in `db/ops-schema*.ts`.
- Public vendor/visit behavior, relocated from component directories.
- Deterministic causal fixture approach.

### Rewrite

- `app/app/**` operator surface.
- `components/ops/**` active operator design system.
- `app/app/_data/operator-presenter.ts` and loader path.
- Full-snapshot query path.
- Repository/persistence port so commands do not emit raw SQL.
- Identity/scope enforcement.
- Public orchestration gateway boundaries.
- Equipment template lineage and quick naming.
- Approval/action/escalation, PM scheduler, outbox, invoice safeguards, report versions, value ledger.

### Remove after replacement

- `components/cstore/**`.
- `lib/cstore/**`.
- Unreachable root UI components.
- `lib/demo/**`, `lib/platform/**`, and abandoned parallel domain/presentation layers.
- Legacy accounting-heavy schema from active runtime/build.
- Bypassed weaker command variants.
- Stale generated archives/logs that are not deployment inputs.

Approximately 49,000 committed lines belong to unreachable parallel product stacks. Preserve history in Git, not in active compilation.

## 15. Execution plan

### Phase 0 — research and decisions

**Status:** complete.

- Competitive and screen research across 18+ products.
- C-store market and adjacency boundaries.
- Singular workflow and product contract.
- Enterprise visual direction.
- Selective clean-slate code audit.

### Phase 1 — protect and clean the foundation

- Preserve behavior tests for issue → WO → issue/estimate → visit → outcome.
- Centralize renameable brand configuration.
- Establish enterprise tokens and primitives.
- Remove dead parallel UI/data stacks after import verification.
- Split active code into feature/application/infrastructure boundaries.
- Keep current routes stable while replacing implementations.

**Gate:** no dead stack referenced; default brand appears only through configuration; retained domain tests pass.

### Phase 2 — singular operator spine

- New enterprise shell and role projections.
- Tenant-scoped route query services.
- Control Tower and action queue.
- Requests and canonical work queue.
- Connected work-order case with state header and timeline.
- Direct internal/outside/choose-later service authorization.
- Competitive estimate request and selection.

**Gate:** a manager can follow one case end to end without switching mental models; every open case has one accountable next action.

### Phase 3 — vendor and visit accountability

- New service authorization public page.
- Accept/decline/date/question.
- QR, secure link, and store device visit.
- Cross-channel checkout.
- No-WO exception.
- Outcomes and atomic follow-up.
- Visit ledger and provider evidence measures.

**Gate:** vendor account remains optional; no visit evidence is presented as certified labor.

### Phase 4 — stores, vendors, and equipment commissioning

- Server search by store number/address and vendor specialty/alias.
- Store 360 workspace.
- Vendor CRM and transparent performance.
- Organization equipment templates.
- Store blueprint quantities.
- Immediate bulk name/location step.
- Progressive vendor enrichment.

**Gate:** a novice can create a store and its equipment inventory without training or technical specifications.

### Phase 5 — spend, PM, lifecycle, and value

- Spend context/drill-down and source tables.
- Money requiring review.
- Optional invoice safeguards.
- PM numerator/denominator and tile filtering.
- Lifecycle review before authorization.
- Replacement benchmark update review.
- Capital outlook.
- Value ledger.
- Generated report versions.

**Gate:** every metric reaches exact records; invoice entry is never required for operational/capital insight.

### Phase 6 — production hardening

- Production identity and scope.
- Native PostgreSQL adapter.
- Outbox delivery/retry.
- PM recurrence and escalation jobs.
- Upload retention/security/malware hooks.
- Audit/support console.
- Migration-upgrade and rollback procedures.
- Observability, rate limits, backups, readiness.

**Gate:** a 63-store-caliber operator can use the system without the creator manually holding the workflow together.

## 16. Implementation order inside each feature

1. Domain behavior and invariant.
2. Schema/migration.
3. Native repository queries and commands.
4. Typed semantic read model.
5. Enterprise desktop screen.
6. Responsive/public/mobile projection where applicable.
7. Exact drill-through.
8. Role/scope tests.
9. Domain/repository/component/E2E tests.
10. Browser and accessibility inspection.

No feature is “done” as a static mockup disconnected from persisted facts.

## 17. Presentation data plan

Rebuild Clark Pump and Shop source records to demonstrate:

- Exactly 15 stores and five outside vendors.
- Two internal technicians.
- Mixed new/unconverted requests.
- Work at every underlying stage.
- Direct vendor issue and competitive estimate flows.
- Vendor opened/accepted/declined/date/question responses.
- Scheduled, active, checked-out, amended, and missing-checkout visits.
- Cross-channel and no-WO visit stories.
- Resolved, temporary, part-waiting, return, unable-to-reproduce, and PM outcomes.
- Multiple related repairs at the same equipment/component level.
- Realistic HVAC/R, forecourt, foodservice, plumbing, electrical, exterior, snow, landscaping, and car-wash data.
- Current and historic work cost.
- Optional invoice matches/unmatched records.
- PM occurrences with honest denominator.
- Replacement profiles, benchmark sources, capital reviews, and one update suggestion.
- Value events in identified, review, confirmed, realized, and rejected states.

Every total is derived. The 65-store fixture proves scale but never appears as the prospect's network.

## 18. Quality and release gates

### Functional

- Store and problem create valid work.
- Classification can be deferred.
- Direct service and estimate request are distinct.
- One estimate winner creates one service assignment.
- Accountless provider response works.
- Cross-channel visit works.
- No-WO service creates reviewable exception.
- Unresolved outcome creates follow-up atomically.
- Optional invoice matching reconciles without double counting.
- PM tiles filter source occurrences.
- Lifecycle flag appears before service authorization.
- Benchmark update does not silently rewrite assets.

### Enterprise UX

- Current prototype visuals no longer appear in the operator app.
- Navigation and terminology are consistent.
- Base type is readable.
- High-volume queues support search, sorting, filters, pagination, and saved views.
- Every principal metric/chart/outlier has exact drill-through.
- Role selection materially changes the experience.
- Mobile store/vendor workflows are one-action clear.
- Keyboard/focus, contrast, loading, empty, error, partial, and permission states are complete.

### Data/security

- Tenant boundary first.
- Server authorization.
- Hashed, expiring, purpose-bound public tokens.
- Private uploads.
- Append-only/amended evidence.
- Audit with mutation.
- No credentials or tokens in source.
- No product name embedded in durable records or identifiers.

### Required commands

```bash
npm run db:seed
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run build:render
```

Then inspect search/drill-down, store creation, direct and estimate workflows, public authorization, visit channels, no-WO, PM, lifecycle, benchmark update, invoice safeguard, role projections, and responsive screens.

## 19. Stop rules

Do not ship or call the platform complete if:

- It still looks like the current prototype.
- A dashboard is a data museum rather than an action surface.
- A work story requires mentally joining several screens.
- Vendor participation requires an account/app.
- A metric cannot reveal exact source records.
- Lifecycle uses a percent-spent shortcut or opaque score.
- Store setup requires specialist equipment data.
- Invoices are required for core value.
- Role differences are cosmetic.
- The presentation fixture substitutes for production architecture.
- The platform needs its creator to manually keep the workflow coherent.

## 20. Final product test

A 63-store-caliber c-store CEO should see:

- A serious enterprise control system, not a demo shell.
- Immediate visibility into what needs attention and why.
- Clear proof of outside-vendor activity without unnecessary vendor burden.
- Store, vendor, equipment, PM, spend, and capital views that agree because they share one service record.
- A defensible value ledger instead of a fake ROI claim.
- C-store-specific depth without losing simplicity.

The final reaction should come from operational credibility and evidence—not visual theatrics or feature volume.
