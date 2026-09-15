# Pass 5 legacy retirement

Audit performed September 14, 2026 against source `6a0422d` (the immediately preceding application source is private version 33). The current platform continues under `app/app`, `app/public`, `app/api`, `components/ops`, `components/workspace` and `lib/ops`.

## Evidence and boundary

A TypeScript syntax-tree import/export walk started from 199 application, worker, build, configuration and operational-script files. It resolved relative and `@/` paths, index modules, type imports, literal dynamic imports and CSS imports. The 420 reachable files had no unresolved local imports or nonliteral dynamic imports. A separate test-root walk identified dependencies reachable only from obsolete prototype tests. Repository text searches confirmed the callers before removal.

Removed 93 tracked files / 50,070 lines: 69 unused UI/helper/seed files, 16 libraries used only by the retired test suites, and eight corresponding legacy test files. These implemented the old session-scoped c-store UI, earlier root-component application, generic domain/demo fixtures and accounting-heavy prototype. Git preserves their history. `components/use-browser-origin.ts` was the only candidate root component reachable from the active application and remains.

The eight retired tests covered the removed implementations, including their old 12-store fixture, general-ledger/payment concepts and separate token/workflow functions. No `ops-*` test, active domain command, current fixture or repository regression was removed. Current coverage retains the canonical work lifecycle, tenant/public boundaries, cost/invoice safeguards, native persistence, PM/lifecycle rules and deterministic 15/65-store fixture contracts. The lower test total after this change must be reported as retirement, not as new validation coverage.

Active routes, the root redirect, global styles, current assets, worker/build entry points, database schemas, cumulative migration histories and hosting bindings were preserved. This audit does not authorize deleting historical migrations or the still-needed snapshot query path. P5-01/P5-02/P5-03/P5-06 remain separate work.

Validation and private publication are recorded in [the pass checklist](PLATFORM_IMPROVEMENT_PASSES.md). Historical architecture/readiness reviews remain dated snapshots; this record supersedes their legacy-stack inventory.

## Removed files

- `components/admin-platform.tsx`
- `components/app-shell.tsx`
- `components/command-center.tsx`
- `components/company-taxonomy-builder.tsx`
- `components/created-portfolio-detail.tsx`
- `components/created-work-order-detail.tsx`
- `components/cstore/cstore-workflows.module.css`
- `components/cstore/guided-demo-story.module.css`
- `components/cstore/guided-demo-story.tsx`
- `components/cstore/guided-store-setup.tsx`
- `components/cstore/index.ts`
- `components/cstore/lifecycle-planning.module.css`
- `components/cstore/lifecycle-planning.tsx`
- `components/cstore/maintenance-cost-review.module.css`
- `components/cstore/maintenance-cost-review.tsx`
- `components/cstore/maintenance-spend-workspace.module.css`
- `components/cstore/maintenance-spend-workspace.tsx`
- `components/cstore/operations-drilldowns.module.css`
- `components/cstore/operations-drilldowns.tsx`
- `components/cstore/platform-setup-workflows.module.css`
- `components/cstore/platform-setup-workflows.tsx`
- `components/cstore/request-workspace.module.css`
- `components/cstore/request-workspace.tsx`
- `components/cstore/setup-workflows.module.css`
- `components/cstore/setup-workflows.ts`
- `components/cstore/taxonomy-manager.tsx`
- `components/cstore/technician-visit-flow.tsx`
- `components/cstore/traceops-app.tsx`
- `components/cstore/types.ts`
- `components/cstore/vendor-picker.tsx`
- `components/cstore/vendor-service-authorization.tsx`
- `components/cstore/work-classification-editor.tsx`
- `components/cstore/work-lifecycle-workflows.module.css`
- `components/cstore/work-lifecycle-workflows.tsx`
- `components/cstore/work-order-creation.tsx`
- `components/email-outbox.tsx`
- `components/employee-report-form.tsx`
- `components/equipment-platform.tsx`
- `components/financial-platform.tsx`
- `components/maintenance-dashboard.tsx`
- `components/maintenance-pages.tsx`
- `components/maintenance-platform.tsx`
- `components/maintenance-workspace.tsx`
- `components/operations-pages.tsx`
- `components/platform-overview.tsx`
- `components/platform-ui.tsx`
- `components/pm-plan-creator.tsx`
- `components/portfolio-pages.tsx`
- `components/preventive-lifecycle-dashboard.tsx`
- `components/provider-platform.tsx`
- `components/registry-console.tsx`
- `components/reporting-center.tsx`
- `components/reporting-platform.tsx`
- `components/site-link.tsx`
- `components/spending-intelligence-dashboard.tsx`
- `components/store-directory.tsx`
- `components/store-onboarding-wizard.tsx`
- `components/store-platform.tsx`
- `components/technician-visit.tsx`
- `components/ui.tsx`
- `components/vendor-directory.tsx`
- `components/vendor-response.tsx`
- `components/vendor-visibility-dashboard.tsx`
- `components/work-order-creator.tsx`
- `components/work-order-detail.tsx`
- `components/work-order-execution.tsx`
- `components/work-order-list.tsx`
- `lib/presentation.ts`
- `scripts/seed-demo.ts`
- `lib/cstore/analytics.ts`
- `lib/cstore/demo-data.ts`
- `lib/cstore/guided-demo.ts`
- `lib/cstore/role-policy.ts`
- `lib/cstore/types.ts`
- `lib/demo/data.ts`
- `lib/domain/analytics.ts`
- `lib/domain/geofence.ts`
- `lib/domain/permissions.ts`
- `lib/domain/tokens.ts`
- `lib/domain/types.ts`
- `lib/domain/workflow.ts`
- `lib/platform/data.ts`
- `lib/platform/finance.ts`
- `lib/platform/registry.ts`
- `lib/vendor-directory.ts`
- `tests/cstore-demo.test.ts`
- `tests/cstore-recorded-costs.test.ts`
- `tests/domain.test.ts`
- `tests/guided-demo.test.ts`
- `tests/lifecycle-decision-analytics.test.ts`
- `tests/platform-rebuild.test.ts`
- `tests/role-policy.test.ts`
- `tests/workflow.e2e.test.ts`
