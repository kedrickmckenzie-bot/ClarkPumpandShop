# Target Domain Model

**Status:** target model; implement incrementally  
**Current comparison:** [AS_IS_ARCHITECTURE.md](AS_IS_ARCHITECTURE.md)

The target is one brand-neutral, tenant-scoped domain inside a modular monolith. Do not create unused tables merely to make this catalog appear complete. Add a concept only with the vertical slice that enforces and exercises it.

## Organization and taxonomy

```text
Organization
  -> optional Division
    -> optional Region
      -> Store
        -> Store Area

Category
  -> zero or more organization-defined Groups
    -> Asset
      -> optional Asset Component tree
```

Operating scope and maintenance/equipment taxonomy are independent. Every tenant-owned record contains or derives one `organization_id`; authorization applies organization first, then role and location/vendor/record scope. Stable IDs are separate from store number, name, address, and aliases.

A Work Order is valid with a Store and problem only. Category, group, Asset, Component, failure, and trade may remain explicitly unclassified until a qualified user enriches the record.

## Bounded modules and aggregates

| Module | Aggregate roots and records | Current state |
|---|---|---|
| Identity and tenancy | Organization, User, Membership, Role, ScopeGrant, ApprovalAuthority, Delegation | Organization/membership/scope records exist; production identity and full policy enforcement are target |
| Portfolio | Division, Region, Store, StoreArea, operating hours, access windows | Core hierarchy/store exists; hours/areas/access calendars are target |
| Intake | Issue/ServiceRequest, immutable facts, attachments, review/duplicate/decline decisions | Basic request and conversion exist; richer impact/review history is partial |
| Service control | WorkOrder, WorkflowTask, hold/SLA history, ApprovalRequest, VendorAssignment, issuance revision | Work Order/assignment/issuance exist; approval partial; WorkflowTask/SLA target |
| Estimates | EstimateRequest, immutable proposal revisions, selection/withdrawal | Implemented foundation; continue to treat as pricing, never authorization or cost |
| Provider network | Vendor, contact, specialty, coverage, qualification, compliance, capacity | Vendor/specialty/coverage exist; remaining records target |
| Visits/evidence | SiteVisit, SiteVisitWorkOrder, location observation, evidence, FollowUp, unmatched/unplanned visit | Single-WO visit foundation exists; join entity and multi-WO outcomes target |
| PM | MaintenanceProgram, MaintenancePlan, MaintenanceOccurrence, WorkItem, checklist | Thin plan/occurrence exists; versioned programs and Work Items target |
| Scheduling/contracts | VendorContract, ContractVersion, RateCard, ServiceLevelPolicy, SchedulingPolicy, ServiceRun, RouteStop | Target; not implemented |
| Equipment/lifecycle | AssetType, Asset, ComponentType, AssetComponent, ComponentLifecycleEvent, RepairItem, ReplacementProfile/Benchmark/Event, AssetRecommendation/Decision | Asset/component and replacement foundation exist; RepairItem and versioned recommendations/decisions target |
| Warranty | WarrantyPolicy, WarrantyRule, coverage line, AppliedWarranty, WarrantyAmendment, WarrantyCase | Target; simple dates are not this model |
| Cost/safeguards | Quote, AuthorizationRevision, CostLine, Invoice, InvoiceLine, allocation, credit/void evidence, ValueEvent | Cost/reference/allocation and proposal foundations exist; governed model partial/target |
| Platform | Attachment/File, Comment, AuditEvent, Notification, Escalation, OutboxEvent, JobRun, ImportBatch/Row, DataQualityIssue, MetricDefinition/Snapshot | Audit/outbox/file exist; delivery, jobs, imports, quality queue, metric registry target |

## Canonical relationships

```text
Issue or MaintenanceOccurrence
  -> WorkOrder
       -> WorkflowTask(s)
       -> ApprovalRequest(s) -> ApprovalDecision(s)
       -> VendorAssignment -> IssuanceRevision -> VendorResponse(s)
       -> EstimateRequest(s) -> ProposalRevision(s) -> one selected provider
       -> SiteVisitWorkOrder <- SiteVisit <- RouteStop <- ServiceRun
       -> WorkItem(s)
       -> RepairItem(s) -> AppliedWarranty(s) -> WarrantyCase(s)
       -> CostLine(s)
       -> InvoiceLineAllocation(s) <- InvoiceLine <- Invoice
       -> FollowUp / ServiceDiscrepancy
       -> ValueEvent / AssetRecommendation / AssetDecision
       -> AuditEvent(s)
```

The Work Order remains independent when execution is bundled. Service Run and Site Visit coordinate execution; they never merge scope, authorization, verification, cost, Asset history, warranty, or closure.

## Aggregate and history rules

- Mutations execute through named domain commands, not direct UI status writes.
- A command accepts actor context, organization ID, input, expected state/version, and an idempotency key when retry is plausible.
- Domain mutation, audit event, and outbox intent commit in one transaction.
- Requests, submitted proposals/Quotes, approved Authorizations, issuance revisions, provider responses, visit evidence, repair facts, Applied Warranties, finalized costs, invoice links/allocations, policy versions, and completed decisions are append-only or corrected by attributed amendment.
- Money uses integer minor units plus currency. Estimate, authorization/NTE, recorded work cost, invoice, allocation, customer responsibility, and realized value remain separate bases.
- UTC instants are stored; store-local timezone and calendars drive presentation and SLA calculations.
- Public capabilities are opaque, hashed at rest, purpose/record/organization-bound, expiring or revocable, narrow, rate-limited, and audited.
- Files are private, tenant-owned records with random organization-prefixed keys, checksum, size/type validation, visibility, and a malware-scanning boundary.

## Canonical terminology

Use `Work Order`, `Workflow Task`, `Vendor Assignment`, `Service Run`, `Route Stop`, `Site Visit`, `Site Visit Work Order`, `Work Item`, `Repair Item`, `Quote`, `Authorization`, `Invoice`, `Warranty`, and `Value Event` consistently. Do not introduce Ticket, Job, Service Call, Repair Record, or generic Case as competing service records. A governed `WarrantyCase` or `ServiceDiscrepancy` is allowed only as a child investigation linked to a Work Order.

## Portability boundary

Domain modules depend on repository, clock, identifier, file, messaging, and provider interfaces—not Cloudflare or PostgreSQL APIs. Current D1/R2 and future PostgreSQL/S3-compatible implementations are adapters. See [ADR 0001](adr/0001-selective-clean-slate-modular-monolith-and-portable-persistence.md).
