# Pass 2 metric and drill-through map

Scope: the current operator Overview for all five preview roles, its linked queues, and its PM/lifecycle/invoice evidence. This is an implementation map, not a production-readiness claim. Historical/unused application stacks remain in Pass 5.

## UX rules

The permanent rule in AGENTS.md applies to every pass: plain words, short help, obvious actions, readable desktop/phone views. Dashboard counts describe records the selected role can actually open. Status and next-action owner are different facts: **Vendor follow-up** is a work status; **Waiting on vendor** means the vendor owns the next action. Approved work held for a later visit is labelled **Approved · not sent**.

## Overview sources

Every row below first applies organization and the session's store/region access. Navigation retains that session scope; URL filters only narrow it.

| Measure / surface | Source and exact destination | Window / basis |
| --- | --- | --- |
| Requests to review | Submitted + under-review request IDs → Requests, `status=pending`; same repository predicate for count, search and pagination | Current request state |
| Approved · not sent | Approved work IDs → Work orders, `stage=not-sent`; includes held jobs | Current work state; no claim that every job is ready for immediate issuance |
| Waiting on vendor | Issued/vendor-follow-up work with an active outside assignment and the primary open task assigned to that vendor → `stage=vendor-response` | Current next-action ownership; declines/date proposals requiring an operator action are excluded. Older records without typed tasks require the vendor to match the recorded next-action owner |
| Onsite visits | Active visit IDs → Visits, `status=active` | Active check-ins; counts visits, not distinct vendors or labor hours |
| Completed visits | Checked-out visit IDs → Visits, `status=checked_out` | All recorded history |
| Open work | Work not closed/cancelled → Work orders, `status=open` | Current work state |
| Items to review | Visible attention projection IDs → Review queue | Current open items; inaccessible destinations excluded before counting |
| Work follow-ups | Visible attention IDs of type follow-up → Review queue, `type=follow-up` | Open tasks and follow-ups; not just legacy follow-up rows |
| Store manager: needs your response | Visible attention IDs in the manager's own lane → `lane=mine` | Current assigned decisions |
| Store manager: upcoming appointments | Confirmed future appointments on scoped work → Visits, `status=upcoming` | Starts at/after fixture as-of; this view lists appointments |
| Equipment to review | Scoped equipment marked watch → Equipment, `status=watch` | Current recorded equipment flag |
| Recorded work cost | USD cost lines on scoped work → Spend; work IDs with cost → bounded Work orders | Rolling calendar months, currently Sep 1, 2025–Aug 25, 2026 inclusive; recorded cost only |
| Cost-bearing work orders | Distinct work IDs with matching cost lines → `hasCost=true&costFrom=...&costTo=...` | Same cost period; future costs excluded |
| Invoice records | Canonical invoices whose allocations permit full-record access → Invoice review | All invoice dates, explicitly labelled; same shared scope helper as the destination |
| Replacement outlook | Resolved replacement estimates for scoped equipment → Lifecycle, `replacement=entered` | Current planning estimates; separate from approved replacement quotes and recorded costs |
| Open work by status | Partition of every open-work ID by persisted status → matching `status` filter | Every nonzero status displayed; no hidden tail |
| Recorded cost by store / service area | Same scoped period cost lines grouped by store/category → Spend with selected store/category | Same recorded-cost basis and default period; all groups displayed, including unclassified and zero-cost groups |
| Vendor visit distribution | Visit IDs grouped by outside vendor → Visits with exact vendor filter | All recorded outside-vendor visits; vendor directory is the broader accountability entry point |
| Who is onsite | Active outside-vendor visit IDs grouped by vendor → Visits with vendor + active filters | Outside-vendor cohort is explicitly stated; source footer opens all active visits |
| Monthly cost trend | Service-dated cost lines by month → Work orders with month and inclusive upper date | Twelve calendar month buckets; every source link preserves the as-of upper bound |
| Highest-cost store shortcut | Maximum store total from the same grouped cost lines → selected store in Spend | Recorded work cost, same period; not a performance verdict |
| Repair comparison shortcut | Equipment whose transparent repair comparison calls for review → Lifecycle, `reason=compare alternatives` | Human review; does not automatically replace equipment |
| Equipment spotlight | Same whole-equipment review model as the destination → selected asset/decision/work with `history=12` | Trailing twelve calendar months, currently Aug 25, 2025–Aug 25, 2026; planned + reactive recorded costs, currencies kept separate |
| Invoice spotlight | First scoped canonical invoice with an open review flag → that invoice record | Flagged charge evidence; no automatic rejection, deduction or payment |
| Smaller package: visits without a WO | Visits with neither primary work nor linked visit-work records → `unmatched=true` | Exact unmatched visit IDs, separate from wider review queue |
| Smaller package: visits needing review | Unmatched visits or visits with open exceptions → `review=true` | Distinct visit IDs; several flags on one visit count once |

## PM, lifecycle and invoice safeguards

- PM status tiles and segments open exact occurrence IDs through all pages. Completion uses closed windows before as-of, excludes waived work, and shows completed / eligible. The new **Completed maintenance** breakdown opens the completed numerator, missed remainder and complete eligible denominator. `window=closed` persists through pagination and return links. Regional/store scope and selected maintenance program remain in the links.
- PM effectiveness retains its explicit equipment cohort, exposure denominator and source cost/occurrence views. It does not establish causation. Existing `ops-pm-reactive-review` regressions cover quiet equipment, changing windows, invalid cohorts and scoped evidence.
- Lifecycle uses explicit age, expected-life, current repair and replacement estimates and recorded history. Reactive cost windows now exclude dates after as-of and foreign currencies from USD totals. The spotlight uses all whole-equipment costs, preserving the destination's different trailing-year window. Store 115 reconciles to two planned cost lines totalling **$440**, not a misleading zero reactive-only total.
- Canonical invoices, legacy references and confirmed allocations are separate entities. The seed has 90 accessible canonical invoices and 97 raw references; the old lower-bound-only rolling count was 91 and included future-dated references. It is no longer presented as a count of invoice records. The invoice allocation view uses invoice dates and its selected currency, taxonomy and store filters. Canonical identities supersede legacy mirrors; linked allocations plus unmatched balances reconcile without double counting.
- No new downtime inference, payment execution or automatic replacement decision was introduced.

## Verification map

- `tests/ops-dashboard-pass2.test.ts`: all-role count/destination parity; exact status/vendor/month source IDs; 9 rendered work-status segments and all 15 store groups; two true vendor waits (CPS-2026-0116 and CPS-2026-0206); empty intersecting filters; request search/store/page preservation; Store 115 cost-line IDs and future-cost exclusion; canonical invoice versus reference/allocation reconciliation; smaller-package unmatched/review separation; exact PM numerator/denominator/status IDs across pages and roles.
- `tests/helpers/dashboard-queue-regression.ts`: pending request IDs, cursor/offset pagination, search, every store, empty/other-tenant scopes and vendor-stage parity. Runs inside the established cost-drilldown regression against fixture, real SQLite/D1 and embedded PostgreSQL.
- Existing presenter, role, PM effectiveness, accounting-reporting and cost-drilldown tests retain taxonomy paths, unclassified/unlinked buckets, cost dates/currencies, allocations and role access coverage.
- Browser evidence and final command results are recorded in the persistent pass checklist. Pass 7's full browser mutation matrix and production gates remain separate.
