# Convenience Facilities Platform Architecture

**Status:** Approved rebuild architecture
**Updated:** August 15, 2026
**Working product label:** TraceOps; renameable by configuration

## Architecture decision

Build a server-first modular monolith around one canonical service thread. Preserve the existing tenant-scoped domain, repository, transaction, audit, D1/PostgreSQL, public-token, and seed work where it conforms to this document. Replace the current operator presentation layer, generic presenter, active visual system, and dead legacy application stacks.

The architecture optimizes for:

- Durable multi-user operation.
- Real outside vendors with optional adoption.
- Tenant and location authorization enforced on the server.
- One-to-approximately-100-store operators.
- A deterministic 15-store presentation tenant.
- Current Sites/D1/R2 hosting and future Render/PostgreSQL/S3-compatible hosting.
- A full future rename without domain or database migration.

## Core system shape

```text
Next.js server application
├── Enterprise operator experience
├── Store/public mobile experience
├── Vendor secure-link experience
├── Route handlers / server actions
├── Domain commands and policies
├── Read-model/query services
├── Repository contracts
├── D1 and PostgreSQL adapters
├── R2 and S3-compatible file adapters
├── Audit + outbox
└── Worker/cron entry points
```

The system is a modular monolith, not microservices and not one giant configurable interface. Modules share domain commands and infrastructure but keep explicit data and UI boundaries.

## Brand-neutral foundation

“TraceOps” is a temporary default display value only.

One server-owned brand configuration supplies:

- Product name.
- Suite/edition label.
- Short name.
- Logo and favicon asset paths.
- Metadata title/description.
- Primary action and navigation color tokens.
- Email/PDF sender and footer language.
- Support URL/email.
- Legal/privacy links.

Configuration precedence:

1. Environment/tenant deployment configuration.
2. Persisted tenant brand override when white labeling is later supported.
3. Safe local default.

Routes, cookie names, database tables, event names, domain types, component folders, CSS class names, storage keys, and API contracts do not contain the product brand. The umbrella name may change without rewriting source records.

## Bounded modules

### Identity and tenancy

Organizations, memberships, roles, scope grants, sessions, support access, and audit attribution.

### Portfolio

Divisions, regions, stores, structured addresses, aliases, store format, services, operating context, and geofence policy.

### Intake

Store reports, immutable request facts, attachments, review, duplicate/decline decisions, and conversion to work.

### Service control

Canonical operator work orders, next-action derivation, approvals, assignment, internal/outside/choose-later routing, authorization revisions, and closure.

### Estimates

Competitive estimate requests, accountless responses, immutable proposal revisions, selection, withdrawal, and conversion to a single service assignment.

### Provider network

Vendors, internal teams, contacts, specialties, aliases, coverage, preferred relationships, qualifications, and performance projections.

### Visits and evidence

Cross-channel check-in/out, point-in-time location observations, active visits, outcomes, follow-up, store confirmation, amendments, and unmatched visits.

### Equipment

Organization equipment templates, group/type taxonomy, store assets, components, warranty, equipment enrichment, historical identity snapshots, and files.

### Preventive maintenance

PM templates, plans, cohorts, schedules, occurrences, canonical generated work, exceptions, and compliance.

### Cost and safeguards

Authorization/NTE, proposals, entered work cost, optional invoice upload/import, match suggestions, confirmed links, allocations, and reconciliation. No payment execution.

### Lifecycle and capital

Replacement profiles, effective-dated benchmarks, asset overrides, approved replacement events, review packets, replacement windows, and scenario forecasts.

### Insights and reporting

Portfolio metrics, action queues, provider/store/equipment comparisons, value ledger, exact-record drill-through, saved views, generated report versions, and exports.

### Platform administration

Imports, templates, role setup, policies, integrations, outbox, support tooling, and audit.

## Canonical service thread

```text
Request or PM occurrence
        │
        ▼
Operator work order ────────────────┐
        │                           │
        ├── approval/NTE            ├── equipment + warranty + PM
        ├── estimate requests       ├── cost + optional invoice links
        ├── assignment              ├── files + communications
        ├── issuance revisions      ├── value events
        ├── vendor responses        └── audit events
        ├── visits
        ├── outcomes
        └── follow-ups
```

The request and PM occurrence remain source records. The operator work order is the canonical customer service record and billing reference. Assignment, visit, outcome, and financial evidence keep separate state machines.

## Derived accountable state

The product never asks the UI to infer responsibility ad hoc. A pure domain projection derives:

```ts
type AccountableState = {
  stage: "intake" | "authorization" | "provider_response" | "scheduled" |
    "onsite" | "follow_up" | "review" | "closed";
  sentence: string;
  accountablePartyType: "user" | "role" | "vendor" | "store" | "system";
  accountablePartyId?: string;
  accountablePartyLabel: string;
  nextActionCode: string;
  nextActionLabel: string;
  dueAt?: string;
  escalationDestination?: string;
  evidenceLinks: Array<{ entityType: string; entityId: string }>;
};
```

All non-terminal work orders must produce a complete accountable state. Commands that create an unresolved outcome, decline, missing evidence exception, or overdue requirement create/update the next action atomically with their source event.

## Tenant and authorization invariants

Every tenant-owned read, write, search, aggregate, export, file, job, and audit query accepts `organization_id` as an explicit first boundary.

Required order:

1. Resolve authenticated or public capability.
2. Apply `organization_id`.
3. Apply membership role/capability.
4. Apply division/region/store/vendor scope grants.
5. Apply record-specific permission.

IDs are never trusted to imply tenancy. Repository APIs do not expose an unscoped `getById` for tenant records. Composite tenant-safe foreign keys prevent a child record from pairing one tenant's ID with another tenant's organization.

The visible role picker is a fictional presentation control only. Production auth must resolve identity, membership, and scope on the server and must never rely on presenter filtering.

## Domain command contract

All mutation channels call the same named domain commands:

- Operator web form.
- Store portal.
- Secure vendor link.
- QR/mobile web.
- Trusted store device.
- Optional vendor portal.
- Future app/API/integration.
- Support action.

A command:

1. Accepts actor context, organization ID, input, expected version/state, and idempotency key where applicable.
2. Loads tenant-scoped facts.
3. Validates policy and transition.
4. Produces append-only evidence and narrowly scoped state updates.
5. Produces audit and outbox events in the same transaction.
6. Returns a stable receipt and current accountable state.

The UI never writes status columns directly.

## Concurrency and idempotency

Use optimistic concurrency for consequential records and idempotency keys for public/mobile actions.

Examples:

- Two managers cannot approve the same request into duplicate work orders.
- One work order cannot have two selected estimate winners.
- Retried check-in cannot create duplicate active visits.
- Retried checkout cannot create duplicate follow-up.
- Issuance revisions are monotonic.
- Proposal revisions are immutable and unique per request.
- Invoice allocations cannot exceed or double-count the source amount.

## Audit and amendment

The following are append-only or corrected by attributed amendment:

- Source requests.
- Approval decisions.
- Assignment/issuance history.
- Vendor responses.
- Visit evidence and reported arrival assertions.
- Outcomes and follow-up.
- Finalized work costs.
- Invoice links and allocation decisions.
- Equipment enrichment suggestions and accepted changes.
- Replacement benchmarks and overrides.
- Value-ledger decisions.
- Generated report versions.

Audit event and domain mutation commit together. An audit record includes organization, entity, event type, actor type/ID/name, occurred time, visibility, request/correlation ID, and safe structured details.

## Data and money rules

- Money is integer minor units plus currency.
- Estimate, proposal, authorization/NTE, entered work cost, invoice, allocation, and confirmed value are different bases.
- Timestamps are stored as UTC instants with the relevant timezone projected at presentation.
- Addresses are structured and searchable.
- Store number is not the primary key.
- External vendor ticket, vendor invoice, and accounting PO references are distinct.
- Historical service records preserve relevant name/classification snapshots.
- Lists use stable indexed ordering and cursor/page pagination.
- Aggregates derive from persisted source facts and expose Unclassified/Unmatched values.

## Read-model architecture

The existing giant snapshot-to-generic-presenter pattern is not the target architecture.

Each major screen owns a typed server read model and query service:

```text
features/overview/server
features/work/server
features/stores/server
features/equipment/server
features/vendors/server
features/planning/server
```

Read models:

- Accept organization and granted scope.
- Accept explicit filter/period/cost-basis inputs.
- Query the repository rather than loading the entire tenant fixture.
- Return semantic records, not preformatted generic cards.
- Include source query/filter tokens for drill-through.
- Include coverage, denominator, and data-basis metadata.
- Return money and dates as typed values; format at the presentation boundary.

Common table, chart, timeline, status, and filter components render semantic feature models. A single 200,000-byte presenter and one generic dashboard model are prohibited.

## Operator UI architecture

The current operator UX, teal/coral palette, generic views, card-heavy dashboard system, and legacy application stacks are not retained.

### Shell

- Deep slate left navigation.
- Neutral cool-gray canvas.
- White work surfaces.
- Cobalt primary action/focus color.
- Global tenant-scoped search.
- Persistent role/scope context.
- One contextual create menu.
- Six maximum primary destinations.
- Setup/profile in the footer.

### Interaction levels

1. **Summary:** outcome/attention indicators.
2. **Queue:** sortable, filterable exact records.
3. **Split view:** rapid triage without losing the queue.
4. **Full record:** authorization, proposal selection, lifecycle, and reconciliation.
5. **Public/mobile task:** one prominent next action.

### Design-system contract

- Brand-neutral token names.
- Semantic status tokens independent of brand.
- 4/8 px spacing system.
- 15–16 px base type.
- Comfortable and compact density modes.
- Strong tables with sticky headers and stable columns.
- Cards reserved for summary information.
- No decorative gradients, glass, playful illustration, or excessive rounded containers.
- Accessible focus, contrast, labels, errors, keyboard flow, reduced motion, and chart alternatives.
- Designed loading, empty, partial, stale, permission, and error states.

## Public capability architecture

Public links contain opaque high-entropy tokens. Store only a hash at rest. A token is:

- Purpose-bound.
- Record-bound.
- Organization-bound.
- Expiring where appropriate.
- Revocable.
- Narrowly projected.
- Rate limited.
- Logged without exposing the raw token.

Purposes include store intake, trusted store device, service authorization, vendor estimate, vendor visit, visit checkout, file upload, and optional store confirmation.

A public capability never grants arbitrary repository access or general vendor history beyond the authorized work/store/equipment context.

## Visit and location architecture

One visit entity is channel-independent. Check-in and checkout each may create a point-in-time location observation with:

- Captured timestamp.
- Latitude/longitude.
- Accuracy radius.
- Distance to configured store point.
- Store geofence radius at the time.
- Consent/result.
- Channel.
- Verification classification.

No continuous tracking is collected. A trusted store device is a separate evidence classification. Reported arrival is an unverified assertion and never rewrites verified time.

## Equipment template architecture

```text
Organization equipment template
├── category/group/type
├── default expected-life profile
├── optional replacement profile
├── optional default components
├── optional PM templates
└── field rules and aliases

Store blueprint application
├── selected template + quantity
├── asset instances
├── practical name/location
└── optional later enrichment
```

Applying a blueprint records the template/version used. Updating a template does not silently rewrite existing assets. Administrators may run a previewed, explicit synchronization for safe additions.

## Lifecycle architecture

Replacement price is a versioned profile benchmark, not a copied number on every asset. Assets may have an explicit override.

Benchmark update flow:

```text
approved replacement proposal/event
        ↓
candidate benchmark update
        ↓
human review of cohort, scope, date, and affected assets
        ↓
publish effective-dated benchmark or reject
```

The capital forecast queries asset install/age range, expected-life range, active profile benchmark/override, and timing scenario. It never depends on invoice completeness.

The work-authorization review rule is transparent and configurable. A dollar floor plus remaining-life-weighted replacement share prevents small repairs near end of life from becoming automatic capital alarms. The output is a review packet, never a verdict.

## Value-ledger architecture

A value event is a first-class reviewed fact:

```text
identified → under_review → confirmed → realized
                           └──────────→ rejected
```

It stores source entities, identified basis, caveats, responsible reviewer, decision, customer-confirmed amount/measure, and audit. Derived opportunities may be recalculated; confirmed outcomes are append-only decisions.

## Persistence adapters

### Sites preview

- Cloudflare D1 binding: `DB`.
- Cloudflare R2 binding: `FILES`.
- Deterministic source records persisted to D1.
- Uploaded evidence stored privately in R2.

### Render target

- `DATABASE_URL` PostgreSQL.
- PostgreSQL-compatible migrations.
- S3-compatible private object storage.
- Injected `PORT`.
- `/api/health` liveness.
- `/api/ready` dependency readiness.
- Idempotent migration/seed/worker commands.
- No production uploads on ephemeral disk.

Domain commands and repository contracts do not import Cloudflare APIs. D1/R2 and PostgreSQL/S3 are adapters.

## File architecture

File metadata is tenant-owned and stored in the database. Object keys are random, non-guessable, and organization-prefixed. Access uses authorized streaming or short-lived signed URLs. Validate size, MIME, extension, and purpose. Preserve checksum, uploader, uploaded time, visibility, and linked entity. Malware scanning is an integration point before production launch.

## Outbox and integrations

Issuance, notification, export, and future integration events use a transactional outbox. The request commits domain state and outbox intent together; workers deliver idempotently and record attempts.

Future adapters map rather than merge:

- Operator WO ↔ vendor service ticket.
- Operator WO ↔ optional accounting PO.
- Operator WO/cost ↔ vendor invoice.
- Store/equipment ↔ PDI/Petrosoft/fuel/compliance identifiers.
- Alarm/sensor event ↔ intake signal.

The product remains usable with manual links, email, PDF, and CSV before APIs exist.

## Deterministic fixtures

The presentation fixture contains exactly 15 stores, five outside vendors, and two internal technicians. Every dashboard total derives from source records. Time is anchored to a deterministic fixture clock.

Additional fixtures:

- One-store operator.
- Approximately 65-store operator.
- Empty/first-run tenant.
- Partial-classification tenant.
- High-volume pagination/search tenant.

Fixture repository behavior mirrors transactional and tenant-scoped production semantics closely enough for domain tests. It is not a production state container.

## Testing architecture

### Domain tests

- State transitions.
- Accountable-state derivation.
- Tenant isolation.
- Scope grants.
- Idempotency/concurrency.
- Estimate winner uniqueness.
- Visit cross-channel behavior.
- Unresolved follow-up atomicity.
- Cost allocation/reconciliation.
- PM denominator/compliance.
- Lifecycle threshold examples.
- Benchmark versioning.
- Value-event review.

### Repository contract tests

Run the same behavioral contract against fixture, D1-compatible, and PostgreSQL adapters where practical:

- Scoped lookups.
- Search/pagination/order.
- Atomic writes.
- Composite tenant-safe relationships.
- Public capability projections.
- Aggregate agreement with source records.

### Presenter/component tests

- Role/scope materially changes home data and actions.
- Every principal metric carries a valid drill-through.
- Work header agrees with domain accountable state.
- Cost labels never blend bases.
- PM metrics show denominator/window.
- Lifecycle shows transparent inputs.
- Brand changes do not leak the default name.

### End-to-end journeys

1. Store report → manager review → WO.
2. WO → direct vendor authorization → accountless response.
3. WO → multiple estimate requests → one selected provider → one service authorization.
4. QR check-in → secure-link checkout → unresolved follow-up.
5. No-WO check-in → unmatched visit review/reconciliation.
6. Optional invoice → human match → reconciled allocation.
7. PM occurrence → canonical WO → compliance drill-through.
8. Lifecycle flag before authorization → human decision.
9. Approved replacement → proposed benchmark update → publish → capital forecast.
10. New store → blueprint quantities → quick naming/location → activated equipment.

## Required checks

```bash
npm run db:seed
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run build:render
```

Then inspect manager search/drill-down, store creation, deferred classification, direct vendor authorization, estimate request, public response, cross-channel visit, no-WO exception, invoice safeguard, PM, lifecycle, replacement benchmark update, role views, and responsive store/vendor screens.

## Prohibited architecture regressions

- Loading the entire tenant into a client component.
- Reintroducing a session-scoped UI as the state store.
- Unscoped repository methods.
- A giant generic presenter that formats every screen.
- Hardcoded dashboard totals.
- Brand strings scattered through source.
- One overloaded status field.
- Public tokens stored raw or granting broad access.
- Direct status writes from UI handlers.
- Invoice completeness required for operations or lifecycle.
- Continuous location tracking.
- Silent historical rewrites.
