# Pass 5 query inventory

Snapshot inventory after the first persistence extraction, September 14, 2026. These are unfinished migrations, not completed bounded reads. Keep exact cohorts, tenant scope, cost bases and pagination behavior while replacing them.

| Consumer group | Current entry points | Replacement needed |
| --- | --- | --- |
| Manager home | `loadDashboardModel`, `loadOwnerBriefModel` | Scoped SQL aggregates, bounded attention/source queues, exact metric destinations |
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
