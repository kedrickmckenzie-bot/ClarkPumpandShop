# Pass 5 query inventory

Snapshot inventory after the first persistence extraction, September 14, 2026. These are unfinished migrations, not completed bounded reads. Keep exact cohorts, tenant scope, cost bases and pagination behavior while replacing them.

| Consumer group | Current entry points | Replacement needed |
| --- | --- | --- |
| Manager home | `loadDashboardModel`, `loadOwnerBriefModel` | Native activity/group queries are implemented; connect them after bounded attention and lifecycle evidence queries replace the remaining snapshot inputs |
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

`dashboard-presenter.ts` now renders the five operator roles from aggregate values and presentation inputs. The home review preview is bounded to seven rows, while its full count and source link remain independent. The existing snapshot adapter still constructs attention, lifecycle and chart presentation inputs. **`loadDashboardModel` still calls the snapshot adapter. The new aggregate queries are not yet its live data source.** This is necessary foundation for P5-01/P5-03, not completion of either acceptance item; no throughput improvement or production scale proof is claimed.

## Next query group

Start the manager-home extraction by defining its exact aggregate/source contract from the Pass 2 metric map. Do not substitute the existing `getExecutiveSnapshot` wholesale: it filters work by creation time and visits/exceptions by event time, while the current overview's open-work/active-visit queues are current-state cohorts. Its exception count also omits the typed workflow-task review projection, and its no-WO check does not account for linked visit-work rows. Preserve the current source predicates before adding bounded SQL reads.

Next implement a bounded, role-visible attention query with full counts, preserving grouping and ordering from `attention-projection.ts`. It includes typed tasks, unrepresented follow-ups, scoped exceptions, companywide vendor reminders, quote rounds and held-work review. A warranty task can target its single relevant warranty case, so target visibility must precede counting/pagination. Preserve finance filtering, store-manager ownership and accountability-edition exception filtering. Fetch only the visible rows' evidence; do not cap source inputs before grouping.

Then add lifecycle/estimate aggregate evidence and spotlight queries, construct chart presentation from paginated groups, and connect the live loader to `presentDashboard` using repository reads. Retire the snapshot dashboard adapter only after all five roles/both editions and exact metric destinations pass on fixture and migrated SQLite/PostgreSQL. Keep record/program/Trends replacements separate until their own queries and pagination pass. The legacy-stack retirement is documented in `PASS5_LEGACY_RETIREMENT.md`; it does not complete these active query migrations.
