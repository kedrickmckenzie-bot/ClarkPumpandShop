# Maintenance Intelligence demo script

**Maintenance Intelligence** is a temporary, changeable product label. Clark's is the fictional 12-store demo tenant, not the software brand. The core walkthrough takes about 12-15 minutes.

## 1. Start with the product star: spending visibility

Open `/`.

1. Switch the organization scope between company, division, region and store. Explain that these are reporting scopes, not equipment parents.
2. Change the period and selected cost basis. The definition remains visible so a number never silently changes from recorded work cost to approved or linked-invoice cost.
3. Use the trend, category distribution, vendor ranking and cost-outlier visuals. Click a segment or outlier to reach its exact source records.
4. Point out classification coverage and the unclassified bucket. Store-only or category-only work remains in the total instead of disappearing.

## 2. Drill the independent maintenance taxonomy

From the portfolio dashboard, drill `Refrigeration -> Coolers/Freezers -> a specific store asset -> optional component`.

1. The company owns the category names, aliases and nested grouping tree so stores use consistent language.
2. Branch depth is flexible. Refrigeration can be deep while landscaping can stop after one category.
3. Switch to Store 45 and traverse the same taxonomy in store scope.
4. End on supporting work orders, visits and cost records. The dashboard never ends at an unexplained summary.

Open `/stores`, search by store number and then by address, and open `/stores/store-45` to reinforce that the store dashboard is the regional-manager view for that location.

## 3. Show PM and lifecycle intelligence

Open `/pm`, then open a refrigeration asset from the lifecycle/outlier area.

1. Show due, overdue and completed PM occurrences plus the compliance numerator, denominator and allowed window.
2. Compare same-class assets using age, expected life, warranty, reactive cost, repeat work and replacement-cost relationship.
3. Open the asset record to show manufacturer, model, serial, supplier, purchase/installation, warranty, components, PM and source work/cost history.
4. Explain that replacement review exposes reasons and thresholds. It is a human decision aid, never an opaque health score or automatic replacement order.

## 4. Demonstrate low-friction vendor accountability

Open `/accountability`, then `/email-outbox`.

1. Open the accountless vendor link and accept or decline the job. The vendor may propose a date without creating a portal account.
2. Explain that `/vendor-portal` is optional for recurring vendors who want job and permitted asset/service history.
3. Open the store technician QR. Enter technician name and vendor, then select the work order.
4. Also show **I don't see my work order / no work order provided**. It creates a reviewable unmatched visit instead of blocking the technician.
5. Check in, rescan/select the active visit, optionally add notes/photos, choose resolved, waiting on parts or unresolved, and check out.
6. The platform records observed visit count and approximate onsite duration. It does not claim dispatch visibility, certified labor time or repair quality. Accounts, signatures and photos are not globally required.

## 5. Show the intentionally simple maintenance workflow

Open `/reports/new` or `/requests/new`, then `/work-orders/wo-0245`.

1. A cashier reports an observable problem with name/ID and optional photos; no equipment expertise is required.
2. The manager reviews the permanent request. Approval can follow configured amount/category authority without turning intake into a burdensome corporate process.
3. Create or open a work order. Store and problem are enough; taxonomy, asset and component can be classified later.
4. Show useful operator context, assignment, requested/scheduled window, visits, outcome, follow-up, costs and audit history.
5. An unresolved checkout creates the next accountable follow-up instead of letting the issue disappear.

## 6. Show the optional invoice safeguard and report records

Return to `/accountability` for the invoice-review preview, then open `/reports`.

1. Upload/import an invoice and link it to one or more work orders/visits.
2. Review vendor/amount differences, duplicate reference, visit count, approximate onsite time and captured evidence.
3. Emphasize that this is a human-review safeguard. It does not approve or execute payment and does not replace AP, ERP or the general ledger. Customers can ignore this feature and still use every dashboard, PM, lifecycle and vendor-accountability feature.
4. Generate a report from the current dashboard scope. The saved record preserves scope, taxonomy path, period, cost basis, definitions and source links for handoff or archive.
5. Regenerating creates a new version rather than silently rewriting a report already handed up the chain.

## 7. Explain customer-size fit

- Independent store: store scope is default; no fake division/region or meaningless peer-store UI is required.
- 12-store presentation: enough story-rich data to demonstrate each workflow without overwhelming the audience.
- Approximately 65-store pilot: the same tenant/store/taxonomy/query model, server filtering, stable pagination and bulk setup; a separate automated fixture proves scale.
- Other operators: all maintenance trades use configurable organization-owned taxonomy; HVAC/R is the deepest demo focus, not a hardcoded restriction.

## Reset and verification

Restart the development process to reset browser-only preview state. Fixture records are deterministic.

```bash
npm run db:seed
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```
