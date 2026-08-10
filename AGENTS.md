# TraceOps Convenience Suite Engineering Guide

These rules govern the clean-slate TraceOps Convenience Suite rebuild. The primary product and build source of truth is [`docs/CSTORE_SUITE_PLAN.md`](docs/CSTORE_SUITE_PLAN.md).

## Rebuild boundary

- TraceOps is a purpose-built convenience-retail suite. It is not a reskin of the previous application.
- Legacy screens, routes, components, seed assumptions and information architecture are not the product foundation. Rebuild from the approved suite plan; do not patch legacy UI merely because it already exists.
- The umbrella name can later serve other industry suites, but this edition should use c-store language, workflows, taxonomy and demo stories without exposing hypothetical industrial complexity.
- Build a modular monolith for V0. Share domain commands and infrastructure, not one giant configurable interface for every possible industry.

## Product contract

TraceOps connects:

> Issue or PM occurrence -> operator work order -> internal/outside assignment -> vendor issuance -> observed visit -> outcome/follow-up -> cost or invoice link -> dashboard/lifecycle/report drill-through

- The operator work order is the canonical service record and the customer's service-authorization/billing reference. It behaves like a lightweight PO reference but is not formal purchase-order management.
- Keep the operator work-order number, vendor service-ticket number, vendor invoice number and optional external accounting PO as separate fields.
- Workflows must support internal, external and blended fulfillment on one lifecycle.
- Vendor adoption is optional. Secure email/SMS links, printable authorization, QR/mobile web and store-device flows must work without a portal account.
- Customers can use as much or as little as they need. Assets, PM, approvals/NTE, geofence evidence, store verification, vendor acceptance, invoices and vendor portal access are additive capabilities, not prerequisites for basic work.

## Manager-first experience

- Dashboards, search, store visibility, spend, outliers, PM exceptions and lifecycle review are the product star.
- Every principal metric, chart segment, exception and outlier must open the exact supporting source records.
- Preserve visible scope, period, cost basis, taxonomy path, cohort and classification coverage through drill-down.
- Keep operating scope separate from maintenance taxonomy:
  - `organization -> optional division -> optional region -> store`
  - `category -> zero or more organization-defined groups -> asset -> optional component tree`
- A work order is valid with a store and problem only. Category, asset and component can be classified later without inventing placeholders.
- Use plain cost labels: recorded work cost, approved amount, linked invoice amount and unmatched invoice amount. Never use vague financial language or silently combine bases.

## Tenant, data and audit invariants

- Every tenant-owned read, write, search, aggregate, export, file and job is bounded by `organization_id` before any role or location filter.
- Stores have stable IDs plus separate store number, name, structured address and searchable aliases.
- Lists and search use server-side filtering, indexed ordering and stable pagination. Do not load the whole tenant into the browser.
- Dashboard values are derived from persisted requests, work orders, assignments, visits, PM occurrences, costs, invoices and allocations. Never hardcode independent summary totals.
- Store money as integer minor units with currency. Estimate, authorization/NTE, entered cost and invoice bases stay distinct.
- Employee reports, issuance revisions, vendor responses, visit evidence, finalized costs, invoice links, due-date changes and report versions are append-only or corrected by auditable amendment. Never silently overwrite source facts.
- Every non-terminal unresolved work order has an accountable party, next required action, due timestamp and escalation destination.
- Domain mutations and their audit events commit in the same transaction. All UI and public-link channels invoke the same domain commands.

## Vendor and visit rules

- Work-order routing asks **Internal maintenance**, **Outside vendor** or **Choose later**. Outside-vendor search covers name, specialty, plain-language aliases, equipment type, store/region coverage and preferred relationships.
- Issuing work creates an immutable/versioned Work Order / Service Authorization with the operator WO number and billing instruction.
- Vendor response supports accept, decline, propose date and ask a question without requiring an account. Manual phone/email responses remain visibly attributed.
- QR/mobile web, secure work-order link and trusted store device create the same channel-independent active visit. A technician may start and end through different channels.
- Only that vendor's eligible work appears. **No work order provided / I don't see my work order** must create a reviewable unmatched visit rather than blocking service.
- Location is captured only at check-in/out when policy enables it; never continuously. Preserve accuracy, distance, timestamp, consent/result and verification status.
- Never backdate a verified timestamp. A reported arrival is a separate, visibly unverified assertion with reporter and reason.
- Observed onsite duration is approximate presence evidence, not certified labor or automatic invoice proof.
- Unresolved checkout outcomes create the required follow-up atomically.

## PM, lifecycle and invoice safeguards

- PM occurrences may create the same canonical work orders as reactive requests. Compliance always shows numerator, denominator, window and source occurrences.
- Asset lifecycle uses transparent age, expected-life, warranty, repeat-work, cost and PM rules. It may recommend human capital review, never an opaque health score or automatic replacement.
- Do not infer downtime from ordinary work records.
- Invoice upload/import and matching are optional evidence safeguards. Exact operator WO reference is the first match key; suggestions require human confirmation.
- Invoice allocation must reconcile without double counting. Missing links and unmatched balances remain visible.
- Differences in amount, visit count, duration or evidence are review facts, not automatic proof of invalid work. TraceOps does not approve or execute payment.

## Product boundaries

In scope: store network, issue intake, operator work orders, internal teams, vendor CRM/issuance, visit evidence, follow-ups, work costs, optional invoice review, equipment, PM, lifecycle, dashboards, reports and audit.

Out of scope: full accounting/AP, general ledger, payments, tax, formal purchasing/receiving, POS, merchandising, retail inventory, payroll, shift scheduling, route optimization, vendor dispatch replacement, vendor marketplace and continuous tracking.

## Demo contract

- The presentation tenant is fictional Northline Fuel & Market with **exactly 15 stores and exactly five approved outside vendors**. It also has a two-person internal maintenance team.
- Use three regions with five stores each and realistic HVAC/Refrigeration depth plus smaller forecourt, plumbing and exterior-service stories.
- Every demo total must derive from source seed records. Provide explicit unclassified buckets rather than hiding shallow records.
- The current hosted demo uses deterministic static seed data plus session-scoped interactions. Simulated creates and updates must be labeled Demo Mode and must not be described as durable production persistence.
- A refresh/new session may reset interactive changes. The seeded baseline must remain deterministic.
- Separate automated fixtures must prove a one-store operator and approximately 65 stores without changing the 15-store presentation.

The five seeded vendors are:

1. Summit Refrigeration - refrigeration, HVAC, walk-ins, beer caves and ice machines.
2. Cedar Mechanical - HVAC, plumbing and foodservice equipment.
3. Forecourt Systems Group - dispensers, payment terminals and fuel systems.
4. BrightPath Electrical - electrical, canopy lighting, signs and low-voltage security.
5. Four Seasons Site Services - landscaping, snow, parking lots and exterior facilities.

## Current hosting and future portability

- Current local/hosted preview scripts use Vinext and Node.js 22.13+.
- `.openai/hosting.json` currently declares Cloudflare D1 as `DB` and R2 as `FILES`. Preserve these bindings while this Sites-hosted preview remains active.
- Never put credentials or production token material in source. Use environment variables and keep action-token material opaque, purpose-bound, expiring and hashed at rest.
- The future target is Render with PostgreSQL. New domain and repository code must not depend directly on Cloudflare-only APIs; isolate D1/R2 behind adapters.
- Production portability requires `DATABASE_URL`, PostgreSQL-compatible migrations, S3-compatible private object storage, an injected `PORT`, health endpoints and idempotent worker/cron entry points.
- Do not add `render.yaml` until the Render project is intentionally created. Do not use ephemeral local disk for production uploads.

## Required quality checks

Before claiming completion, run:

```bash
npm run db:seed
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

Then inspect manager search/drill-down, store creation, work-order routing with deferred classification, vendor action link, cross-channel technician visit, no-WO exception, invoice safeguard, PM/lifecycle and responsive store/mobile views in a browser. No principal metric or primary workflow may end at a dead control.
