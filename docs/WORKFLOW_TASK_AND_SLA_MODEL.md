# Workflow Task and SLA Model

**Status:** first-class reactive-loop implementation is active; advanced calendar/policy versioning remains incremental

The platform now persists first-class Workflow Tasks, SLA pause/resume facts, task audit events, and a deterministic primary-task projection. Work Order fields `accountableParty`, `nextAction`, `dueAt`, and `escalationTo` are compatibility fields projected from the selected primary obligation; they are not the history ledger. `internalAccountableParty` separately retains operator-side responsibility.

## Workflow Task

A Workflow Task is an explicit obligation attached to a tenant-owned record. It answers: who must do what, by when, why, and what proves completion.

Minimum data:

- `organization_id`, stable task ID, task type, related entity type/ID, and Work Order ID when applicable;
- assignee type (`user`, `team`, `role`, `store`, `vendor`, `system`) and assigned entity;
- internal accountable owner for the parent Work Order;
- created-by actor, creation time, priority, status, and blocking flag;
- plain-language action/reason and structured completion criteria;
- due time or an explicit versioned no-SLA policy;
- applicable SLA clock and policy/version snapshot;
- escalation policy/destination;
- completion actor/time, result code, and note;
- cancellation/supersession reason where applicable.

Suggested task states are `OPEN`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELED`, and `SUPERSEDED`. A blocked task does not change the Work Order lifecycle on its own.

Examples include intake review, approval, vendor response, schedule confirmation, store access, quote submission, part/return scheduling, repair verification, warranty review, invoice-exception review, and Service Discrepancy response.

## Invariants

- Every nonterminal Work Order has exactly one internal accountable owner.
- Every nonterminal Work Order has at least one open Workflow Task or a documented scheduled future event.
- Every open task has an assignee type, visible reason, completion criteria, and due time or explicit no-SLA rule.
- Simultaneous obligations coexist; completing one cannot overwrite another.
- Task completion and the source domain change commit atomically.
- Reassignment, escalation, cancellation, and completion append audit history.
- Closed Work Orders have no unexplained open blocking task.
- A primary next-action projection selects one task for the header while retaining all open tasks in the record.

## SLA policy and clocks

Version SLA policies. A clock references the exact version that governed the obligation. Policies may vary by organization, store/region, contract, priority, work type, emergency status, and calendar.

Required clocks, introduced only with the workflow that needs them:

| Clock | Start | Stop |
|---|---|---|
| Intake review | Issue/Work Order submitted | Review decision recorded |
| Approval | Approval Request created | Final decision or governed cancellation |
| Vendor response | Issuance/Service Run sent | Accepted, declined, countered, or policy-defined response |
| Scheduling | Work becomes schedulable | Committed appointment recorded |
| Arrival | Committed window/dispatch point | First eligible Site Visit check-in |
| Operational restoration | Policy-defined impact start | Verified restoration event |
| Completion | Authorized execution starts | Provider completion claim |
| Verification | Provider completion claim | Customer verification decision |
| Invoice submission | Policy-defined completion/close event | Expected invoice received or expectation waived |
| Warranty response | Warranty Case routed | Provider/administrator response |
| Discrepancy response | Response requested | Response submitted or governed closure |

Calculations use the Store's timezone, business hours, holidays, Contract calendar, priority, and applicable target. Store UTC instants plus the governing timezone/calendar version. Never compute contractual duration from the viewer's browser timezone.

## Holds and pauses

Each hold records:

- structured reason and owner;
- start time and expected resume time when known;
- which clock instances pause and which continue;
- policy/version authorizing the pause;
- resume actor/time and note.

Examples include customer access unavailable, approved parts delay, manufacturer delay, customer-requested reschedule, and governed scope clarification. A free-form “on hold” status is insufficient. Vendor-caused delay must not be excluded from a scorecard unless a structured rule supports it.

## Escalation

An idempotent scheduler evaluates due clocks and creates an escalation record, visible Workflow Task or task priority change, and Audit Event. Notification is a delivery channel, not the operational record. Retries must not create duplicate tasks or duplicate user-visible notifications.

Escalation rules cover at least unreviewed intake, overdue approval, vendor response, schedule confirmation, PM risk/miss, no-show, verification, warranty response, invoice exception, compliance expiry, and failed delivery/job runs that threaten a must-win workflow.

## Implemented slice and remaining policy depth

The reactive-loop slice includes task records, deterministic projection, SLA clock identifiers, pause/resume facts, held-work obligations, audit/outbox intent, tenant-scoped commands, idempotent scheduled evaluation, and fixtures covering overdue, paused, simultaneous, escalated, completed, and no-SLA examples. Further calendar/contract policy version depth should extend these records rather than create a parallel task engine.
