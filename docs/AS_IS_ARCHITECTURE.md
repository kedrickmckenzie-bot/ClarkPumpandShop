# As-Is Architecture

**Snapshot date:** August 20, 2026  
**Purpose:** factual repository inventory, including the active worktree; not a production-readiness claim

The approved direction is in [CSTORE_PLATFORM_REBUILD_BLUEPRINT.md](CSTORE_PLATFORM_REBUILD_BLUEPRINT.md) and [ADR 0001](adr/0001-selective-clean-slate-modular-monolith-and-portable-persistence.md). This document describes what exists now.

## Runtime and stack

| Concern | Current implementation | Boundary |
|---|---|---|
| Web | Next.js 16, React 19, TypeScript 5.9 | Operator routes under `app/app`, public flows under `app/public`, route handlers under `app/api` |
| Sites preview | Vinext/Vite on Cloudflare Workers | `.openai/hosting.json` binds D1 as `DB` and R2 as `FILES` |
| Render path | Standard Next.js Node runtime | PostgreSQL through `DATABASE_URL`; S3-compatible private files through an adapter |
| Schema/migrations | Drizzle schema definitions plus D1 and PostgreSQL migration histories | Histories are cumulative, not a clean reset baseline |
| Testing | Vitest domain, repository, route, presenter, and limited journey tests | `test:e2e` is a selected Vitest suite, not full browser automation |
| Local data | Deterministic in-memory fixture | Resets when the process restarts; it is not a production state container |

## Current request path

```text
Operator/public route
  -> loader or route handler
  -> domain command / presenter
  -> OpsRepository contract
  -> fixture, D1, or PostgreSQL adapter
  -> audit/outbox rows in the command write set
```

Durable mutations use organization-keyed repository calls and batched atomic writes. The fixture repository clones before commit; D1 executes a batch; PostgreSQL executes the same statement set in a transaction.

The operator **read** path is weaker: it commonly reconstructs an entire organization fixture from D1/PostgreSQL, then passes that snapshot through a large generic presenter. Although bounded repository query methods exist, the active operator surfaces do not consistently use feature-owned query services, indexed filtering, or stable server pagination.

## Persistence

The active operations schema includes organizations, divisions, regions, taxonomy, stores, users/memberships/scope grants, vendors/coverage/specialties, requests, Work Orders, assignments, issuance revisions, vendor responses, approval policy/request/decision records, competitive estimate requests/proposals, visits/evidence, files, follow-ups, exceptions, assets/components, replacement records, PM plans/occurrences, cost lines, invoice references/allocations, audit, outbox, public tokens, idempotency keys, and Work Order counters.

Important limitations:

- PostgreSQL currently reuses the D1 SQL repository through a compatibility/translation layer. Transactions are real, but a native PostgreSQL query adapter is still target work.
- The operator snapshot path loads far more data than a screen requires.
- D1 and PostgreSQL migration histories have not been replaced with one clean baseline.
- `npm run db:seed` validates deterministic fixtures; it does not reset or seed a database.
- Hosted D1 and PostgreSQL bootstrap seeding are idempotent. A guarded PostgreSQL development/demo reset command now requires explicit environment classification and exact database-name confirmation; D1 reset and a live reset drill remain absent.

## Implemented service foundation

- Organization-keyed repository methods and stable IDs separate from store numbers.
- Simple request intake and canonical operator Work Orders with deferred classification.
- Internal, outside-vendor, and choose-later assignment.
- Immutable/versioned service-authorization issuance and attributed vendor response.
- Competitive estimate requests, immutable proposal revisions, one selected vendor, and separation from service authorization.
- Accountless, narrow public capability projections using hashed tokens.
- Channel-independent check-in/out, point-in-time location observations, evidence, unmatched/no-WO exceptions, and atomic unresolved follow-up.
- Money in integer minor units with currency; separate NTE, repair estimate, recorded cost, invoice reference, and allocation records.
- Audit, outbox-intent, idempotency, and optimistic-concurrency concepts.
- Equipment templates/assets/components, thin PM plans/occurrences, and transparent replacement analytics/benchmark records.
- Fixture, D1, and PostgreSQL persistence paths; private R2/S3-compatible file boundaries; health and readiness routes.
- Deterministic Northline fixture with exactly 15 stores, three regions, five outside vendors, and two internal technicians, plus one-store/65-store-oriented fixture behavior in tests and seed code.

Approval governance is **partial in the active worktree**: versioned policies, immutable requests/decisions, schema, fixtures, tests, and evidence/admin surfaces exist; the operator decision API/UI is still being completed and must be validated before the slice is called complete.

## Material gaps

| Area | Current state |
|---|---|
| Identity/authorization | ChatGPT identity headers may identify a user, but Northline membership and role are selected from a preview cookie with fallback identity. This is not production authentication or general tenant membership resolution. Some mutation routes check role and store/region scope server-side; coverage is not universal. |
| Work lifecycle | Current Work Order status contains provider/scheduling/parts states. `accountableParty`, `nextAction`, `dueAt`, and `escalationTo` are scalar fields. The target broad lifecycle plus Workflow Tasks is not implemented. |
| Multi-work execution | A visit currently holds one optional `workOrderId`; `SiteVisitWorkOrder`, Service Run, Route Stop, per-Work-Order checkout outcome, and bundle counterproposal do not exist. |
| PM/scheduling | PM plan and occurrence records exist. Programs, versioned obligations, asset-level Work Items, recurrence workers, capacity, contracts, and Service Run scheduling do not. |
| Contracts/warranty | Vendor specialty/coverage and simple asset/component warranty dates exist. Contract Versions, rate cards, qualifications/compliance, Repair Items, scoped warranty rules, Applied Warranties, Warranty Cases, and routing safeguards do not. |
| Finance | Competitive proposals, NTE, cost lines, invoice references, and allocations exist. Versioned Quote/Authorization revisions, invoice lines, full reconciliation/holds/credits, and source-linked realized Value Events are incomplete or absent. No payment execution exists, by design. |
| Jobs/delivery | Outbox rows exist, but there is no delivery/retry worker, PM recurrence worker, SLA escalation worker, job-run registry, or operational monitor. The Cloudflare worker is the web/image entry point only. |
| Imports/reset/recovery | No structured import pipeline, guarded destructive reset, validated backup restore, approved RPO/RTO evidence, or deployment rollback drill exists. |
| UI/query architecture | Enterprise styling and dedicated workspaces are in progress, but the generic presenter/full-snapshot path and parallel legacy/c-store stacks remain active in the tree. |

## Duplicate and transitional concepts

- The active `lib/ops` domain is the retained foundation. `lib/cstore`, `lib/domain`, `lib/demo`, `lib/platform`, `components/cstore`, and unreachable root component stacks contain older or parallel concepts and should be removed only after import/reference verification.
- Current `ServiceRequest` is a source intake record; it must not become a second maintenance lifecycle.
- Current status names such as `issued`, `accepted`, `scheduled`, and `waiting_on_parts` are transitional Work Order lifecycle values; target design moves those facts to assignments, visits, tasks, and blockers.
- Current `VisitSession` represents both presence and one Work Order outcome. Target design separates shared Site Visit presence from `SiteVisitWorkOrder` outcomes.
- `InvoiceReference` is an optional evidence safeguard, not a complete Invoice/AP model.

## Preserve, replace, and retire

Preserve and refactor tenant-scoped domain commands, audit/idempotency/concurrency behavior, issuance and estimate versioning, public visit/vendor behavior, lifecycle rules, repository contract tests, persistence adapters, private-file boundary, and deterministic causal fixtures.

Replace the operator UX/query path, scalar next-action/status model, preview identity assumptions, D1-to-PostgreSQL SQL translation as the long-term adapter, and thin PM/finance/equipment projections.

Retire parallel legacy application/domain stacks after their imports are proven unused. Preserve history in Git; do not keep unreachable systems in active compilation.
