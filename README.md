# TraceOps Convenience Suite

TraceOps is a clean-slate, purpose-built convenience-retail maintenance intelligence suite. It connects store issues, operator work orders, internal teams, outside vendors, onsite visits, costs, preventive maintenance, equipment history and optional invoice evidence so managers can trace every dashboard number to its source records.

The c-store suite is intentionally specific: store and region visibility, refrigeration/HVAC depth, forecourt and foodservice context, outsourced service, simple employee intake and low-friction vendor participation. The umbrella name can later support other purpose-built industry suites and a master portfolio product.

> The legacy screens are not the product foundation. New work follows [the clean-slate suite plan](./docs/CSTORE_SUITE_PLAN.md), not the previous application's navigation, components or assumptions.

## Demo contract

The fictional demo operator, **Northline Fuel & Market**, has exactly:

- **15 stores** across three regions.
- **5 approved outside vendors**.
- A two-person internal maintenance team.
- Approximately 24 months of coherent HVAC, Refrigeration and supporting all-trades source records.

The five vendors are Summit Refrigeration, Cedar Mechanical, Forecourt Systems Group, BrightPath Electrical and Four Seasons Site Services.

The current hosted demo uses a deterministic static seed plus session-scoped interactions. Creating a work order, accepting a vendor assignment, checking in or reviewing an invoice demonstrates the connected experience during that session; it is not production-durable storage. Demo interactions are visibly labeled **Demo Mode** and may reset on refresh or a new session.

All charts, counts and narrative claims must derive from the static source records and current session state. Summary numbers are never independently hardcoded.

## Product shape

The principal evidence chain is:

> Issue or PM occurrence -> operator work order -> internal/outside assignment -> vendor issuance -> visit -> outcome/follow-up -> cost or invoice link -> dashboard/lifecycle/report drill-through

The operator work-order number is the customer's service-authorization and billing reference. Vendors can keep using their own dispatch and invoicing tools, but should include the TraceOps operator WO number on service documents and invoices. Operator WO, vendor ticket, vendor invoice and optional external PO remain separate identifiers.

Primary suite areas:

- **Overview and Spend** - company, region and store trends, outliers and exact source-record drill-through.
- **Stores** - search by number, name, address or alias; inspect work, visits, equipment, PM and cost.
- **Work** - simple issue intake, internal/outside/blended routing, vendor issuance and accountable follow-up.
- **Vendors and Visits** - searchable specialties/coverage, accountless response, QR/mobile/store-device check-in and no-WO exceptions.
- **Equipment, PM and Lifecycle** - flexible c-store taxonomy, assets/components, warranties, PM compliance and transparent capital review.
- **Invoices and Reports** - optional evidence review plus immutable/versioned management snapshots; never payment execution.

Customers may activate only the capabilities they need. Assets, PM, approvals/NTE, geofence evidence, store verification, vendor acceptance, invoice safeguard and vendor portal access are optional enrichments, not barriers to recording work.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No production credentials are required for the demo.

Useful commands:

```bash
npm run db:seed
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run start
```

`npm run db:seed` validates/generates the deterministic demo fixture. See [DEMO.md](./DEMO.md) for the presentation flow.

## Current hosting

The current preview is a Vinext/React application hosted through Sites. [`.openai/hosting.json`](./.openai/hosting.json) declares:

- Cloudflare D1 binding `DB`.
- Cloudflare R2 binding `FILES`.

These bindings remain available for the hosted preview, but the current demo experience should still be described accurately as static seed data plus session interactions. Local/session behavior is not a claim of production persistence, authentication, email delivery or accounting integration.

Never commit secrets. Production token, email, storage and database settings belong in environment variables.

## Render and PostgreSQL path

TraceOps is being kept portable for a future Render project:

- Keep persistence behind repository adapters rather than importing Cloudflare APIs throughout domain code.
- Target PostgreSQL through `DATABASE_URL` and repeatable migrations.
- Use S3-compatible private object storage rather than ephemeral local disk.
- Bind the server to the host-provided `PORT` and `0.0.0.0`.
- Separate web, release/migration and idempotent worker/cron entry points.
- Add liveness/readiness endpoints before production deployment.

A `render.yaml` should be created only when the new Render project is intentionally provisioned.

## Product boundaries

TraceOps is not a full accounting/AP suite, ERP, general ledger, payment system, POS, merchandising platform, inventory/warehouse system, payroll/timekeeping product, route optimizer, vendor dispatch replacement or continuous tracking product. Invoice review surfaces evidence and differences for a human; it never declares fraud or executes payment.

## Documentation

- [Clean-slate product/build plan](./docs/CSTORE_SUITE_PLAN.md) - primary product and implementation source of truth.
- [Demo walkthrough](./DEMO.md) - concise presentation sequence and demo truth statements.
- [Engineering guide](./AGENTS.md) - invariants and contributor rules for the rebuild.

Older product and architecture documents may provide research context, but they do not override the clean-slate TraceOps plan.
