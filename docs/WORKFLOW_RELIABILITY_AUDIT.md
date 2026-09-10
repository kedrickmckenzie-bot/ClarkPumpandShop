# Workflow reliability audit — September 10, 2026

Reviewed `codex/platform-rebuild` after `0e04dd5`. This repair pass preserves the implemented service, acknowledgment, invoice, and trends behavior.

## Confirmed problems and corrections

- **PostgreSQL monthly drill-down failure:** the old `substr(service_date, 1, 7)` worked on SQLite text but failed on PostgreSQL's date column. The shared query now converts dates explicitly. The regression runs on the fixture, real SQLite/D1 statements, and the PostgreSQL engine.
- **Cost rows changed meaning:** monthly filters selected work orders but displayed lifetime amounts. Separate existence predicates could match different lines. Eligibility and amounts now use the same intersected month/start/end/currency conditions. Equipment exposure and recording-coverage semantics are unchanged.
- **Inconsistent list loading:** period, basis, and taxonomy-path parameters switched ordinary cost lists to the full-snapshot presenter. Recorded-cost filters now stay on bounded repository queries; mutation receipts no longer trigger the fallback. Cost review shows dates, plain labels, direct cost-tab links, and separate store/vendor links, without unrelated dispatch controls.
- **Ignored invoice filters:** filtered Spending links now show paginated confirmed allocations from the same canonical reporting source, with a reconciling total and exact invoice-allocation, work-order, and store destinations. Legacy work-list links with the invoice basis redirect to invoice evidence. Existing exclusions and permissions remain in force; restricted viewers receive an accessible work-order source when the full invoice is outside their scope.
- **Wrong record tab:** Spending rows now open `view=cost`, replacing the unsupported `view=records`. Supporting-table store links open the store independently.
- **Repeated data reads:** saved views no longer load the tenant snapshot. Related server-render panels share one request-scoped snapshot across work, equipment, lifecycle, setup, and finance loaders. Requests and mutations do not share a persistent cache. Cost lists also skip the unrelated held-work aggregate.
- **Oversized vendor histories:** visits, issuances, repeat work, and costs render 25 rows per section with section-preserving pagination. Totals still include all evidence.
- **Mobile navigation and layout:** chart clicks could leave the destination scrolled to the old chart position. Chart, direct-record, and navigation links now land at a stable workspace-start anchor while retaining exact evidence anchors. Shared phone record tables expose labeled fields without sideways searching; context labels stack, navigation stays compact, and saved-view controls collapse on cost-evidence pages.
- **Development reload storms:** Vite ignores `.next`, `dist`, runtime state, and development logs. D1/R2 bindings and both supported builds remain intact.

## Validation

- Required checks passed: `db:seed`, `typecheck`, `lint`, `test` (**123 files / 819 tests**), `test:e2e` (**4 files / 46 tests**), `build`, and `build:render`.
- Regressions cover all 12 generated Overview month links, source pagination, conflicting dates, scoped amounts/currencies, empty and forbidden scopes, equipment paths, invoice reconciliation, direct navigation, and vendor-history completeness. SQL behavior is tested on actual SQLite and PostgreSQL engines.
- `npm run test:routes` checked **134 local HTTP routes** with no HTTP or rendered server-error failures. It follows generated chart links, including empty months, and sampled connected records. This verifies HTTP rendering, not every browser interaction.
- Desktop and **390 × 844** browser checks covered Overview → monthly costs → work-order Costs; invoice total → exact allocation; search → Store 104 → store-prefilled work creation; vendor-history pagination; PM/lifecycle views; store-creation form; vendor-response controls; and technician/no-work-order entry through crew details. No visit or vendor response was submitted. Cross-channel visit mutations are covered by the end-to-end suite.
- The original Overview failure did not reproduce in the local fixture before changes. The PostgreSQL monthly-query error and mobile scroll-position problem were independently reproduced; the original report should not be attributed exclusively to one cause.
- `dev4.log` remains untouched. No push or deployment was performed.

## Local timing observations

Before/after local-development HTTP renders, in milliseconds. These single-run observations exclude browser hydration and network conditions; they are directional, not production benchmarks.

| Route | Before | After |
| --- | ---: | ---: |
| July cost drill-down | 462 | 308 |
| Work-order queue | 448 | 364 |
| CPS-2026-0114 detail | 580 | 336 |
| ColdLine vendor detail | 647 | 533 |
| Overview | 453 | 441 |
| Search for Store 104 | 310 | 280 |

ColdLine's uncompressed development HTML/RSC response fell from **1,564,245 to 1,313,102 bytes**. Supported work-list queries now avoid the tenant snapshot entirely. Overview did not show a material improvement in this sample.

## Remaining work

- Dashboard, reporting, and several detail projections still use server-side compatibility snapshots. Shared reads and smaller rendered histories do not replace indexed aggregate queries or establish production-scale latency. Those projections are the next substantial performance target.
- The audit samples record pages, not every role, data combination, public token, or mutation. The demo role picker remains a preview control.
- Some dedicated record-history tables still scroll horizontally on phones. The shared operational lists were improved; specialized histories remain follow-up work.
- Existing invoice fixture reconciliation issues remain excluded as documented in `ACCOUNTING_REVIEW_CORRECTIONS.md`. No acknowledgment, unlink, safety-obligation, or benchmark-coverage behavior was relaxed.

Repeat the route audit against a running preview with `npm run test:routes -- http://localhost:3010`.
