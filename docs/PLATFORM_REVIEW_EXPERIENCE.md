# Complete review experiences across the platform

The September 10, 2026 product direction applies to **every screen**, including ordinary data review. A useful screen assembles the context needed to understand its subject. Decisions and actions are optional outcomes of that understanding.

## Screen contract

1. **Orient:** name the subject, location scope, selected period, cost basis, equipment/component scope, and available data window wherever they affect interpretation.
2. **Understand:** show the actual relevant facts, observations, status, and a bounded preview of supporting history. A menu of destinations alone does not satisfy this requirement.
3. **Investigate:** put evidence and related entities beside the fact they explain. Preserve exact cohorts and source filters. Give longer lists a clearly labeled path to their remaining records.
4. **Recognize limits:** distinguish empty lists, missing observations, partial previews, and measured zero. Never invent a cause, repeat failure, warranty entitlement, labor charge, or completed obligation from sparse records.
5. **Continue or finish:** enable the relevant permitted action when one exists. Reading a completed record must not require creating a task, acknowledgment, decision, or new work order.
6. **Return:** retain the source view and section. Destination headings and the selected tab should be visible on phones as well as desktop.
7. **Stay responsive:** reuse scoped, bounded reads; do not assemble context by fetching the tenant again or creating unbounded browser queries.

This extends the existing service-workflow contract. It does not make components, invoices, vendor participation, or repair/replacement analysis prerequisites for basic work.

## Implemented review changes

| Area | Review behavior |
| --- | --- |
| Search across stores, work, vendors, equipment, visits, and requests | Results retain available facts and independent store, provider, work, and cost links. Equipment results show serial numbers and operating state. Each group opens the matching full list. Eight-row previews distinguish known totals from lower bounds. |
| Store, equipment, component, request, and visit records | Linked facts stay in the record summary. The shared overview includes up to four facts, three table rows, and two updates per section, with explicit preview counts and a link to the full section. Empty sections remain neutral. |
| Store and equipment setup | Setup controls remain available after the review content; routine review no longer starts with setup or QR administration. Existing request-review controls retain their position. |
| Record section navigation | Links retain the current query context, work without a button-only router action, expose evidence anchors, and land at the review heading. The selected tab scrolls into horizontal view. |
| Work-order and service-visit review | Phone cost/history fields are labeled and readable. A checked-out visit without a legacy overall outcome points to recorded work outcomes; an absent legacy work-order field does not assert that the visit has no work links. |
| Spending, PM, and lifecycle supporting tables | Phone rows expose labeled fields using the same review pattern. Existing exact links and intentional in-place lifecycle selection remain intact. |

The new previews use the already-authorized view model. They do not issue additional database queries. Search still uses bounded repository calls, skips equipment reads in the accountability edition, and suppresses links unavailable to the viewer's role. These are presentation changes; domain commands, tenant/store grants, accounting bases, recording coverage, acknowledgment, unlinking, and exceptional obligations are unchanged.

## Platform audit boundaries

Overview, vendor evidence, invoice allocation review, PM, lifecycle, reports, and setup already have specialized views. Their existing summaries and evidence remain the foundation; this pass improves the shared review behavior instead of replacing those workspaces with one configurable page. The earlier cost/filter corrections are documented in [WORKFLOW_RELIABILITY_AUDIT.md](WORKFLOW_RELIABILITY_AUDIT.md).

The platform-wide contract above is also the acceptance standard for future changes. It is not a claim that every specialized screen now synthesizes every possible question. Narrative repair/replacement comparisons, cross-record diagnosis, and complete coverage of every data/role combination still need their own supported evidence and acceptance tests. Large compatibility snapshots and some specialized history layouts remain performance and usability work.

## Validation

- Required checks passed: `db:seed`, `typecheck`, `lint`, `test` (**124 files / 825 tests**), `test:e2e` (**4 files / 46 tests**), `build`, and `build:render`.
- `test:routes` rendered **134 local routes** without HTTP or rendered server errors. This checks generated chart destinations and sampled connected records, not every interaction.
- New regressions cover bounded previews versus full sections, direct supporting links, search count accuracy, role/store restrictions, no added tenant-snapshot read, checked-out visit wording, preserved query context, and neutral empty evidence.
- Desktop and **390 × 844** browser checks covered search → store → full section; equipment history previews; phone work costs and Spending source fields; vendor-history pagination; invoice total → exact allocation anchor; PM/lifecycle review; and existing creation/public-service entry paths. Section navigation was corrected after reproducing a phone scroll-position failure.
- No vendor response, check-in, checkout, or work creation was submitted in the browser. Mutation and cross-channel behavior is exercised by the end-to-end tests.
- These changes add no persistent cache or extra data queries. Richer rendered previews are not a demonstrated server-latency improvement; no new production performance claim is made.
- Work remains local for review. `dev4.log` is preserved; no push or deployment was performed in this pass.
