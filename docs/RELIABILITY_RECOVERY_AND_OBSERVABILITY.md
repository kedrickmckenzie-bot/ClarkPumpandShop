# Reliability, Recovery, and Observability

**Status:** partial runtime foundation; production recovery and operations are not complete

## Current foundation

- Production runtime selection fails closed without D1 or PostgreSQL instead of silently using fixtures.
- D1 batches and PostgreSQL transactions provide atomic multi-record writes; the fixture commits from a clone.
- Public/mobile commands use idempotency and consequential Work Orders use optimistic version concepts in implemented paths.
- PostgreSQL migrations and seed bootstrap use advisory locks; D1/PostgreSQL seed markers prevent ordinary duplicate bootstrap.
- `/api/health` supplies liveness and `/api/ready` performs a sanitized persistence probe.
- Private R2 and S3-compatible file adapters exist behind a file-store boundary.
- Render deployment settings and isolation guidance are documented in [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md).

These are foundations, not production readiness. There is no outbox delivery worker, recurrence/escalation worker, `JobRun` registry, centralized structured logging/correlation, delivery/job dashboard, automated backup/restore drill, or validated rollback procedure.

## Reliability rules

- Transactional domain mutation, Audit Event, and outbox intent commit together.
- Jobs are idempotent by organization, job type, source/version, and recurrence slot.
- Outbox delivery records attempt count, next attempt, provider receipt, terminal error, and deduplication key.
- Notification retry cannot create a second Workflow Task or duplicate visible action.
- Expensive metrics, imports, exports, PM generation, SLA escalation, warranty/compliance expiration, and weather ingestion execute outside interactive requests with bounded work units.
- Lists/search use organization-scoped indexed filtering, stable ordering, pagination, and bounded exports.
- Production uploads never use ephemeral local disk.
- External providers sit behind adapters with explicit timeouts, retry policy, circuit behavior, and safe degradation.

## Observability contract

Structured events include timestamp, severity, environment/release, request/correlation ID, organization ID or irreversible safe surrogate, actor type, operation/command, aggregate type/ID, duration, outcome/error code, repository backend, and retry/idempotency context. Never log raw public tokens, credentials, sensitive attachment content, or unnecessary personal data.

Monitor:

- HTTP error rate and latency by route/operation;
- database availability, pool/query latency, transaction failures, and migration version;
- outbox age, attempts, failures, and delivery latency;
- PM/SLA/warranty/compliance/weather job freshness and failures;
- token denial/rate-limit patterns and suspicious enumeration;
- file upload/storage/scanning failures;
- import/export progress and reconciliation failures;
- invariant violations, audit write failures, and readiness state.

Alerts must route to an owned operational destination and, when a customer workflow is threatened, create a visible action/task rather than only an email.

## Initial performance objectives

Measure with representative pilot and approximately 65-Store fixtures; report p50/p95, sample size, backend, cold/warm state, and query count.

| Surface | Target p95 |
|---|---:|
| Common transactional API | under 750 ms |
| Work Order detail initial load | under 2 s |
| Overview/Control Tower initial load | under 3 s |
| Public sign-in | under 2 s |
| Global search | under 1.5 s |

Correctness and tenant isolation take precedence over superficial latency. Current full-snapshot operator reads are a known obstacle; these targets have not been validated.

## Backup and recovery

Customer production target objectives are **RPO no greater than one hour** and **RTO no greater than four hours** for the primary database and required private-file metadata/content. These are release targets, not achieved guarantees. Provider plans, retention, replication, object versioning, and staffing must support them before commitment.

A production runbook must identify database and object-storage backup owners; automated schedule/retention; encryption/access; schema/release association; point-in-time and full restore procedures; dependency order; token/secret rotation; integrity checks; customer communication; and evidence retention. A restore drill uses an isolated environment, verifies row/file/audit consistency and critical workflows, records actual RPO/RTO, then destroys the drill environment safely.

No restore drill or validated RPO/RTO evidence exists today. The platform must not be called production-ready until one succeeds.

## Deployment rollback

Deploy immutable release artifacts. Record schema compatibility for each release. Prefer forward-compatible expand/migrate/contract changes so the previous application can run during rollback. Stop deployment when migrations are destructive or irreversible without a tested restore path.

Rollback procedure: freeze writes if required, identify release/correlation window, restore the prior compatible application, verify readiness and critical reads/writes, replay/retry safe outbox work, reconcile audit/domain state, and record the incident. Database restore is a last-resort, evidence-backed recovery action—not the default application rollback.

The existing Render guide covers deployment bootstrap and isolation, not a validated application/database rollback drill.
