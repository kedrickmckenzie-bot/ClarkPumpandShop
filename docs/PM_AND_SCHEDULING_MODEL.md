# PM and Scheduling Model

**Status:** target model; current PM support is thin and Service Runs are not implemented

Preventive maintenance is a versioned operating obligation, not a recurring calendar entry. PM and reactive work converge on the same canonical Work Order and visit engine.

## PM records

### Maintenance Program

A reusable, versioned service definition: trade/work type, applicable Asset Types, fixed-calendar or completion-based cadence, due window, seasonal rules, checklist/evidence, expected duration, completion criteria, deficiency handling, and on-site corrective-work authority.

### Maintenance Plan

Applies one Program version to Stores and Assets/selection rules with effective dates, preferred/backup Vendor, Contract Version, access requirements, budget/authorization, SLA, scheduling mode, and escalation rules. An approved plan may preauthorize routine recurring PM; out-of-scope corrective work creates a deficiency, corrective Work Order, quote/estimate request, and approval as policy requires.

### Maintenance Occurrence

An immutable due obligation. Preserve original due window and Program/Plan versions, then append proposed/committed/rescheduled/completed facts. Generation is idempotent and keyed by plan plus recurrence slot.

Use distinct outcomes: `UPCOMING`, `UNSCHEDULED`, `PROPOSED`, `SCHEDULED`, `COMPLETED_EARLY`, `COMPLETED_ON_TIME`, `COMPLETED_LATE`, `MISSED`, `WAIVED`, and `CANCELED`. A reschedule never rewrites the original due obligation or compliance denominator.

### Work Item

One PM Work Order may contain several Asset-level Work Items. Each retains Asset/Component, required task, checklist, measurements, evidence, result, deficiency, follow-up, and cost allocation. Do not use one undifferentiated store-level completion fact when several assets were serviced.

## Bundled execution

```text
ServiceRun
  -> RouteStop (one Store)
       -> planned independent Work Orders
       -> SiteVisit
            -> SiteVisitWorkOrder outcome for each selected Work Order
```

Bundling coordinates provider travel/presence only. Work Order scope, priority, authorization, Asset/Component history, warranty, cost, verification, resolution, and closure remain independent.

Scheduling modes are:

- **Platform-directed:** only when an effective Contract reserves capacity and grants commitment authority.
- **Platform-proposed, vendor-confirmed:** default; vendor can accept, counter, request stop/Work Order changes, report insufficient capacity, or decline with a structured reason.
- **Vendor-planned:** vendor proposes a route inside supplied obligations/due windows; the platform validates it.

Original recommendations, constraints, estimated economics, vendor counterproposals, and the final committed plan are immutable/versioned history.

## Eligibility and hard constraints

Before optimization, validate organization/store scope, Vendor status and coverage, trade/work/Asset qualifications, mandatory certifications and compliance, Contract scope/version, warranty-mandated provider, exclusivity, authorization, PM window, store access/shutdown needs, capacity, maximum route duration/travel, emergency SLA, and required equipment.

Expired blocking compliance or absence of a governing Contract prevents commitment unless an authorized, time-bounded exception records reason and audit. The platform never commits beyond Contract scheduling authority.

## Optimization and duration protection

After all hard constraints pass, prefer same-store and nearby-store bundling, fewer truck rolls/trip charges, related work, due-date compliance, contracted volume, provider reliability, store convenience, balanced capacity, and emergency reserve. Every recommendation exposes inputs, constraints, exclusions, expected duration/value, confidence, missing data, Contract version, and scheduler version.

Use task-class duration distributions only where sample size supports them. Protect plans with travel, stop, documentation, uncertainty, and emergency buffers; maximum theoretical utilization must remain below 100%. Low-confidence diagnostic/high-risk work receives more protection and cannot silently make a route infeasible.

Proposed trip savings are estimated opportunity. They become confirmed/realized only after provider acceptance, actual combined visits/outcomes, and contract/invoice evidence support the avoided charge or travel.

## Current implementation boundary

Current `PmPlan` and `PmOccurrence` records contain cadence, a due window, Store/Asset links, and basic status. The fixture derives PM views from persisted occurrences. There is no Maintenance Program/version, Work Item/checklist, recurrence job, immutable reschedule history, Service Run, Route Stop, capacity, Contract, qualification/compliance gate, scheduler, counterproposal, or route-value verification. These capabilities are **not complete**.

The next PM slice begins only after the reactive Work Order/Workflow Task/verification foundation is stable. It must prove idempotent occurrence generation through Work Order, Work Items, eligible provider, visit, deficiency/follow-up, compliance drill-through, and audit.
