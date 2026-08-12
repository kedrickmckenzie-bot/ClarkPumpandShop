# Pre-rebuild Platform Readiness Audit

> Historical baseline only. The clean-slate TraceOps implementation supersedes the application state assessed below; use `CSTORE_PLATFORM_REBUILD_BLUEPRINT.md`, `README.md`, and the current automated checks for present-state guidance.

- **Audit date:** August 10, 2026
- **Scope:** Repository and pre-rebuild c-store application
- **Verdict:** Strong interactive prototype; not yet credible as a production platform for an operator at approximately 63-store scale
- **Companion plan:** [`CSTORE_PLATFORM_REBUILD_BLUEPRINT.md`](CSTORE_PLATFORM_REBUILD_BLUEPRINT.md)

The scale reference is an audience and engineering benchmark. The presentation tenant remains a completely fictional 15-store portfolio with five fictional vendors; this audit does not recommend reproducing the prospect's real 63 stores.

## Executive finding

The largest gap is not visual polish. The visible c-store suite is predominantly a session-scoped React simulation disconnected from the authentication, database, APIs, token model, files, messaging, and older platform implementations elsewhere in the repository.

The product should not be hardened by adding more state and screens to the current application container. It needs one aligned domain, schema, repository layer, command layer, API/read model, and role-specific UI.

## P0 blockers

### 1. Session-only application state

[`traceops-app.tsx`](../components/cstore/traceops-app.tsx) initializes stores, vendors, assets, PM, requests, work orders, assignments, issuances, visits, exceptions, costs, invoices, documents, and reports into client-side React state around line 565.

Effects:

- Refresh loses created/changed records.
- Two users cannot collaborate.
- No transactional, concurrency, idempotency, or recovery semantics exist.
- The current c-store UI does not persist through its APIs.
- Files are metadata rather than durable private uploads.
- Filters/details are not URL-addressable/shareable.

The primary component is more than 4,600 lines and owns routing, mutation, analytics assembly, drawers, workflows, and rendering.

### 2. Three conflicting implementations

The repository contains three different product/data families:

- Current c-store prototype: `components/cstore/*`, `lib/cstore/*`
- Earlier platform implementation: root `components/*`, `lib/platform/*`
- Legacy showcase/domain: `lib/demo/*`, `lib/domain/*`

The visible UI uses the first; most APIs and database work use the other two.

Confirmed contradictions:

- Current product rules allow a work order with store/problem only, while [`app/api/registry/route.ts`](../app/api/registry/route.ts) requires `categoryId`.
- Current visit contract allows internal and no-WO visits, while the legacy schema requires a work order and vendor on a visit.
- Current model separates assignments and versioned vendor issuances; older tables embed assignment/vendor concepts differently.
- The legacy schema still contains payment, accrual, purchasing, and downtime concepts that the approved product deliberately excludes.

### 3. No production identity or tenant authorization

The role selector changes a client-side presentation policy after the organization dataset already reaches the browser. This is useful for demonstrating role-shaped screens; it is not authorization.

Existing APIs use hardcoded organization IDs, lack a server-established membership/scope context, and do not consistently protect object detail/mutation.

Production must enforce tenant, permission, store/region scope, and data class on every read, write, aggregate, search, export, upload, token action, and background job.

### 4. Vendor accountability is simulated

The current technician experience presents good concepts, but:

- Location states, accuracy, and distance are presenter-selected/fabricated.
- There is no current real `navigator.geolocation` integration.
- Timestamps originate in browser/session workflows rather than an authoritative visit command.
- The current c-store flow has no real rotatable store QR route.
- Legacy visit APIs synthesize non-persistent records and require a WO.
- Check-in/out, exceptions, evidence, follow-up, and audit are separate mutations rather than one transaction.
- The unmatched-visit queue cannot reconcile a visit to an existing/new WO.

### 5. External vendor authorization is a mock

[`external-work-order/page.tsx`](../app/external-work-order/page.tsx) reads the work-order contents from editable query parameters. [`external-work-order-client.tsx`](../app/external-work-order/external-work-order-client.tsx) returns vendor response through `window.opener.postMessage`.

An independently opened emailed link cannot reliably update the operator record. It does not server-load a versioned authorization through an expiring, revocable, purpose-bound token.

### 6. Search and dashboards are client aggregates

Current lists/search filter in memory. This may work for 15 stores but will not safely serve years of visits, work orders, files, PM records, and audits.

Production requires:

- Tenant/scope-constrained server queries.
- Indexed exact and text search.
- Stable/keyset pagination.
- URL-persisted filters.
- Server-calculated read models.
- Supporting-record filters returned with every aggregate.

### 7. Quality checks create false confidence

Current diagnostics pass:

- 51 tests.
- Type checking.
- Linting.

However, `test:e2e` is a Vitest domain test rather than a browser journey against the current app/API/database. The suite does not catch unreachable product surfaces or impossible event chronology.

## Data-integrity findings

The deterministic fixture contains 15 stores, five vendors, 55 work orders, 52 visits, 30 invoices, 75 assets, and 196 components.

The most severe current defect is an impossible active visit:

1. Technician checks in at 16:42.
2. Employee request is submitted at 17:00.
3. WO is created at 18:00.
4. Authorization is issued at 19:15.
5. Vendor accepts at 20:12.
6. Scheduled service begins the following day.
7. A future missing-checkout exception is already visible at the fixed 18:00 demo time.

The fixture validator checks only that checkout follows check-in. It does not validate the causal sequence request -> work order -> assignment -> issuance -> response -> schedule -> visit -> exception.

Other issues:

- All employee requests are already converted, so no realistic review queue exists.
- Completed visits have implausibly uniform evidence.
- Vendor response/evidence rates are unrealistically perfect.
- A vendor often appears to use one technician identity across every store.
- Today emphasizes invoice exceptions more than the requested visit-accountability wedge.
- `completed` is not consistently terminal, allowing completed work to appear open/active.

## Store 104 and lifecycle audit

The underlying Store 104 story is better than the UI suggests:

- Initial service, callback, and replacement are tied to the same compressor component.
- Three WOs represent five visits.
- The original component is marked replaced and a successor is active.
- The repeat issue references the source WOs.

The interface still fails to make the proof obvious:

- Components are not clickable source paths.
- Work/service rows omit component identity.
- The repeat exception is separately seeded rather than visibly derived from the same read model.
- The exact component-level WOs/visits are not shown together.
- A dead legacy asset detail still contains the simplistic repair-to-replacement presentation.

The newer lifecycle analytics are directionally correct because they separate:

- Age versus expected-life reference.
- Warranty/source.
- Reactive WOs/visits over defined periods.
- Confirmed same-component recurrence.
- Recorded completed-work cost.
- Clean invoice-linked cost versus questionable invoice amounts.
- Replacement-estimate share.
- Temporary/unresolved outcomes.
- PM context.
- Exact source IDs.

Production lifecycle should present:

1. Evidence facts.
2. Organization-defined thresholds.
3. Trigger reasons with observed value and threshold.
4. Exact supporting records.
5. Human decision and rationale.
6. Versioned capital-plan assumptions.

Never infer downtime, create one opaque health score, or automatically declare replacement.

## Reuse versus rebuild

### Retain as product learning

- C-store conceptual types and record separation.
- Pure analytics after validation, especially transparent lifecycle facts.
- Request, store setup, vendor picker, service authorization, technician flow, active visits, spend, and lifecycle component concepts.
- Corrected Store 104 same-component recurrence story.
- 15-store/five-vendor presentation shape.
- Existing Sites binding declarations while the preview remains active.

### Rebuild as production capability

- Main state container and local view router.
- All legacy API/domain/schema paths.
- Tenant/auth/security model.
- QR, geolocation, visit session, tokens, and private files.
- Messaging/outbox delivery.
- Search/list/aggregate architecture.
- Role/scope administration.
- Vendor accountability surfaces.
- Reports/exports.
- Fixtures and causal chronology validation.
- Real browser, API, database, authorization, accessibility, and failure-mode tests.

## Required implementation order

1. Establish the c-store domain as the only domain model.
2. Implement aligned schema, migrations, repositories, and server tenant context.
3. Add transactional domain commands with audit and outbox.
4. Implement secure vendor/store tokens, visit sessions, server time, event-only location, and private files.
5. Build server search, pagination, and dashboard read models.
6. Complete durable request -> WO -> assignment -> issuance -> response -> visit -> outcome/follow-up.
7. Add unmatched-visit reconciliation and real vendor/store accountability.
8. Add user/scope administration, bulk imports, support operations, exports, monitoring, and recovery.
9. Reintroduce cost, invoice, PM, lifecycle, and reports as optional modules on the same records.

The guided story remains valuable only as an end-to-end acceptance test of these real capabilities.
