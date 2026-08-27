# Product North Star

**Status:** durable product direction  
**Primary authority:** [CSTORE_PLATFORM_REBUILD_BLUEPRINT.md](CSTORE_PLATFORM_REBUILD_BLUEPRINT.md)

This document summarizes the approved blueprint and the compatible detail in the merged rebuild directive. If they conflict, the blueprint and repository `AGENTS.md` govern.

## Product

Build a closed-loop facilities control system for regional convenience-store operators, initially those with roughly 30–200 stores and a lean facilities team. It must connect simple store intake, the operator's canonical Work Order, internal or outside fulfillment, low-friction vendor participation, visit evidence, follow-up, cost safeguards, PM, equipment history, and management decisions.

The north star is:

> Plan required maintenance, route reactive problems, select an eligible provider, preserve what was authorized and observed, verify the outcome, protect contractual and financial obligations, and turn the resulting history into explainable operating and capital decisions.

For every meaningful maintenance dollar, management should be able to determine why the work existed, who owned and authorized it, why a provider was selected, whether a technician arrived, what the technician claimed, what equipment was affected, what warranty applied, what was recorded or invoiced, whether the result was verified, and what should happen next.

## Three product promises

1. **Nothing gets lost.** Every unresolved Work Order has one internal accountable owner, a plain-language next action, a due time or explicit no-SLA policy, and an escalation destination. The target implementation uses first-class Workflow Tasks; current scalar next-action fields are transitional.
2. **Every visit has context.** Authorization, provider, store, point-in-time arrival/checkout evidence, Work-Order-specific outcomes, and follow-up remain connected without requiring a vendor account or native app.
3. **Every insight has proof.** Every material metric, outlier, recommendation, and value claim opens the exact source records and preserves scope, period, cost basis, taxonomy, cohort, exclusions, and coverage.

## Canonical service thread

```text
Issue or PM occurrence
  -> review and authorization when required
  -> canonical operator Work Order
  -> internal work, direct outside assignment, or competitive estimate
  -> versioned service authorization and provider response
  -> observed Site Visit
  -> Work-Order-specific outcome and follow-up
  -> recorded cost and optional invoice evidence
  -> verification, resolution, and closure
  -> store, vendor, PM, equipment, lifecycle, and value drill-through
```

The Work Order is the customer's service-authorization and billing reference. Vendor ticket number, vendor invoice number, and optional external accounting PO remain separate identifiers. A request or PM occurrence is a source record, not a competing top-level maintenance record.

## Must-win loops

Prioritize complete, server-enforced loops in this order:

1. Reactive issue through verified closure.
2. Several independent Work Orders executed through one visit or Service Run without merging their histories.
3. PM program through immutable occurrence, asset-level Work Items, visit, deficiency, and corrective Work Order.
4. Repair Item through applied warranty, repeat failure, routing, coverage decision, and billing protection.
5. Quote/estimate through authorization, work, invoice evidence, reconciliation, and source-linked value.
6. Executive outlier through evidence, human decision, and recorded outcome.

A loop is not complete merely because a fixture, screen, or table exists. It requires persisted domain behavior, server authorization, audit, errors and empty states, deterministic seed coverage, and automated tests.

## Product boundaries

TraceOps is a temporary configured label, not a durable domain name. This edition uses c-store language and workflows. It is not a ticketing skin, vendor marketplace, vendor dispatch product, route optimizer, POS, inventory system, payroll/time clock, general ledger, AP/payment executor, legal contract-authoring platform, or continuous-location tracker.

Capabilities such as assets, PM, NTE, geofence observations, vendor acceptance, invoices, and portal accounts are additive. A valid Work Order requires only an organization-scoped store and a plain-language problem; classification can follow later.

## Value standard

Keep these categories separate:

- **Money requiring review:** an unresolved amount or evidence exception.
- **Identified exposure/opportunity:** a supported risk or possible benefit that is not yet achieved.
- **Confirmed outcome:** a reviewed result with source evidence.
- **Realized customer value:** a completed, attributable financial benefit such as a credit or prevented duplicate charge.

Never monetize PM completion or infer downtime without evidence. Never combine estimated opportunity with realized value.

## Customer-caliber and demo truth

The production architecture must support approximately 63-store-caliber operators. The presentation tenant remains fictional Clark Pump and Shop with exactly 15 stores across three regions, exactly five approved outside vendors, and two internal technicians. A separate approximately 65-store synthetic fixture proves scale; it must never be presented as a prospect's network.

## Current implementation boundary

The repository has a durable foundation for tenant-keyed Work Orders, direct issuance, competitive estimates, public vendor actions, visits, follow-ups, costs, audit, idempotency, D1/PostgreSQL persistence, and deterministic fixtures. It does **not** yet implement the full Workflow Task/SLA engine, production identity and authorization, multi-Work-Order Site Visits, Service Runs, operational contracts, repair-level warranty, production imports, destructive reset, or delivery/escalation workers. See [REBUILD_IMPLEMENTATION_STATUS.md](REBUILD_IMPLEMENTATION_STATUS.md).
