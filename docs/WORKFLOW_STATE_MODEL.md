# Workflow State Model

**Status:** approved target; current Work Order status is transitional

## Separate four kinds of state

1. **Work Order lifecycle** answers where the canonical service record is overall.
2. **Child-record state** answers what happened to an assignment, estimate, visit, invoice, PM occurrence, warranty case, or Service Run.
3. **Workflow Task state** answers who must do what next and by when.
4. **Blocker/hold state** explains why progress is paused and which SLA clocks pause.

Do not encode all four in one status field.

## Target Work Order lifecycle

Canonical symbols are shown uppercase; storage may use normalized lowercase values if the API and UI translate them consistently.

| State | Meaning | Typical exit |
|---|---|---|
| `SUBMITTED` | A canonical Work Order exists; intake facts are preserved | Begin internal review |
| `REVIEWING` | Scope, impact, classification, duplicate/warranty/contract path, and ownership are being established | Authorization, dispatch readiness, rejection, or cancel |
| `AWAITING_AUTHORIZATION` | A governed approval obligation is open | Approval returns it to dispatch readiness; rejection follows policy |
| `READY_FOR_DISPATCH` | Scope is allowed to proceed, but no active execution has begun | Assignment/issuance or internal dispatch |
| `ACTIVE` | Authorized execution is in progress or waiting on an execution dependency | Vendor completion claim, cancellation, or continued active work |
| `AWAITING_VERIFICATION` | Provider claims completion; customer verification is outstanding | Verify to resolved; reject back to active with a new task |
| `RESOLVED` | Operational issue is verified resolved; administrative/financial obligations may remain | Close or reopen |
| `CLOSED` | Operational and required administrative obligations are complete | Governed reopen only |
| `REJECTED` | Intake/work was rejected with an attributed reason | Normally terminal; governed reconsideration creates history |
| `CANCELED` | Work was intentionally canceled with reason | Normally terminal; replacement work uses a new/reopened governed cycle |

Normal path:

```text
SUBMITTED -> REVIEWING -> AWAITING_AUTHORIZATION -> READY_FOR_DISPATCH
             |                   |                       |
             +-------------------+-----------------------+
                                                         v
ACTIVE -> AWAITING_VERIFICATION -> RESOLVED -> CLOSED
   ^                |
   +-- rejection ---+
```

`REJECTED` and `CANCELED` are reasoned branches. Emergency policy may move `REVIEWING` directly to `READY_FOR_DISPATCH` or `ACTIVE`, but it must preserve the policy/override decision and audit.

## States that do not belong on Work Order

Vendor accepted/declined, proposed date, scheduled, checked in, checked out, parts pending, quote pending, no access, invoice received/paid, and potential warranty are child state, open tasks, or blockers. Vendor checkout does not resolve, verify, or close work.

Presence, provider work claim, customer verification, operational resolution, financial completion, and administrative closure are separate facts.

## Accountable projection

Every nonterminal Work Order has exactly one internal accountable owner and at least one open Workflow Task or documented scheduled future event. A pure server projection selects the primary obligation and returns:

- lifecycle stage and plain-language sentence;
- accountable party type, ID, and label;
- primary next action code and label;
- due time or explicit no-SLA reason;
- escalation destination;
- blocker/hold explanation;
- supporting entity links.

Several Workflow Tasks may be open simultaneously. The projection chooses one primary action without deleting the others.

## Verification, rejection, reopen, and correction

- Provider completion moves work to `AWAITING_VERIFICATION` and preserves the Site Visit and claim.
- Verification rejection returns work to `ACTIVE`, creates a follow-up/Workflow Task atomically, and starts a new resolution cycle.
- `RESOLVED` means the operating result is verified; it does not imply invoice approval or payment.
- `CLOSED` requires all organization-configured closure obligations, but invoices remain optional when policy does not expect one.
- Reopening preserves every prior resolution and closure cycle.
- Closed facts are corrected by amendment/reversal/new version, never silent overwrite.

## Transition enforcement

A named server command must:

1. Apply organization, role, scope, and record-state authorization.
2. Load expected version/state.
3. Validate transition prerequisites and segregation of duties.
4. Write the lifecycle change and related tasks/child facts atomically.
5. Append Audit Events and outbox intents in the same transaction.
6. Return a stable receipt and updated accountable projection.

Invalid transitions fail without partial writes. UI visibility is not authorization.

## Current-to-target migration

| Current `WorkOrderStatus` | Target interpretation |
|---|---|
| `draft` | `SUBMITTED` or `REVIEWING`, based on preserved review facts |
| `awaiting_approval` | `AWAITING_AUTHORIZATION` |
| `approved` | `READY_FOR_DISPATCH` |
| `issued`, `accepted`, `scheduled`, `in_progress`, `waiting_on_vendor`, `waiting_on_parts` | `ACTIVE`; retain the specific fact on assignment/issuance/response/visit/task/hold records |
| `completed_pending_review` | `AWAITING_VERIFICATION` |
| `closed` | `CLOSED`; migration must preserve or create explicit resolution evidence rather than infer it silently |
| `cancelled` | `CANCELED` |

This migration is **not implemented**. Current scalar `accountableParty`, `nextAction`, `dueAt`, and `escalationTo` fields remain an interim compatibility model and must not be described as Workflow Tasks or SLA history.
