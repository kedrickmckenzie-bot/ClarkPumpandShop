# Pass 5 query inventory

Snapshot inventory after the first persistence extraction, September 14, 2026. These are unfinished migrations, not completed bounded reads. Keep exact cohorts, tenant scope, cost bases and pagination behavior while replacing them.

| Consumer group | Current entry points | Replacement needed |
| --- | --- | --- |
| Manager home / brief | `loadDashboardModel`, `loadOwnerBriefModel` | Main overview is fully query-backed, including lifecycle and both spotlights. Replace the owner brief, its companywide-only projection and companion coverage reads |
| Lists | `loadListModel` fallback, `loadApprovedWorkPortfolioModel` | Complete query-first filtering for specialized cohorts and stable source pagination |
| Programs | `loadProgramModel`, `loadPmProgramManagementModel` | Scoped equipment/PM/lifecycle queries and counts; retain PM denominator/window and transparent lifecycle inputs |
| Trends | `loadTrendsModel`, `loadTrendsExportModel`, `loadTrendsPageData` | Replace included-table compatibility projections with bounded source/aggregate queries; exports use a dedicated stream/page path |
| Records | `loadDetailModel`, `loadConnectedWorkReview`, `loadWorkOrderCaseModel` | Exact record and related evidence queries; histories paginate without losing totals |
| Work actions | `loadVendorIssuanceModel`, `loadEstimateComparisonModel`, `loadHeldWorkActionsModel`, `loadVendorResponseActionsModel`, `loadWorkOrderControlModel`, `loadWorkOrderRecordingModel`, `loadRequestReviewModel`, `loadAttentionItemModel` | Exact work/request/exception plus only eligible options and related evidence |
| Creation | `loadCreateRequestModel`, `loadCreateWorkOrderModel`, `loadCreateStoreModel`, `loadCreateVendorModel` | Scoped option searches and small configuration queries; avoid full tenant source data |
| Governance | `loadApprovalPolicyWorkspaceModel`, `loadJobHealthModel`, data-quality loader | Policy, worker-health and scoped coverage queries |
| Vendors | `loadVendorPerformanceListModel`, `loadVendorPerformanceDetailModel`, `loadVendorScorecardsModel` | Aggregate vendor evidence and paginated exact records |
| Other loaders | Verification, store sweeps, service runs, value ledger and remaining feature loaders using request snapshots | Feature-specific relationship queries |
| API consumers | Import preview, equipment replacement, vendor creation and vendor relationship updates | Targeted validation inputs and command preconditions |

Normal store, work, request, visit and vendor lists/search already use repository queries for their supported filter sets. Do not move those routes back onto snapshots. `loadNotificationSettingsModel` and `loadImportWorkspaceAccess` now obtain session access directly; a regression test fails if either attempts a full source snapshot.

## Persistence boundary

`sql-repository.ts` now depends on `OpsSqlDriver`, which exposes parameterized queries, affected rows and atomic statement execution. `d1-repository.ts` is the small Cloudflare adapter. `postgres-repository.ts` owns native pool/client transactions; it no longer imports D1 types or emulates prepared statements. Repository query construction chooses native JSON and string-aggregate expressions explicitly. `postgres-parameters.ts` binds numbered parameters and schema booleans; it does not rewrite SQL grammar. Seed and job insertion use shared `ON CONFLICT DO NOTHING` semantics. Migrations and the existing D1/R2 deployment bindings are unchanged.

The generic presenter and remaining snapshots are still replacement work. This extraction does not imply the whole of Pass 5 is complete or demonstrate production-scale throughput.

## Dashboard query foundation — September 14, 2026

`dashboard-query.ts` defines current-activity totals and an explicit inclusive service-date/currency window. `dashboard-sql.ts` executes aggregate queries through the native driver; it never hydrates a tenant fixture. It covers pending/approved/vendor-response work, active/completed/unmatched visits, upcoming confirmed appointments, watch equipment, visible invoice records, recorded cost, distinct cost-bearing WOs and unclassified cost coverage. `listDashboardBreakdown` pages work statuses, store/category/month costs and active/observed vendor counts, with total count/value preserved even beyond the last page. Pages are bounded to 100 groups and use value plus stable ID ordering/cursors. Raw source records are not returned. Zero-cost groups remain visible; currencies and future service costs stay separate.

Organization/store/region predicates moved to the shared `sql-scope.ts`. Vendor-wait SQL moved to `work-stage-sql.ts` so queue and aggregate reads share the same latest-assignment/primary-task condition. Recorded-cost filters reuse `work-cost-query.ts`. Migrated SQLite and embedded PostgreSQL exercise the same regression for scoped totals, source-list parity, group pagination, empty/foreign scopes and cost-window independence. A PostgreSQL date-to-month cast failure from the first run was corrected before the successful rerun; no SQL translation layer was reintroduced.

At the initial foundation checkpoint, `dashboard-presenter.ts` rendered the five operator roles from aggregate values and presentation inputs, while the snapshot adapter still constructed those inputs. The home review preview was bounded to seven rows with an independent full count. The connection work below supersedes that initial state; it does not yet complete P5-01/P5-03 or prove production-scale throughput.

## Connected activity and attention queries — September 14, 2026

`listAttention` now returns a bounded active queue plus full total, mine and follow-up counts. The native SQL query applies organization/store/region scope, task-role rules, single-case warranty targeting and target-route visibility before counting and paging. It combines tasks, unrepresented follow-ups, exceptions, vendor reminders, grouped quote rounds and held work. Follow-up deduplication uses the role-visible task population before target filtering, matching the existing rule. Quote rows count their requests and proposal revisions without returning their full histories. Group/lane filters, empty pages, explicit empty scopes and foreign scopes retain correct totals. The query handles the open queue; history and expanded source details remain separate work.

Pages use overdue status, priority, normalized UTC deadline and a binary ID tie-breaker. The cursor carries that full key. SQL returns at most the requested limit plus one row (maximum 101), with no fixture hydration. A density regression adds 225 same-deadline obligations, alternates equivalent timestamp formats, and proves complete traversal and bounded returned rows. Shared fixture/SQLite/PostgreSQL checks cover all five operator roles, both editions, source grouping, filters and pagination. These are query correctness checks, not production throughput certification.

The live `loadDashboardModel` now calls `getDashboardActivity` and `listAttention` (limit seven), passing their results into `buildDashboardModel`. `dashboard-presenter.ts` renders stage counts from those aggregates; `attention-presenter.ts` renders the bounded preview and shares exception wording with the full queue. Quote explanations are shorter. Removed the unused intermediate dashboard rendering pass and its repeated attention/lifecycle calculations. A regression throws if a prepared dashboard tries to recompute the attention population.

At the version 36 checkpoint, the dashboard still loaded a tenant snapshot for chart, lifecycle and invoice spotlight inputs. The full action-center list also retained its snapshot path and expanded source evidence. P5-01/P5-02/P5-03 stayed open. The new query was a live partial replacement, not completion of the dashboard migration.

## Connected charts and cost ranking — September 14, 2026

`loadDashboardChartPages` now supplies all six home breakdowns from the existing native queries: five store rows, five category rows (with Unclassified retained separately when needed), five active/observed vendors, bounded work statuses and twelve months. `dashboard-charts.ts` constructs labels, shares and source links without tenant records. Totals and percentages always use the full cohort; short rankings explicitly say how many groups are shown. Work statuses retain all current states, and zero-cost stores remain in the complete ranking. The native store query aggregates costs before joining the store population; the initial zero-store join caused a slower database check and was corrected before final validation.

The dashboard chart period and currency now travel directly to exact recorded-cost work lists. The complete `/app/stores?sort=cost` ranking has its own query-backed presenter with a 25-row page size, server search, explicit period/currency and scoped source links. It no longer silently substitutes all-history costs for the dashboard's rolling year. Its default table, compact store labels and shorter phone layout keep the ranking readable. The report catalog and compatibility report rows use the same rolling-year default. Filtered/invoiced median comparisons open their corresponding cost records instead of an unrelated store ranking.

The SQL and fixture contract includes stores without work. A separate migrated SQLite seed proves all 65 such stores remain reachable in three bounded pages; it does not alter the 15-store presentation. Shared migrated SQLite/PostgreSQL checks also verify literal search escaping and full totals. Removed the obsolete snapshot trend builder. Chart/body labels are 15px, amount labels 15px, secondary shares 13px; zero values render zero-length bars.

At the version 37 checkpoint, lifecycle/estimate summaries, the equipment spotlight, the invoice spotlight and the first-store context still kept the home loader on its tenant snapshot. The dashboard no longer computed charts from that snapshot. The context extraction below supersedes the invoice/store portion of that checkpoint.

## Connected invoice and store context — September 14, 2026

`getDashboardContext` now supplies the first scoped store and one fully visible flagged invoice, using two native queries that each return at most one row. Store ordering is stable by store number and ID. Invoice selection uses the oldest open evidence timestamp, normalized by the native database, then binary invoice ID; equivalent timezone representations do not change ties. The invoice must have allocations and every allocated store must be in scope. The same organization-first visibility predicate now serves the activity count and spotlight. No invoice lines, allocations or exception history are returned to the home presenter.

`dashboard-context-presenter.ts` uses short review wording, “Needs review,” and the actual invoice currency and exact minor-unit amount. Source navigation still opens the full invoice evidence. Shared fixture/SQLite/PostgreSQL regression covers scoped context equality. A dedicated migrated SQLite fixture covers cross-store and unallocated invoices, resolved flags, a foreign-organization flag, equivalent timestamps and CAD amounts, and observes the two one-row maximum results. Five-role prepared-dashboard checks fail if invoice context is reconstructed from the fixture. These tests establish query behavior, not production throughput.

At the version 38 checkpoint, lifecycle/estimate summaries and the equipment spotlight were the only remaining home snapshot inputs. The following extraction completes the main overview query path. P5-01/P5-02/P5-03 remain open for the owner brief and wider record/program/action-center migration.

## Main overview snapshot retired — September 14, 2026

`loadDashboardModel` now obtains its session and reporting clock directly, reads activity/attention/charts/context/lifecycle through the repository, and calls `presentQueryDashboard`. It does not call `sessionAndFixture`, request a tenant snapshot or enter the generic presenter. The remaining `buildDashboardModel` export is an explicit fixture adapter for existing tests/report compatibility.

`getDashboardLifecycle` consumes 100-asset batches in stable binary-ID order. Each batch returns at most 101 asset rows plus five sets of at most 100 current inputs: latest eligible open reactive repair work, active profile, latest published benchmark, active asset override and grouped USD cost used for the stable ranking tie. Domain functions retain profile matching/escalation, planning exclusions, calendar age, materiality and same-horizon economics. The accumulator holds currency totals and one leading candidate, not the tenant's assets or histories. Only the selected candidate needs latest decision/event/selected-price/reported-price records, each limited to one, plus its grouped whole-equipment cost totals by currency. Work/visit/price histories are never returned for the overview.

Management/completed replacement state retains precedence over the calculated flag. Shared replacement-price selection keeps approved amounts pinned above newer quotes or reported prices. The spotlight retains the whole-equipment twelve-month window, all recorded cost currencies and exact lifecycle evidence link. Planning totals remain separate by currency. A supplied repair currency that differs from the replacement currency makes the economic comparison incomplete. Program rows use the same stable ID tie-breakers as the home query.

Shared migrated SQLite/PostgreSQL and fixture checks compare full scoped summaries. A separate 370-asset SQLite fixture spans four pages, finds its leading candidate on the fourth, checks two cost currencies and a future cost exclusion, and observes no result larger than 101 rows. The actual authenticated home-loader test throws on any snapshot request. These checks prove bounded reads and semantics; they do not certify production throughput or external readiness.

## Next query group

**Next priority: the owner brief.** Source inspection found `loadOwnerBriefModel` allows regional viewers but passes the organization-wide snapshot and organization ID into `buildOwnerBrief`. Replace this with an organization-and-location-scoped repository contract before marking P5-01 complete. `/app/brief` also loads coverage quality; that companion currently permits executive/facilities only but still needs a bounded replacement. Do not reintroduce snapshots into the completed main overview.

The owner brief needs exact opened-work/current-active cohorts, current escalated tasks, PM numerator/denominator/obligation buckets, distinct fully visible invoices with open flags counted once, separately named value-event categories, latest outstanding lifecycle decisions, and paginated decision/store source rows. Its current code derives one currency from the first cost and sums all amounts, compares service dates to full timestamps and links several period metrics to unfiltered lists. Replace those shortcuts with explicit currency/date bases and exact scoped source links. Inspect `lib/ops/owner-brief.ts`, `components/workspace/owner-brief.tsx`, `app/app/brief/page.tsx` and the owner-brief regression tests. Preserve the distinction between outstanding management decisions and the main overview's computed repair comparisons; they are different cohorts.

Then migrate the full action center with its type/urgent/search/history filters, filtered summaries and bounded supporting-source details, preserving return-to-queue behavior. Do not substitute the simpler dashboard preview DTO. Record/program/Trends replacements remain separate until their own queries and pagination pass. The legacy-stack retirement in `PASS5_LEGACY_RETIREMENT.md` does not complete these active query migrations.
