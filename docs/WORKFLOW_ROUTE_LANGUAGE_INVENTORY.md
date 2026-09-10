# Route and role wording inventory

This inventory records the reachable page entry points inspected during the September 9–10, 2026 completion pass. Source inspection covers the entry page and its referenced shared presenters/components; it is not a claim that every possible state was manually exercised. Browser execution and automated checks are recorded in `WORKFLOW_ACCOUNTING_COMPLETION.md`.

## Role journeys

| Role | Starting question and connected path | Guardrails retained |
|---|---|---|
| Store manager | Overview → reports needing response → acknowledgment or explicit follow-up → linked work → exact visit outcome → Yes / No / Not sure confirmation | Assigned stores; no default dispatch, capital approval, invoice decision or technical sign-off |
| Maintenance / facilities | Review queue → each task/source → work/provider/quote decision → vendor response → held or active service → operating review | Approval, qualified vendor, active assignment and required task gates remain server enforced |
| Regional manager | Regional overview and queues → store → request/work/equipment/vendor evidence | Region/store restrictions apply through details, searches and commands |
| Owner / leadership | Company overview → exact trend/exception population → equipment, work and financial evidence → authorized approval | Financial evidence is separate from operational completion |
| Invoice reviewer | Invoice intake → accounting source/version → human match and work splits → invoice/service/authorization evidence → reasoned review | No dispatch or repair confirmation; company-level import administration is explicitly checked |
| Outside vendor, account-free | Quote link → scope/amount/files → revised quote/history; separate service link → accept/decline/question/date → technician entry | Quote does not authorize work; capability is bound to the vendor and subject |
| Technician / trusted store device | Eligible assigned work or no-WO exception → active visit → per-work outcome and required follow-up | Exact outcome, channel-independent visit and scope controls |

## Page entry points

| Route | Entry point | Review surface |
|---|---|---|
| `/[...legacy]` | `app/[...legacy]/page.tsx` | Entry/loader and shared navigation, empty/error/permission states |
| `/app/action-center/[id]` | `app/app/action-center/[id]/page.tsx` | components/ops/service-control-panels, components/ops/views, components/ops/ops.module.css |
| `/app/action-center/next` | `app/app/action-center/next/page.tsx` | Entry/loader and shared navigation, empty/error/permission states |
| `/app/action-center` | `app/app/action-center/page.tsx` | components/ops/views |
| `/app/admin/approval-policies` | `app/app/admin/approval-policies/page.tsx` | components/ops/views |
| `/app/admin/imports` | `app/app/admin/imports/page.tsx` | components/workspace/import-preview |
| `/app/admin/maintenance-responsibilities` | `app/app/admin/maintenance-responsibilities/page.tsx` | components/workspace/maintenance-responsibilities, components/ops/role-policy |
| `/app/admin/notifications` | `app/app/admin/notifications/page.tsx` | components/workspace/notification-settings |
| `/app/admin` | `app/app/admin/page.tsx` | components/ops/views, components/workspace/job-health |
| `/app/admin/service-areas` | `app/app/admin/service-areas/page.tsx` | components/ops/taxonomy-manager |
| `/app/brief` | `app/app/brief/page.tsx` | components/workspace/owner-brief, components/workspace/coverage-quality |
| `/app/equipment/[id]/components/[componentId]` | `app/app/equipment/[id]/components/[componentId]/page.tsx` | components/ops/views, components/ops/component-lifecycle-panel, components/ops/role-policy |
| `/app/equipment/[id]/components/new` | `app/app/equipment/[id]/components/new/page.tsx` | components/ops/setup-forms |
| `/app/equipment/[id]` | `app/app/equipment/[id]/page.tsx` | components/ops/role-policy, components/ops/setup-forms, components/ops/views, components/ops/replacement-intelligence-panel |
| `/app/equipment/new` | `app/app/equipment/new/page.tsx` | components/ops/setup-forms |
| `/app/equipment` | `app/app/equipment/page.tsx` | components/ops/role-policy, components/ops/views |
| `/app/estimates` | `app/app/estimates/page.tsx` | components/ops/views |
| `/app/invoices/[id]` | `app/app/invoices/[id]/page.tsx` | components/ops/warranty-finance-workspace |
| `/app/invoices/accounting` | `app/app/invoices/accounting/page.tsx` | components/ops/accounting-demo-control, components/ops/accounting-import-review, components/ops/accounting-workspace.module.css, components/ops/ops.module.css |
| `/app/invoices/new` | `app/app/invoices/new/page.tsx` | components/ops/invoice-receive-workspace |
| `/app/invoices` | `app/app/invoices/page.tsx` | components/ops/warranty-finance-workspace, components/ops/invoice-receive-workspace |
| `/app/lifecycle` | `app/app/lifecycle/page.tsx` | components/workspace/planning-workspace, components/ops/replacement-intelligence-panel, components/workspace/lifecycle-record-stack |
| `/app/overview` | `app/app/overview/page.tsx` | components/workspace/control-tower |
| `/app` | `app/app/page.tsx` | Entry/loader and shared navigation, empty/error/permission states |
| `/app/pm/new` | `app/app/pm/new/page.tsx` | components/ops/setup-forms |
| `/app/pm` | `app/app/pm/page.tsx` | components/ops/role-policy, components/workspace/planning-workspace, components/workspace/pm-program-management |
| `/app/pm/plans/[id]` | `app/app/pm/plans/[id]/page.tsx` | components/ops/setup-forms |
| `/app/pm/programs/new` | `app/app/pm/programs/new/page.tsx` | components/ops/setup-forms |
| `/app/reports` | `app/app/reports/page.tsx` | components/workspace/reporting-center |
| `/app/reports/value` | `app/app/reports/value/page.tsx` | components/ops/value-ledger-workspace |
| `/app/requests/[id]/link` | `app/app/requests/[id]/link/page.tsx` | components/ops/request-work-linker |
| `/app/requests/[id]` | `app/app/requests/[id]/page.tsx` | components/ops/service-control-panels, components/ops/views, components/ops/ops.module.css |
| `/app/requests/new` | `app/app/requests/new/page.tsx` | components/ops/forms |
| `/app/requests` | `app/app/requests/page.tsx` | components/ops/views |
| `/app/search` | `app/app/search/page.tsx` | components/ops/views |
| `/app/service-runs/[id]` | `app/app/service-runs/[id]/page.tsx` | components/ops/service-run-workspace |
| `/app/service-runs` | `app/app/service-runs/page.tsx` | components/ops/service-run-workspace |
| `/app/spend` | `app/app/spend/page.tsx` | components/workspace/planning-workspace |
| `/app/store-sweeps/[id]` | `app/app/store-sweeps/[id]/page.tsx` | components/ops/service-run-workspace |
| `/app/store-sweeps/new` | `app/app/store-sweeps/new/page.tsx` | components/ops/store-sweep-planner |
| `/app/stores/[id]/equipment-setup/name` | `app/app/stores/[id]/equipment-setup/name/page.tsx` | components/ops/store-equipment-setup |
| `/app/stores/[id]/equipment-setup` | `app/app/stores/[id]/equipment-setup/page.tsx` | components/ops/store-equipment-setup |
| `/app/stores/[id]` | `app/app/stores/[id]/page.tsx` | components/ops/role-policy, components/ops/setup-forms, components/ops/store-qr-material, components/ops/views |
| `/app/stores/new` | `app/app/stores/new/page.tsx` | components/ops/forms |
| `/app/stores` | `app/app/stores/page.tsx` | components/ops/views |
| `/app/trends` | `app/app/trends/page.tsx` | components/workspace/trends-workspace, components/workspace/saved-views |
| `/app/vendors/[id]` | `app/app/vendors/[id]/page.tsx` | components/ops/vendor-performance-workspace |
| `/app/vendors/new` | `app/app/vendors/new/page.tsx` | components/ops/forms |
| `/app/vendors` | `app/app/vendors/page.tsx` | components/ops/vendor-performance-workspace |
| `/app/visits/[id]` | `app/app/visits/[id]/page.tsx` | components/ops/views |
| `/app/visits` | `app/app/visits/page.tsx` | components/ops/views |
| `/app/warranties/[id]` | `app/app/warranties/[id]/page.tsx` | components/ops/warranty-finance-workspace |
| `/app/warranties` | `app/app/warranties/page.tsx` | components/ops/warranty-finance-workspace, components/ops/warranty-rule-workspace |
| `/app/warranties/rules/new` | `app/app/warranties/rules/new/page.tsx` | components/ops/warranty-rule-workspace |
| `/app/work-orders/[id]` | `app/app/work-orders/[id]/page.tsx` | components/workspace/work-order-case, components/workspace/owner-brief.module.css |
| `/app/work-orders/new` | `app/app/work-orders/new/page.tsx` | components/ops/forms |
| `/app/work-orders` | `app/app/work-orders/page.tsx` | components/ops/views, components/ops/role-policy, components/workspace/saved-views |
| `/` | `app/page.tsx` | Entry/loader and shared navigation, empty/error/permission states |
| `/public/estimate/[token]` | `app/public/estimate/[token]/page.tsx` | components/ops-public/public-ui, components/ops-public/server-gateway, components/ops-public/vendor-estimate-page |
| `/public/service/[token]` | `app/public/service/[token]/page.tsx` | components/ops-public/public-ui, components/ops-public/service-authorization-page, components/ops-public/server-gateway |
| `/public/service-run/[token]` | `app/public/service-run/[token]/page.tsx` | components/ops-public/public-ui, components/ops-public/service-run-response-page |
| `/public/store/[token]` | `app/public/store/[token]/page.tsx` | components/ops-public/public-ui, components/ops-public/pending-visit-cookie, components/ops-public/server-gateway, components/ops-public/store-portal-home |
| `/public/store/[token]/report` | `app/public/store/[token]/report/page.tsx` | components/ops-public/public-ui, components/ops-public/server-gateway, components/ops-public/store-report-form |
| `/public/store/[token]/visit` | `app/public/store/[token]/visit/page.tsx` | components/ops-public/public-ui, components/ops-public/pending-visit-cookie, components/ops-public/server-gateway, components/ops-public/technician-visit-flow |

## Wording audit rules and results

- Review labels, buttons, helpers, receipts, errors, empty/permission states, status values, timelines, source tables and mobile disclosures. The exact applied replacements are in `PLAIN_LANGUAGE_CHANGES.json` (file, before, after, reason).
- Preserve original employee reports, quote scope/exclusions, invoice descriptions, actor notes, and historical audit payloads. Display labels map machine enums; stored values do not change.
- Keep “Aware — being handled” optional-note/optional-link. Keep reported completion distinct from confirmed repair, approval distinct from payment, and opportunities distinct from confirmed benefits.
- Calculation details retain metric definitions, exposure, recording coverage, cohorts and units. Routine manager actions use short task language.
- Task owner, due time, completion requirement, historical evidence and related source links remain available when wording is shortened.
- New accounting controls identify the fictional demo adapter and do not suggest a live connection, automatic payment, automatic matching, or an accounting provider selection.
- Not every vendor/technician branch was manually repeated. The public and workflow regression suites cover their command boundaries; the browser matrix states precisely which interactions ran.
