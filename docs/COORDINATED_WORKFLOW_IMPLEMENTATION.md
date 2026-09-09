# Coordinated Workflow Implementation Contract

**Status:** implementation contract for the coordinated workflow and usability overhaul
**Date:** September 8, 2026
**Authority:** `AGENTS.md`, `CSTORE_PLATFORM_REBUILD_BLUEPRINT.md`, and the active implementation brief

## 1. Existing behavior

The active application already has one canonical operator Work Order, tenant-scoped commands, first-class Workflow Tasks, append-only visit outcomes, customer verification, held work, invoice review, audit events, idempotency fences, and role-scoped projections. Those are retained.

The important inconsistency is presentation and compatibility state:

- `WorkOrder.accountableParty` is used both for the internal person accountable for the case and for the person or company expected to act next.
- Task projection and several vendor-response/visit commands overwrite that scalar with a vendor name.
- The Work Order header calls the result “Owner,” so “waiting on a vendor” can visually remove internal accountability.
- Service stage, observed operating condition, and financial review are shown in different areas but do not share one explicit projection contract.
- The stage rail describes system phases; it does not always state the current conclusion in plain language.
- Several concurrent tasks can exist, but the record header discloses only one and does not say that additional obligations remain.
- Store intake, held work, visit outcomes, verification, and value evidence are individually strong but need consistent wording and drill-through rules.

## 2. Target contract

Every unresolved Work Order projects one `CoordinatedWorkState` from persisted source facts. The projection is read-only; users change facts through domain actions, never by selecting a technical lifecycle label.

### Internal accountability

- `internalAccountableParty` is the operator-side person or team responsible for making sure the Work Order advances.
- It remains internal while a vendor, store, finance reviewer, or other party owns the next action.
- Existing records without the new field use a compatibility fallback and are migrated to a facilities owner without rewriting history.

### Primary and concurrent obligations

- `nextAction` is the meaningful action that advances the service story.
- `nextActionOwner` is derived from the selected open Workflow Task, visit follow-up, appointment, or provider response.
- Primary-task selection is deterministic: blocking, required-for-progress, priority, due time, in-progress state, creation time, then stable ID.
- Other open tasks remain visible as `additionalObligations`; selecting a primary obligation never deletes or hides the rest.
- A task has either a due time or a recorded no-SLA policy reason.

### Escalation

- The projection names both the escalation destination and trigger.
- An overdue external obligation remains assigned to the external actor for the action, while the internal owner receives the follow-up responsibility.
- Scheduled escalation and notification jobs use existing idempotency keys and open-task checks so retries do not create duplicate obligations or alerts.

### Service progress

`serviceProgress` is derived from assignments, issuance revisions, vendor responses, appointments, active visits, per-work outcomes, verification decisions, follow-ups, and terminal facts. Plain-language conclusions include:

- Needs a provider.
- Ready to send to the selected provider.
- Waiting for vendor acceptance.
- Vendor asked a question.
- Scheduled for the recorded appointment window.
- Technician onsite.
- Waiting on parts or a return date.
- Temporary repair completed; permanent repair pending.
- Work reported complete; confirmation needed.
- Work verified complete.
- Cancelled.
- Closed.

`resolved` means the latest service result has been verified. `closed` means required operational and administrative obligations are complete. A rejected verification preserves the completion claim and evidence, returns service to active follow-up, and starts another resolution cycle. Reopening preserves earlier resolved/closed facts.

### Observed operating condition

`operatingCondition` is separate from service progress. It is derived only from an explicit business-impact assessment, a per-work visit outcome, or a verification decision and includes source, observed time, and certainty. No condition or downtime is inferred from a Work Order status. “Unknown” is a valid result.

### Verification

- Ordinary repair: a store manager may confirm the observable result.
- Technical maintenance/PM: an authorized reviewer checks the required technical evidence or checklist.
- High-impact or repeat work: explicit facilities review is required.
- Low-risk routine work: lighter acknowledgement is allowed only when the configured policy permits it.
- Rejection appends a verification decision and corrective obligation; it never edits or deletes the provider claim.

### Financial review

`financialReview` is derived independently from recorded costs, linked invoice evidence, allocations, and open exceptions. Values include no evidence expected/recorded, cost recorded, invoice unmatched, invoice under review, and review clear. Financial evidence never marks service successful, operating, resolved, or closed by itself.

### Role projections

- Store manager: local problems, expected/onsite providers, information requests, observable confirmations, and store history.
- Facilities: actions owned internally, actions waiting on others, scheduled/onsite work, verification, overdue blockers, and provider decisions.
- Regional manager: granted-store comparison, significant unresolved work, delegated decisions, and store follow-up.
- Executive: material exceptions, changes, exposure, repeat work, capital decisions, and verified value; routine dispatch controls are suppressed.
- Finance: recorded cost, invoice matching, authorization differences, clarification evidence, and reviewed financial outcomes.
- Vendor/technician: only eligible authorized work, response/scheduling, check-in, per-job outcomes, and checkout.

Location scope is applied before all summaries, queues, search results, counts, and record links.

## 3. Intake and creation rules

The ordinary intake path is Store → observed problem → impact → manager review/next action.

- Store employees report symptoms and business impact; category, component, equipment, trade, and vendor remain optional.
- Unknown impact answers are valid. Conditional questions appear only when their answer is relevant.
- Authorized managers can route to internal maintenance, a direct outside vendor, competitive bids, approved-for-later, or choose later.
- Vendor suggestions use approved status, specialty/aliases, store or region coverage, preferred relationships, and restrictions. The UI explains the matching facts; the operator chooses.
- Related open Work Orders are displayed before creation. Linking adds the new report to the existing Work Order while preserving both source reports; records are never silently merged.
- Authorization/NTE and approval safeguards remain enforced by commands.

## 4. Visit outcome rules

One visit may cover several eligible Work Orders, each with its own immutable outcome.

| Technician outcome | Derived service behavior | Next obligation |
|---|---|---|
| Completed | Provider claim preserved | Proportionate customer verification |
| Temporary repair | Current operating observation preserved | Permanent repair plan/return responsibility |
| Waiting on parts | Work remains active | Named parts/return owner and next update date |
| Quote/approval needed | Work remains active | Operator quote or approval decision |
| Could not complete | Blocker preserved | Operator/vendor corrective action |
| Could not reproduce | Uncertainty preserved | Observation or manager review |
| Not attempted | Work remains unresolved | Return to the correct active/held queue |

Technicians record facts and dates they know. Internal ownership and escalation are derived from operator policy. Retry keys fence check-in, checkout, per-work outcomes, and follow-up creation.

## 5. Approved-for-later rules

Held work retains internal accountability, authorization posture, review deadline, vendor eligibility, and conflict protection. It is visible only to a suitable vendor during a matching scheduled or active visit. A claim does not expose internal invoice-review thresholds. Each item receives an independent outcome. Unattempted work returns to the held queue; expired work escalates once through the task scheduler.

## 6. Cross-screen consistency

- Open: every state except `closed` and `cancelled`; resolved work remains visible until administrative close.
- Service-resolved: latest completion cycle is verified.
- Closed: operational and configured administrative obligations are complete.
- Periods use an inclusive start and exclusive end instant, displayed in the governing store/organization time zone.
- “Unlinked” equipment/component filters mean SQL `IS NULL` and the equivalent fixture predicate, never a literal ID.
- Principal metrics carry scope, period, basis, and exact record filters in their links.
- Recorded cost, authorization/NTE, linked invoice, unmatched invoice, identified exposure, estimated opportunity, confirmed outcome, and realized value remain distinct.
- Verified value always links to the value ledger filtered to verified source events.

## 7. Implementation changes

1. Add the stable internal-accountability field and compatibility migration.
2. Create one coordinated Work Order projection for service, operating condition, verification, finance, primary action, escalation, and concurrent obligations.
3. Use that projection in the Work Order case header, action queues, role dashboards, and relevant tables.
4. Keep domain actions semantic: assign, send, respond, schedule, record outcome, verify/reject, resolve, close, reopen, or cancel.
5. Correct query-first null filters, visit filter controls, period boundaries, and verified-value drill-through.
6. Add scenario and projection tests for external ownership with internal accountability, temporary repair, missed vendor update without duplication, held work, verification rejection, linked related reports, exact metric drill-through, role scope, and retry safety.
7. Update superseded workflow documentation and run the complete repository quality gate plus desktop/mobile browser walkthrough.

## 8. Compatibility

The existing Work Order status and `accountableParty`/`nextAction` scalar projection remain readable during migration for repository and API compatibility. New UI uses the coordinated projection. Existing append-only tasks, visits, verification decisions, audit events, invoices, and value events are not rewritten. D1 and PostgreSQL receive equivalent additive migrations; no destructive data migration is required.

## 9. September 2026 completion pass

The coordinated review and implementation pass closed the identified correctness and navigation regressions without returning the ordinary list experience to tenant-wide fixture loading.

- A newer visit cycle without an outcome now invalidates an older verified completion. The case header, verification command, and closure rules all evaluate the complete ordered set of per-work visit cycles.
- Work-order financial review attributes only the current work order's allocated invoice-line exceptions to that job. Other invoice-line findings stay with their own jobs, while invoice-level adjustments are labeled as shared and are not silently included in realized value.
- Default Work Orders, Visits, and Stores use scoped repository aggregates for summary bands. Counts describe the scoped portfolio while result counts describe the active filter or search. Visit review links now execute a real bounded query.
- Facilities users can discover approved held work, switch into the held portfolio, identify stores with several eligible jobs, open the combined-visit planner, and return to the exact prior list context. The normal held-work path remains query-first and shows authorization posture, review deadline, and persisted internal owner.
- Work orders now persist a structured internal accountable membership or supported team identity. Reassignment validates role and store scope, fences stale versions, moves internally owned tasks, preserves vendor-owned next actions, redirects escalation, and writes the record, tasks, projection, audit event, and outbox event in one transaction.
- The stale-cycle, invoice attribution, held-work journey, scoped ownership, vendor-preservation, stale-version, forbidden-role, and out-of-scope cases have direct behavioral regression coverage.

### Checks run

All required repository gates ran successfully on September 8, 2026:

| Check | Result |
|---|---|
| `npm run db:seed` | Passed; deterministic 15-store/5-vendor presentation data and 65-store scale fixture seeded |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm test` | Passed; 111 files and 733 tests |
| `npm run test:e2e` | Passed; 4 files and 44 tests |
| `npm run build` | Passed with the Vinext duplicate emitted-CSS filename warning |
| `npm run build:render` | Passed with Next.js 16.3, including type checking and static generation |

The browser walkthrough covered:

- Facilities Work Orders, the held-work portfolio, combined-visit creation, preserved return context, Visits summaries, and persisted owner reassignment controls.
- Store manager Overview and Work Orders at Store 104 scope, including the absence of facilities-only held-work controls.
- Finance invoice review language, exact source rows and amount bases, and the explicit boundary that review does not approve or execute payment.
- Executive Overview and the recorded-cost drill-through to its exact Spend source records, with routine dispatch controls suppressed.
- Central regional Stores search, where one filtered result remained distinct from five portfolio-wide stores.
- Narrow/mobile navigation and role switching.
- The external vendor authorization and technician check-in path, including the operator work-order billing reference, assigned-vendor scope, no-account access, one-result-per-job explanation, and check-in/out-only location disclosure.

### Remaining limitations

- The advanced confirmed-opportunity and review-window analysis modes still use a compatibility snapshot. Default lists and the ordinary multi-store held-work workflow are bounded and query-first; those specialized projections should move to dedicated aggregate read models before production-scale use.
- The additive D1 migration stores the structured owner pair without a database `CHECK` constraint because rebuilding the referenced work-order table would make this compatibility migration destructive. Domain commands enforce the invariant, and PostgreSQL has the database constraint.
- The visible role picker, deterministic tokens, outbox delivery, production identity, accounting integration, and native applications remain demonstration boundaries described by the blueprint.
- Automated end-to-end tests exercise mutations; the manual browser pass intentionally avoided changing the shared deterministic demo state.
