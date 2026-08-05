# Maintenance Intelligence

**Maintenance Intelligence** is a temporary, changeable product label. Clark's is only the fictional pilot/demo tenant; it is not the software brand.

This repository demonstrates a dashboard-first maintenance spending, preventive-maintenance, lifecycle and vendor-accountability platform for convenience-store operators and other multi-site or independent businesses. The main experience is visual visibility: switch company, division, region or store scope, traverse the organization's configurable maintenance taxonomy, and open the exact work, visit, PM, cost or optional invoice records behind a number.

The operator's work order is the connected source record, not the product's center of gravity. Maintenance workflows stay deliberately simple so they create trustworthy cost and accountability data without becoming a dispatch system.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No credentials are required. The role selector previews fictional personas and is visibly Demo Mode. Vendor email/deep-link and technician QR paths do not require an account; the vendor portal is optional.

## Principal demo routes

- `/` - interactive company/division/region/store spending dashboard and source-record drill-down
- `/stores` - search stores by number, name or address
- `/stores/store-45` - Store 45 dashboard and taxonomy/equipment depth
- `/pm` - PM compliance, due/missed work and lifecycle intelligence
- `/accountability` - vendor response, visits, evidence and optional invoice-safeguard preview
- `/reports` - generated management reports, handoff and archive records
- `/maintenance` - intentionally simple maintenance workspace
- `/work-orders/wo-0245` - useful work-order detail and linked evidence
- `/equipment` - company taxonomy, assets, components and lifecycle records
- `/setup` - organization/store/taxonomy setup
- `/email-outbox` - vendor email, acceptance link and store QR
- `/vendor/accept/accept_demo_0245_K3p9nQ7w` - accountless vendor response
- `/technician/store_demo_45_Y8m4xB2p` - store QR check-in/out flow
- `/vendor-portal` - optional recurring-vendor workspace

See [DEMO.md](./DEMO.md) for the scripted walkthrough.

## Product shape

The presentation is a story-rich 12-store Clark's showcase. A separate automated approximately 65-store fixture proves search, pagination and aggregate behavior without cluttering the demo, and a one-store fixture proves that divisions, regions and enterprise-only comparisons are never required.

Two independent axes drive dashboards and reporting:

- Organization scope: company -> optional division -> optional region -> store.
- Maintenance taxonomy: category/department -> any number of organization-defined nested groups -> store asset -> optional component tree.

Each store activates only the company taxonomy branches it uses. Work remains valid at store or category level, and unclassified amounts remain visible.

The optional invoice safeguard can upload/import an invoice, link it to work orders and observed visits, and show evidence or mismatch exceptions for human review. It is not a full accounting/AP suite, ERP, purchase-order system, general ledger or payment product.

## Data modes

Dashboard and report values are calculated from deterministic source records; summary cards are not separately hardcoded. The committed Drizzle schema and SQL migrations define the persistent Cloudflare D1 model. R2 is declared for private file bytes. The upload route uses R2 when its binding is available and clearly reports session-only preview behavior locally.

Run the fixture integrity check with:

```bash
npm run db:seed
```

Production authentication, durable command repositories, email delivery, ERP/API integrations and private download authorization remain explicit later phases.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

The quality bar covers tenant isolation, optional organization scopes, progressive and uneven-depth classification, store search, one-store adaptation, approximately 65-store pagination, QR visit states, PM compliance, unresolved follow-up, invoice attribution and metric-to-record drill-down.

## Product and architecture decisions

- [Competitive research](./docs/competitive-research.md) - sourced market patterns and Keep/Adapt/Avoid decisions
- [Product specification](./docs/product-spec.md) - roles, information architecture, workflows, metrics and scope
- [Architecture](./docs/architecture.md) - tenancy, taxonomy, storage, security, queries, testing and production path
- [Repository assessment](./docs/repository-assessment.md) - starting condition and stack decision
- [Engineering invariants](./AGENTS.md) - rules future contributors must preserve

## Scope boundaries

The deepest demo data is HVAC and Refrigeration, while the taxonomy supports any maintenance trade. The product intentionally does not recreate vendor dispatch/FSM, full accounting or AP automation, purchase-order administration, accruals, payment tracking/execution, POS, retail inventory, payroll/scheduling, parts inventory, a vendor marketplace, continuous tracking or predictive AI. Lifecycle guidance recommends transparent human review and exposes every reason and threshold.

## Known demo limitations

- The role selector is presentation tooling, not authentication.
- Local changes may be session previews where a persistent route is not yet connected.
- Email uses an on-screen outbox.
- Real geolocation depends on browser permission and fictional coordinates; demo states cover inside, outside, denied and inaccurate readings.
- Seeded documents are safe fictional placeholders, not real service records.
- Rule thresholds are illustrative defaults and require customer governance before operational use.
