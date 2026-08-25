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

These are foundations, not production readiness. There is no recurrence/escalation worker, `JobRun` registry, centralized structured logging/correlation, delivery/job dashboard, automated backup/restore drill, or validated rollback procedure.

### Outbox delivery worker (implemented)

`runOutboxDeliveryCycle` in [`../../lib/ops/outbox-delivery.ts`](../lib/ops/outbox-delivery.ts) closes the delivery half of the transactional outbox:

- Recovers messages whose processing lease (`claimed_at`) expired without settlement, so a crashed worker cannot strand events.
- Claims due messages through a conditional `pending → processing` transition with attempt increment; a lost race is skipped, never double-settled.
- Delivers through an injected, idempotent-per-message transport. The only implemented transport is `createOperationalLogDeliveryTransport` — delivery means a structured operational-log event, **not** an email/SMS/vendor notification.
- Records outcomes atomically: delivered timestamps, retry with exponential backoff capped at one hour, or terminal `failed` after `maxAttempts` with retained last error for forensics.

Entry points: the Cloudflare Worker `scheduled` handler (D1) runs outbox delivery followed by SLA escalation, and `npm run jobs:postgres` (Render cron context) does the same against PostgreSQL. Both are safe to schedule repeatedly. Attempt counts, ages, and terminal failures are visible in `ops_outbox_messages`; job executions are recorded per organization+type+slot in `ops_job_runs`; automated dashboards/alerts on those signals do not exist yet.

### SLA escalation worker (implemented)

`runSlaEscalationCycle` in [`../../lib/ops/job-workers.ts`](../lib/ops/job-workers.ts) escalates overdue open Workflow Tasks by reusing the same governed `escalateWorkflowTask` domain command a human operator uses (system actor, audit event, outbox intent, version fencing):

- Candidates: open/in-progress tasks whose due time has passed, oldest first.
- Each organization+slot executes at most once (`ops_job_runs` unique on organization + `sla_escalation` + slot); the default slot is the UTC hour.
- Overdue tasks climb one escalation level per slot up to a ceiling; tasks already at the ceiling are counted and left untouched.


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
