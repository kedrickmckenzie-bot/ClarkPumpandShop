# Clark's Operations

A production-shaped demonstration of maintenance operations and asset intelligence for convenience-store operators. It is designed for an initial regional pilot of about 65 stores while retaining the same organization, work-order and asset hierarchy for a single independent store.

The product’s source of truth is the operator’s internal work order. It connects employee reports, manager review, vendor response, technician visit evidence, unresolved follow-up, PM, files, invoices, cost allocations, system/asset history and explainable capital review.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No credentials are required. Use the role selector in the top bar to preview fictional personas. External vendor and technician pages use opaque demo links and do not require login.

## Principal demo routes

- `/` — company command center and Store 45 outlier
- `/work-orders` — searchable, paginated internal work queue
- `/work-orders/wo-0245` — completed cashier-to-cost story
- `/stores/store-45` — outlier store detail
- `/stores/store-45/systems/sys-45-ref` — Beer Cave Refrigeration
- `/assets/asset-45-ref-cu1` — explainable replacement review
- `/components/component-45-fan` — optional component depth
- `/pm` — preventive-maintenance plans, occurrences and compliance
- `/vendors` — lightweight vendor-response boundary
- `/files` — files, invoices, allocations and upload preview
- `/reports/new` — focused employee intake
- `/email-outbox` — vendor email, acceptance link and store QR
- `/vendor/accept/accept_demo_0245_K3p9nQ7w` — vendor response
- `/technician/store_demo_45_Y8m4xB2p` — real/demo geofence visit flow

See [DEMO.md](./DEMO.md) for the scripted walkthrough.

## Data modes

The local UI uses a deterministic TypeScript fixture with 65 fictional stores, 536 work orders, 520 cost centers, hundreds of tagged assets and components, 64 PM occurrences, an internal maintenance roster, and linked operational/financial evidence. Dashboard and reporting values are calculated from those records; summary cards are not independent hardcoded totals.

The committed Drizzle schema and SQL migration define the persistent Cloudflare D1 model. Every tenant-owned table carries `organization_id`; region is optional. R2 is declared for private file bytes. The upload route stores to R2 when its binding is available and clearly returns session-only mode locally. Run the fixture integrity check with:

```bash
npm run db:seed
```

This demonstration does not pretend browser session mutations are durable. Productionizing D1 writes, authentication, email delivery and private download authorization remains an explicit next phase.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

The test suite covers progressive classification, tenant isolation, optional regions, a 65-store paginated scenario, geofence states, opaque tokens, PM compliance, unresolved follow-ups, close guards, allocation reconciliation, vendor projections, replacement explanations and the complete CWO-0245 journey.

## Product and architecture decisions

- [Competitive research](./docs/competitive-research.md) — 17-product landscape, source links, table stakes, gaps and Keep/Adapt/Avoid decisions
- [Product specification](./docs/product-spec.md) — roles, information architecture, workflows, metrics, rules and scope
- [Architecture](./docs/architecture.md) — tenancy, schema, storage, security, APIs, testing and production path
- [Repository assessment](./docs/repository-assessment.md) — starting condition and stack decision
- [Engineering invariants](./AGENTS.md) — rules future contributors must preserve

## Scope boundaries

The first version focuses on HVAC and Refrigeration. It intentionally does not recreate a vendor field-service system, POS, retail inventory, payroll/scheduling, payments/AP, parts inventory, marketplace, continuous tracking, native app or predictive AI. Vendor office action is accept/decline/clarify; technician action is visit verification and a basic outcome. Replacement signals recommend human capital review and expose every reason and threshold.

## Known demo limitations

- The role selector is presentation tooling, not authentication.
- Local changes are session previews; persistent write repositories are the next phase.
- Email uses an on-screen outbox.
- Real geolocation depends on browser permission and the fictional Store 45 coordinates; visible demo states cover inside, outside, denied and inaccurate readings.
- Seeded “documents” are safe fictional text placeholders, not real service records.
- Rule thresholds are illustrative defaults and require customer governance before operational use.
