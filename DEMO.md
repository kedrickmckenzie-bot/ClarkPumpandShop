# Clark's Operations demo script

Use the fixed “Aug 5, 2026” demo period. The core walkthrough takes about 12–15 minutes.

## 1. Begin at company control

Open `/`.

1. Explain that the command center is exception-first: critical work, overdue follow-up, vendor acceptance, PM, spend exposure, invoice review and replacement candidates.
2. Use Region, Store, Category and Vendor filters. Point out that metrics recalculate from the same underlying records.
3. Open the Store 45 outlier. The claim is deliberately narrow: refrigeration spend is statistically unusual. Repeat visits, missed PM and emergency work are correlated evidence, not asserted causes.

## 2. Drill down without losing context

Open `/stores/store-45` → Beer Cave Refrigeration → CU-1 → Condenser Fan Motor.

1. Store 45 shows company-relative spend, open work, PM compliance and systems.
2. Beer Cave Refrigeration is the durable system that owns PM and groups physical assets.
3. CU-1 exposes the capital-review logic: age, TTM burden, prior-period increase, failures, visits, repeats, PM and warranty. Each threshold is visible; there is no opaque health score.
4. The fan motor shows the optional component-level allocation. General work remains useful even when component detail is absent.

## 3. Follow the complete work-order story

Open `/work-orders/wo-0245`.

1. The original cashier report RPT-0671 is immutable. Manager/regional context is appended, never substituted.
2. CWO-0245 is Clark’s source of truth. The right-hand control card always names the accountable party, next action, due date and escalation.
3. Progressive classification shows that the record began at Store + Refrigeration and later gained system, asset and component associations from diagnosis and quote evidence.
4. Visit 1 is geofence verified and ends “Diagnosed — unresolved,” which automatically creates a Facilities-owned follow-up.
5. Visit 2 is resolved. Quote, authorization, two allocation lines and $4,950 invoice all reconcile.
6. The audit timeline proves the sequence and preserves classification changes.

## 4. Demonstrate low-burden users

Open `/reports/new` on a narrow/mobile viewport.

1. An employee reports an observable symptom in plain language; no asset knowledge is required.
2. Submit and show that the receipt explains permanence and next steps.

Open `/email-outbox`.

1. Send the fictional vendor email.
2. Open the secure response and choose Accept. Emphasize that NorthStar keeps dispatch and technician assignment in its own system.
3. Scan or open the technician QR. Run inside, outside, denied and inaccurate demo states; then try actual browser location if appropriate.
4. Select “Diagnosed — unresolved” to show automatic follow-up. Repeat with “Completed — issue resolved” to show the terminal path.

## 5. Show PM, vendor and finance control

1. `/pm`: Store 45’s missed April occurrence remains missed even though a recovery work order exists. Documentation-pending work does not count as compliant.
2. `/vendors`: observed performance and response state only—no duplicate dispatch board.
3. `/files`: drag in a safe PDF/image/text file, then review invoice states and financial-control copy. Local mode labels the upload as a session preview; hosting activates R2.

## 6. Explain customer-size fit

- One independent store: organization → store directly; no fake region, one person may hold several roles, comparison panels adapt to history/categories.
- Regional operator: optional regions scope managers and filters.
- 65-store pilot: stable pagination, exception queues, tenant-scoped indexes and server-persistence design. The product does not need a different hierarchy or microservices at that store count.
- Other operators: every operational table is organization scoped and no cross-customer benchmarking is enabled by default.

## Reset and verification

Restart the development process to reset browser-only demo state. Fixture records are deterministic.

```bash
npm run db:seed
npm test
npm run build
```

