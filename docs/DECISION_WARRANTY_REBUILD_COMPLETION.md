# Repair-or-replace and warranty workspace rebuild

## What changed

The repair-or-replace decision is now a full page with normal document scrolling. The former fixed modal compressed content rows while hiding overflow, leaving price headings visible but clipping values and lower evidence. The replacement page shows repair price, approved or selected replacement price, and the separate planning estimate before the detailed comparison. Section links reach quotes, related repairs and warranty, methodology, and recorded decisions.

The presentation example shows **$18,000 repair**, **$32,800 approved replacement**, and **$32,852.78 planning estimate**. These are source-derived amounts, not interchangeable cost bases. Approval pins its original quote revision and approved amount; a newer unapproved quote or changed planning benchmark cannot overwrite it. Scope, exclusions, lead time, alternative status, and exact quote links are visible. Missing prices remain missing; genuine zero and currency distinctions are preserved. Closed replacement work retains its evidence, while a later repair does not inherit the earlier approval.

The warranty task is now **Check the diagnosis and warranty**. Action-center and work-task links open the exact case at its diagnosis section when the relationship is unambiguous. The page assembles the current problem, recorded diagnosis or explicit missing diagnosis, earlier repair and real work-order reference, installed part, repair cost, warranty terms, provider requirement, and invoice hold. Technician notes and earlier work can be reached directly. A repeated complaint is not presented as a confirmed repeat failure.

Managers record what failed, what the warranty pays for, the supporting reason, and whether to retain or release the invoice hold. The server derives customer responsibility from the coverage choice, including ordinary form submissions without client-generated fields. An invalid or omitted hold choice cannot release the hold. An existing decision can be updated with a new audited reason; earlier facts remain. Saving does not close the work order or approve payment. Corrected warranty terms are identified and correction history remains visible. Technical detection details are secondary.

## Boundaries

Tenant and location scopes remain enforced; unassigned restricted roles fail closed. Ambiguous multiple-case tasks retain the ordinary work destination rather than choosing an arbitrary case. Existing domain mutation, audit, routing, and invoice safeguards remain in use. This does not add automatic diagnosis, independent per-charge adjudication, payment approval, dispatch, or a new asset subsystem.

The lifecycle page no longer loads the planning register and nested record models behind a modal. Its remaining compatibility snapshot read is not a production performance guarantee. Missing diagnosis and quote details require actual source evidence; the UI does not fill those gaps with assumptions. Local fixture work numbers differ from older hosted data, and links use stable record IDs.

## Validation

- Passed `npm run db:seed`, `npm run typecheck`, `npm run lint`, `npm test` (128 files / 852 tests), `npm run test:e2e` (4 files / 46 tests), `npm run build`, and `npm run build:render`.
- `npm run test:routes` rendered 136 routes with no failures. This is an HTTP audit, not browser interaction coverage.
- The final server-derived charge-field correction received another typecheck, lint, targeted regression run (2 files / 8 tests), and Vinext build. The Render build and route audit also completed after that correction.
- Regression cases cover pinned approval revisions, missing quote details, newer quotes and changed planning estimates, genuine zero, currencies, closed replacement work, subsequent repair work, tenant/location restrictions, current audited diagnosis, exact task links, explicit hold validation, retained and released holds, stale client charge fields, audit preservation, and unchanged work/payment state.
- Browser inspection used desktop 1280 x 720 and mobile 390 x 844. Verified visible price values, ordinary scrolling to decision history, mobile warranty form and section anchors, action-center task to exact diagnosis case with return context, earlier repair in-place review, and the exact approved quote anchor including its scope and exclusions. Mobile pages had no horizontal overflow; the viewport was restored.
- Browser inspection did not submit a warranty decision to the shared local demo. Route/domain integration tests exercised saving and updating the diagnosis and hold. The broader workflow suite remains automated coverage; earlier connected-workflow browser checks are documented separately and are not represented as newly repeated here.

This pass is local only. No push or deployment was performed, and `dev4.log` was preserved.


## Connected decision follow-up

The next pass addresses the review of `b75916d`:

- Warranty review tasks are shared by a work order. Deciding or updating one case leaves those tasks open while another active case still needs diagnosis or a coverage decision. The last completed review clears the shared obligation. An invoice hold remains an independent fact. The existing atomic work-order version guard and audit transaction are retained.
- Saved corrections now show their actual note or structured values beside the relevant original coverage category, with the author, time, reason, and earlier corrections. Later conflicting corrections take precedence; unchanged original terms remain available. Marking coverage unavailable explicitly warns against relying on the original coverage. The equipment evidence summary also includes saved correction values. A correction submission returns to the case it came from instead of arbitrarily selecting a sibling case.
- The decision page explains recorded activity, the most recent structured repair when available, scoped costs, missing cost entries, and unresolved warranty review. Each statement links to supporting records or an exact on-page evidence section. Similar symptoms are not presented as a diagnosed repeated failure.
- Whole equipment, components and descendants, and component-unspecified work can be reviewed on the decision page for 12 months, 24 months, or all recorded dates. Desktop uses scope links; mobile uses a compact selector. Scope and period remain in the URL through history and cost pagination. The selected component total is part of the whole-equipment total, never added to it.
- History explains the recorded problem, structured cause/action if available, per-job outcome, applicable manager verification, and cost in the selected period. Work with missing costs is explicit. Cost lines use service dates; invoice totals and repair-item subtotals are not added to them. A quiet period does not establish recording coverage. Current outcomes and options may be later than the selected activity window.
- Next-action buttons name the actual canonical step. A routine repair is not forced into replacement pricing just because it lacks a replacement quote. Pricing requests remain available explicitly. Component evidence selection does not silently change the quote's approved scope or assign a whole-equipment quote to a component.
- Full histories, cost lines, warranty references, current options, calculations, and decision activity are expandable. Evidence links open the relevant detail, including cost lines in stable 20-row pages. Wrapped mobile warranty links have a continuous tap target. A warranty review opened from a decision can return to the same component and period after a decision or correction save; return paths are restricted to local lifecycle decisions.

Follow-up validation:

- Passed `npm run db:seed`, `npm run typecheck`, `npm run lint`, `npm test` (**129 files / 859 tests**), `npm run test:e2e` (**4 files / 46 tests**), `npm run build`, and `npm run build:render`. The final whole-equipment cost-link refinement received another four regression tests and both builds. `npm run test:routes` checked **136 routes with no failures**; this is an HTTP render audit rather than browser interaction coverage.
- Browser inspection covered desktop 1280 x 720 and mobile 390 x 844: component selection, period retention, separated equipment/component costs, expandable repair outcomes, cost evidence, warranty handoff and return, and readable mobile layouts without horizontal overflow. Store 104 showed $24,495 whole-equipment / $24,110 compressor cost over 12 months; 24 months changed the whole-equipment total to $25,155 and preserved the compressor selection.
- Broader read-only browser checks covered manager search and in-place work review, store creation, deferred work routing, public vendor recorded-response safeguards, store-started visit continuation to per-job checkout outcomes, no-work-order intake, invoice evidence/hold, PM schedule navigation, and responsive store views. No mutation was submitted to the shared demo. Automated integration tests exercise multi-case task completion, amendment saves, invalid case IDs, actual correction rendering, and preserved decision context.

Remaining limits: costs follow recorded work/component classification and do not allocate individual parts on an unclassified work order. Missing diagnosis or quote scope requires source evidence. Free-text warranty amendments are displayed as recorded human corrections; this pass does not turn them into a new policy engine. The existing compatibility snapshot read remains. No push or deployment is included in this follow-up.
