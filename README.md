# Convenience Retail Facilities Suite

The current product name is a temporary presentation value held in one configuration file. The product itself is a clean-slate, purpose-built convenience-retail maintenance intelligence suite. It connects store issues, operator work orders, internal teams, outside vendors, onsite visits, costs, preventive maintenance, equipment history and optional invoice evidence so managers can trace every dashboard number to its source records.

The c-store suite is intentionally specific: store and region visibility, refrigeration/HVAC depth, forecourt and foodservice context, outsourced service, simple employee intake and low-friction vendor participation. The umbrella name can later support other purpose-built industry suites and a master portfolio product.

> The legacy screens are not the product foundation. New work follows [the rebuild blueprint](./docs/CSTORE_PLATFORM_REBUILD_BLUEPRINT.md), not the previous application's navigation, components or assumptions.

## Demo contract

The fictional demo operator, **Northline Fuel & Market**, has exactly:

- **15 stores** across three regions.
- **5 approved outside vendors**.
- A two-person internal maintenance team.
- Approximately 24 months of coherent HVAC, Refrigeration and supporting all-trades source records.

The five vendors are Summit Refrigeration, Cedar Mechanical, Forecourt Systems Group, BrightPath Electrical and Four Seasons Site Services.

The hosted showcase seeds the fictional tenant into Cloudflare D1 and writes workflow changes back through the same tenant-scoped repositories and domain commands. Uploaded evidence uses the private R2 binding. Local development uses the same deterministic fixture through an in-memory repository and resets when the local process restarts.

The presentation fixture currently contains **92 intake requests, 117 work orders across 20 months, 115 visits, 138 assets, 835 component records, 75 PM occurrences and 21 invoice references**. It includes internal work, all five outside vendors, deferred assignment, unmatched visits, component-level repeat work, confirmed/suggested/unmatched invoice references and source-linked files/audit events.

All charts, counts and narrative claims derive from source records. Summary numbers are never independently hardcoded.

## Product shape

The principal evidence chain is:

> Issue or PM occurrence -> operator work order -> internal/outside assignment -> vendor issuance -> visit -> outcome/follow-up -> cost or invoice link -> dashboard/lifecycle/report drill-through

The operator work-order number is the customer's service-authorization and billing reference. Vendors can keep using their own dispatch and invoicing tools, but should include the operator WO number on service documents and invoices. Operator WO, vendor ticket, vendor invoice and optional external PO remain separate identifiers.

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

The commands above preserve the Cloudflare/Sites preview. The portable Node
runtime intended for Render is separate:

```bash
npm run dev:render
npm run build:render
HOSTNAME=0.0.0.0 PORT=3000 npm run start:render
```

`npm run dev:render` uses the deterministic in-memory fixture locally. A deployed
Render process fails closed unless `DATABASE_URL` points to PostgreSQL. See the
[isolated Render deployment guide](./docs/RENDER_DEPLOYMENT.md) for the service,
database, migration, private-object-storage and health-check settings.

`npm run db:seed` validates/generates the deterministic demo fixture. See [DEMO.md](./DEMO.md) for the presentation flow.

## Current hosting

The current preview is a Vinext/React application hosted through Sites. [`.openai/hosting.json`](./.openai/hosting.json) declares:

- Cloudflare D1 binding `DB`.
- Cloudflare R2 binding `FILES`.

The hosted app requires D1 in production and does not silently fall back to fixtures. The local repository is a development fallback only. The preview role switcher is not a production identity provider, outbound messages currently stop in the outbox, and no accounting API is connected.

Never commit secrets. Production token, email, storage and database settings belong in environment variables.

## Render and PostgreSQL runtime

The separate Render runtime now provides:

- A tenant-scoped PostgreSQL repository selected through `DATABASE_URL`.
- Repeatable migrations plus idempotent, advisory-locked demo seeding.
- S3-compatible private object storage behind the same file-store boundary as R2.
- A standard Next Node server bound to `0.0.0.0` and Render's injected `PORT`.
- `/api/health` liveness and sanitized `/api/ready` persistence checks.
- CI gates for fixture validation, typecheck, lint, tests and both hosting builds.

The Sites/D1/R2 preview remains intact. This application must use its own Render project,
PostgreSQL database, object-storage bucket and credentials; never reuse DockSafe
resources. No `render.yaml` is included, so infrastructure cannot be provisioned
into the wrong Render project by an accidental Blueprint sync.

## Product boundaries

The suite is not a full accounting/AP suite, ERP, general ledger, payment system, POS, merchandising platform, inventory/warehouse system, payroll/timekeeping product, route optimizer, vendor dispatch replacement or continuous tracking product. Optional invoice-reference review surfaces evidence and differences for a human; it never declares fraud or executes payment.

## Documentation

- [Rebuild blueprint](./docs/CSTORE_PLATFORM_REBUILD_BLUEPRINT.md) - primary product and implementation source of truth.
- [Earlier suite plan](./docs/CSTORE_SUITE_PLAN.md) - retained product history where it does not conflict with the blueprint.
- [Render deployment guide](./docs/RENDER_DEPLOYMENT.md) - isolated PostgreSQL/S3 web-service setup and verification.
- [Demo walkthrough](./DEMO.md) - concise presentation sequence and demo truth statements.
- [Engineering guide](./AGENTS.md) - invariants and contributor rules for the rebuild.

Older product and architecture documents may provide research context, but they do not override the clean-slate platform blueprint.
