# Request Acknowledgment and Optional Work Linking

**Status:** implemented completion contract
**Date:** September 9, 2026
**Authority:** `AGENTS.md`, the platform rebuild blueprint, and the additional acknowledgment scope

## User contract

A store report remains an immutable source report. Similar reports are never automatically merged or discarded. An authorized store, regional, or facilities manager with the request-review capability now has two direct paths:

1. **Aware — being handled** records acknowledgment without linking work.
2. **Acknowledge and link** associates the report with one explicitly selected, non-terminal Work Order at the same store.

Neither path requires a note, equipment classification, spending authorization, or a new Work Order. The UI begins with a blank work-order choice, offers a compact related-work list, and provides a separate query-first search/pagination page for the store's active work. Suggestions are presented as possible context, never as duplicate proof.

## Persisted facts and invariants

- `acknowledged_at` and the acknowledging actor type, ID, and name are durable request facts.
- `linked_work_order_id` and the linking actor/time are separate from `converted_work_order_id`. A linked report is additional evidence; a converted request is the source of canonical work.
- A request cannot be both converted and linked as an additional report. Work-order creation rejects a request that already has a related-work link.
- Link targets are tenant-scoped, same-store, and non-terminal. Replacing an incorrect link requires a reason and appends an audit event containing the previous and replacement IDs.
- Every request mutation advances the optimistic version and commits the domain state, audit event, outbox record, and task changes in one transaction. The existing request fence prevents competing managers from producing contradictory links or duplicate follow-up tasks.
- A routine acknowledgment completes the existing intake-review task but creates no Work Order, assignment, issuance, visit, outcome, cost, approval, follow-up, vendor reminder, or notification promise.
- Emergency priority, potential/immediate safety, potential/confirmed compliance, and unable-to-operate reports retain their active exceptional review obligation after acknowledgment.
- Acknowledgment leaves priority, original problem, employee identity, impact history, evidence, timestamps, and later operational facts unchanged.

## Follow-up and visibility

The request detail and list show the exact state **Acknowledged — being handled**, actor/time provenance, and either the linked Work Order or **No linked work order**. The normal request list includes **Acknowledged without linked work** as a first-class filter.

Aging does not reopen an acknowledged report. **Request follow-up** requires an explanation, returns the report to under review while preserving acknowledgment history, and creates exactly one assigned, due `review_issue` task. A retry reuses the active task; concurrent attempts are version-fenced.

The Work Order record lists every linked source report. Linking does not authorize scope, prove a duplicate, verify a repair, create a visit, or resolve the report.

## Reporting boundaries

These remain distinct concepts: reports submitted, reports acknowledged, acknowledged reports with no linked work, reports linked to existing work, and reports converted into new canonical work. The implementation does not relabel any of those as completed repair or successful service.

## Operational caveats

- The outbox records internal domain events, but this pass does not claim external email/SMS delivery or notifications.
- The 15-store fixture remains demonstration data. D1 and PostgreSQL migrations persist the new facts; production identity and import readiness remain governed by the rebuild blueprint.
- Link correction currently means replacing the association with another active same-store Work Order. Source audit history remains append-only.

## Verification coverage

Focused tests cover quick acknowledgment, harmless retry, report preservation, exact unlinked filtering, optional/later linking, no service-side effects, reasoned link correction, second-work prevention, follow-up deduplication, exceptional obligation preservation, role/capability and store-scope routing, unsafe/missing form input, and concurrent manager actions.

## Verification results

The full required command suite passed on September 9, 2026: deterministic seed validation, type checking, lint, 765 unit/behavioral tests, 44 end-to-end/boundary tests, the Vinext/Cloudflare build, and the Next.js/Render portability build.

The browser walkthrough exercised the companywide request queue, quick acknowledgment, actor/time provenance, retained safety obligation, the acknowledged-without-work state, blank related-work selection, query-first store-work search, explicit linking, correction-reason controls, return navigation, and the inbound linked-report table on the Work Order. A true 390×844 viewport confirmed that the related-work browse/search/link controls remain usable without desktop-only interaction.
