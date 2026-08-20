# ADR 0001: Selective Clean-Slate Modular Monolith and Portable Persistence

- **Status:** Accepted
- **Date:** August 20, 2026
- **Decision owners:** product and engineering

## Context

The repository contains valuable tenant-scoped domain behavior, audit/idempotency/concurrency concepts, direct/estimate separation, public vendor/visit workflows, deterministic fixtures, and D1/PostgreSQL persistence work. It also contains a session-era operator UX, a large full-snapshot presenter, several parallel application/domain stacks, preview-role authorization assumptions, and a PostgreSQL adapter that translates the D1-oriented SQL surface.

A wholesale rewrite would discard validated behavior and increase workflow risk. Incremental patching of the existing UI/state architecture would preserve contradictory sources of truth, poor authorization boundaries, and weak scale characteristics. Microservices would add deployment and consistency cost before the core domain is stable.

Current hosted preview requirements use Cloudflare D1 (`DB`) and R2 (`FILES`). The future deployment target is Render with PostgreSQL (`DATABASE_URL`) and S3-compatible private object storage. Domain behavior must not depend on either vendor.

## Decision

Use a **selective clean-slate rebuild** delivered as a **server-first modular monolith**.

1. Retain and refactor conforming `lib/ops` domain commands, estimate behavior, audit, idempotency, concurrency, visit/public-capability behavior, lifecycle rules, deterministic fixtures, and repository contract tests.
2. Replace the operator UX, generic/full-snapshot presenter path, scalar workflow model, preview authorization assumptions, and dead parallel application stacks.
3. Organize the monolith into explicit domain/application/read-model/infrastructure boundaries. Modules share named domain commands and transaction infrastructure, not a giant configurable interface.
4. Keep one canonical Work Order and one command path across operator, public store/vendor, trusted-device, future portal/API, and worker channels.
5. Define brand-neutral repository, file, identity, messaging, clock, and provider ports. Domain code cannot import Cloudflare, PostgreSQL, R2, or S3 APIs directly.
6. Preserve current Sites deployment with a native D1 adapter and R2 private-file adapter.
7. Support the Render target with a PostgreSQL adapter, PostgreSQL migrations, S3-compatible private storage, injected `PORT`, health/readiness endpoints, and idempotent migration/seed/worker entry points.
8. Treat the current D1-SQL-to-PostgreSQL compatibility layer as transitional. Replace it with a native PostgreSQL implementation behind the same behavioral contract as relevant slices are hardened.
9. Keep D1 and PostgreSQL schema/domain semantics aligned through migration and repository contract tests. Do not fork business behavior by backend.
10. Remove legacy stacks only after import/reference verification and replacement tests; preserve history in Git.

## Consequences

Positive:

- Validated workflow behavior survives the UX and query rebuild.
- Domain mutation, audit, and outbox intent can remain transactional inside one deployable service.
- Current preview hosting remains available while PostgreSQL portability advances.
- A 15-Store demo and approximately 65-Store fixture exercise the same domain boundaries.
- Modules can later expose APIs/workers without prematurely introducing distributed transactions.

Costs and risks:

- Transitional code exists while loaders/presenters and PostgreSQL queries are replaced.
- D1/PostgreSQL parity requires disciplined contract and migration tests.
- Removing parallel stacks demands import/reference auditing.
- A modular monolith can still become a large ball of mud unless feature boundaries and command/query ownership are enforced.
- The current compatibility adapter may hide SQL-dialect/performance differences; it cannot be the final production architecture.

## Rejected alternatives

- **Wholesale application rewrite:** rejected because conforming domain and persistence behavior is worth preserving.
- **Continue patching the session-scoped prototype:** rejected because it cannot provide durable multi-user state, server authorization, or bounded queries.
- **Microservices now:** rejected because the core workflows need transactional consistency and have not stabilized enough to justify distributed operations.
- **Cloudflare-only domain code:** rejected because Render/PostgreSQL/S3 portability is an explicit product requirement.
- **PostgreSQL-only cutover now:** rejected because the active Sites preview must retain D1/R2 bindings during the rebuild.
- **One universal repository implemented through permanent SQL translation:** rejected as the final state because native adapters need backend-appropriate queries, indexing, concurrency, and performance while sharing behavior contracts.

## Guardrails

- Organization boundary is explicit on every tenant-owned operation.
- UI handlers never write status directly; all channels call domain commands.
- No full tenant is loaded into the browser or used as the long-term screen query path.
- Audit/outbox intent and mutation commit together.
- Money and historical evidence follow the domain invariants.
- New modules/tables are added with complete vertical slices, not speculative schema breadth.
- No `render.yaml` is added until the Render project is intentionally created.
- Production never falls back to fixtures or ephemeral upload storage.

## Current implementation note

The modular-monolith/repository direction, D1 path, PostgreSQL compatibility path, R2/S3 boundary, and health/readiness routes exist. Feature-owned read models, native PostgreSQL queries, production identity, workers, clean reset/baseline, and removal of parallel stacks remain incomplete.
