# Competitive Research and Product Decisions

**Research date:** August 5, 2026
**Scope:** Multi-site facilities and CMMS platforms relevant to a 65-store convenience-retail operator and independent stores
**Source policy:** Official product, help, developer and customer-story sources only

## 1. Research question

The clean rebuild is not trying to reproduce every feature of an enterprise CMMS. The research asks a narrower question:

> What operating patterns make multi-site maintenance coherent from store request through provider work, follow-up, cost and asset history, and which patterns can remain simple enough for a one-store operator and low-friction vendors?

The strongest comparisons are ServiceChannel, Fexa, Corrigo, FMX and Ecotrak. MaintainX, Limble and Fiix provide useful evidence for progressive asset classification, location hierarchy and smaller-team usability. Vendor claims are self-reported and features may depend on plan or configuration.

## 2. Market consensus

Mature products converge on this lifecycle:

```text
Simple location request
→ triage and authorization
→ canonical work order
→ internal or provider assignment
→ acceptance and visit
→ completion, follow-up or proposal
→ verification
→ invoice review
→ cost and asset history
```

The important shared patterns are:

- The work order is the operational spine. Visits, messages, proposals, invoices and asset history attach to it.
- Store intake is simpler than the final work record. Triage adds trade/category, priority, provider, SLA, NTE and equipment context.
- Internal and external fulfillment can share one work-order history.
- Provider routing is usually driven by location, trade/category and priority, with fallback after decline or missed response.
- Check-in/out records time and location evidence; it is not proof of repair quality.
- NTE, proposal, authorization, invoice, credit and payment are different stages.
- Asset and PM value grows from connected work history, not from a standalone asset registry.
- Portfolio dashboards are useful only when users can reach the exact work orders and costs underneath them.
- Successful rollout separates location commissioning, workflow configuration, data import and role-specific training.

## 3. Platform findings

### ServiceChannel

ServiceChannel is the clearest enterprise example of a multi-location owner/provider operating model.

#### What it does

- Puts internal and external work orders in one system.
- Lets location staff describe issues, attach media, use guided troubleshooting and track provider arrival.
- Routes work to an internal or external provider based on location and trade and can reassign after a decline.
- Supports provider app, GPS, IVR, badge and API check-in/out methods.
- Connects problem-code NTE controls, proposals, RFPs, multi-level approvals, invoice validation and disputes to work.
- Generates PM work and can bundle multiple asset tasks at a location.
- Imports assets in bulk and lets authorized providers validate equipment onsite.
- Reports spend by asset, provider, location, district, region and category, with drill-down to work-order detail.
- Offers provider APIs and webhooks so a service company can continue using its own system.

#### Relevant evidence

- [Work orders, internal/external fulfillment, routing, NTE and PM](https://servicechannel.com/products/work-orders/)
- [Asset history, import, field validation and cost dimensions](https://servicechannel.com/products/assets/)
- [Location and requester mobile experience](https://servicechannel.com/products/servicechannel-mobile/)
- [Provider integrations](https://servicechannel.com/tools/integrate-your-systems-with-servicechannel/)
- [Webhook events](https://developer.servicechannel.com/guides/wh/about-webhooks/)
- [Provider response, SLA and status guidance](https://servicechannel.com/services-providers/trade-partner-guide/)
- [Proposal and RFP lifecycle](https://developer.servicechannel.com/guides/proposals/about-proposals-and-RFPs/)
- [One-click work-order links from email](https://servicechannel.com/learning-channel/just-released-new-features/)

#### Decision for Clark's

Adopt the owner-side canonical work order, exception management, fallback assignment, distinct financial states and cost drill-through. Do not copy the full provider scoring burden, workforce administration, marketplace or parts/time requirements. A provider must be able to participate without adopting a new daily operating system.

### Fexa

Fexa's strongest pattern is configurable workflow and channel-flexible provider exchange.

#### What it does

- Centralizes intake, triage, dispatch, communication, visits, proposals and invoices.
- Assigns by trade, priority and location, with alternate-provider and SLA behavior.
- Supports internal teams and service providers on the same work-order lifecycle.
- Uses configurable workflows and custom fields rather than a fixed universal process.
- Supports geofenced/IVR check-in/out, completion evidence and customer verification.
- Routes proposal and invoice approvals using configurable conditions.
- Connects vendor rate/compliance/NTE rules to invoice validation.
- Lets vendors work through a Fexa login or integrate through the provider API.
- Sends email/text notifications and collects responses and attachments.
- Provides 360 reporting across locations, work orders, providers, invoices and assets.

#### Relevant evidence

- [Work-order lifecycle and internal/external support](https://fexa.io/work-order-management/)
- [Rules, alternate assignments, SLA alerts and approval automation](https://fexa.io/automation-workflow-optimization/)
- [Provider channels and directly recorded performance](https://fexa.io/integrated-vendor-operations/)
- [Provider API objects and synchronization](https://fexa.io/cmms-api-providers/)
- [Open provider relationships and check-in options](https://fexa.io/provider-management/)
- [Smart email/text communications](https://fexa.io/fexa-cmms/)
- [Location, asset, work-order and invoice analytics](https://fexa.io/data-analytics/)
- [Retail implementation example](https://fexa.io/customer-stories/tecovas-case-study/)
- [Multi-brand standardization example](https://fexa.io/customer-stories/med-tail-retailer/)

#### Decision for Clark's

Treat SLA, priority, NTE, approval authority, escalation, provider coverage, landlord/warranty responsibility and notifications as organization-owned configuration. Use one domain command set behind web, email, portal and API adapters. Avoid a generic no-code workflow builder in v1; expose the few policies the pilot actually needs.

### Corrigo

Corrigo provides strong examples of explicit states, hierarchical configuration and provider-system integration.

#### What it does

- Uses Work Zones and Portfolios to group locations and inherit or override business hours, SLA and assignment rules.
- Requires provider integrations to support work-order receipt and accept/reject.
- Allows providers to continue in their existing CMMS through CorrigoPro Direct.
- Models requested, submitted, approved and rejected quote states; approved quotes update NTE.
- Models invoice draft, submitted, disputed, authorized, pending verification and paid states.
- Distinguishes reactive requests from PM/routine work.
- Provides operational dashboards with links to work-order detail by property, region, specialty and assignee.

#### Relevant evidence

- [CorrigoPro integration scope](https://developer.corrigopro.com/docs/scope-your-integration)
- [API versus portal/mobile usage scenarios](https://developer.corrigopro.com/docs/usage-scenarios)
- [Quote and NTE states](https://developer.corrigopro.com/docs/submitting-a-quote)
- [Invoice verification, dispute and authorization](https://developer.corrigopro.com/docs/retrieving-invoices)
- [Work Zone SLA and routing configuration](https://securecontent.corrigo.com/docs/HelpCE918/html/14d5d7cd-f175-78cd-5375-ccca12d1b3ab.htm)
- [Operational reporting and detail drill-down](https://www.jllt.com/blog/business-intelligence-for-work-order-management/)
- [Jack in the Box/Qdoba facilities example](https://www.jllt.com/customer-story/jack-in-the-box-saves-millions-with-service-call-avoidance-warranty-tracking/)

#### Decision for Clark's

Use named state transitions and append-only events, not a freely editable status field. Support inheritance from organization policy with store-level overrides only where necessary. Keep the hierarchy understandable: optional brand/region grouping does not own the store or its history.

### FMX

FMX is the useful simplicity benchmark for smaller organizations and internal/external collaboration.

#### What it does

- Organizes organization → building → resource/location → equipment.
- Creates the building first, then adds service locations and equipment.
- Requires building and exact location on a maintenance request while equipment is optional.
- Allows assignment during creation or later from a manager queue.
- Supports approval rules at organization, request-type and building levels.
- Imports buildings, locations, users, equipment and PM through guided templates.
- Exposes filters for overdue, pending assignment, pending approval, pending resolution and pending finalization.
- Supports outside vendor users and documents email-based submission without login.
- Reports cost by building, request type, equipment type and equipment tag.

#### Relevant evidence

- [Guided implementation and imports](https://help.gofmx.com/hc/en-us/articles/204688159-How-is-FMX-implemented-for-new-customers)
- [Adding resources and service locations](https://help.gofmx.com/hc/en-us/articles/203368129-Adding-Resources-Locations)
- [Maintenance request with optional equipment](https://help.gofmx.com/hc/en-us/articles/204100375-Creating-a-Maintenance-Request)
- [Assignment after creation](https://help.gofmx.com/hc/en-us/articles/203386369-Assigning-Maintenance-Requests)
- [Layered approval policy](https://help.gofmx.com/hc/en-us/articles/203710519-Set-Up-a-Maintenance-Technology-or-Custom-Work-Request-Approval-Process)
- [Manager grid and exception filters](https://help.gofmx.com/hc/en-us/articles/207487356-How-to-filter-your-calendar-grid-view)
- [External vendors and email-without-login example](https://www.gofmx.com/resources/case-studies/rocketship-education/)
- [Equipment cost reporting](https://www.gofmx.com/features/equipment-maintenance-summary-report/)

#### Decision for Clark's

Make the single-store experience a simplified presentation of the same domain model. Store creation should launch a commissioning checklist rather than force the user into unrelated setup screens. Equipment completeness must not block useful request and work-order control.

### Ecotrak

Ecotrak is the most directly relevant convenience-store comparison.

#### What it does

- Targets convenience, fuel retail, restaurant, grocery and car-wash equipment.
- Connects work orders, assets, PM, vendors, proposals, invoices and reporting.
- Positions intake as a sub-minute store workflow.
- Supports internal maintenance teams and external service providers in one environment.
- Offers an entry tier for small operators and larger tiers on the same platform model.
- Uses asset-level repair history and spend for repair-versus-replace review.
- Documents a 75+ location convenience operator rollout involving store visits, service-issue modeling, provider onboarding and GL collaboration.

#### Relevant evidence

- [Convenience-store facilities product](https://www.ecotrak.com/industry/convenience)
- [Platform modules](https://www.ecotrak.com/product/ecotrak-platform)
- [Work-order intake and asset history](https://www.ecotrak.com/feature/work-order-management)
- [Small and multi-location packaging](https://www.ecotrak.com/pricing)
- [Holiday Oil 75+ store implementation](https://www.ecotrak.com/case-studies/holiday-oil-powers-their-convenience-stores-with-ecotrak)
- [Internal/external fulfillment at roughly 50 locations](https://www.ecotrak.com/case-studies/case-study/l5-capital-manages-more-work-orders)
- [Internal/external work-order API representation](https://api-docs.ecotrak.com/)

#### Decision for Clark's

Borrow convenience-retail terminology, asset context and one-product packaging. Do not adopt mandatory asset-first intake. Clark's receives value at store or category level and shows asset-classification coverage until deeper records are known.

### MaintainX, Limble and Fiix

These products reinforce hierarchy and progressive setup choices.

- MaintainX documents location-specific templates and work that may receive an asset later. [Locations](https://help.getmaintainx.com/about-locations), [sub-work orders](https://help.getmaintainx.com/create-and-manage-sub-work-orders)
- Limble distinguishes access-governing locations from equipment-parent relationships and provides a no-asset option in its default work-order flow. [Locations versus parent assets](https://help.limblecmms.com/en/articles/8828169-locations-vs-parent-assets), [default work-order template](https://help.limblecmms.com/en/articles/3231863-default-work-order-template)
- Fiix describes a physical hierarchy of sites/facilities/equipment/child equipment and recommends deciding the site model during setup. [Asset hierarchy](https://helpdesk.fiixsoftware.com/hc/en-us/articles/211193203-About-the-asset-hierarchy), [basic setup](https://helpdesk.fiixsoftware.com/hc/en-us/articles/360044584571-Basic-setup-Overview)

#### Decision for Clark's

Keep organizational scope, physical hierarchy and financial coding separate. Provide reusable commissioning blueprints, but never create placeholder assets to satisfy a template or foreign key.

## 4. Decision synthesis for the clean rebuild

### Decision 1: Clark's owns the canonical maintenance record

Provider FSM products may own technician dispatch and labor administration. Clark's owns its work-order number, store issue, classification history, responsible assignment, visit evidence, unresolved follow-up, proposal/approval, invoice allocation and audit history.

This prevents the owner record from becoming a shallow mirror of whichever vendor happens to serve a store.

### Decision 2: A vendor portal is optional

Vendors may respond through:

- one-click email action
- purpose-bound deep link
- optional portal
- API/webhook integration
- a phone response recorded by a manager

Technicians use the store/accepted-work QR flow and do not need accounts. Every channel produces the same assignment and audit events. Structured decisions use explicit actions; email reply text may add notes or files but does not silently infer status.

### Decision 3: Internal and external fulfillment have equal owner visibility

Both modes use the same work-order lifecycle, next-action control, SLA clock, evidence, follow-up, cost and reporting contracts. They receive audience-specific interfaces. Internal teams need usable queues, due-date schedules, checklists, labor-cost and material-use records; those features stop short of route optimization, employee rostering, payroll and inventory accounting.

### Decision 4: Classification is progressive

A store is sufficient to create a work order. Category, system, asset and component are optional. Later classification is auditable and validates physical belonging. Analytics show coverage and an unclassified bucket instead of inventing placeholder equipment.

### Decision 5: Physical and accounting hierarchies are separate

Physical drill path:

`store → area → system → asset → component`

Financial dimensions:

`financial cost center → GL → budget → fiscal period`

Explicit allocations connect them. A cost center is not used as an equipment parent.

### Decision 6: Taxonomy has stable concepts and local language

Organization-owned canonical keys support cross-store comparison. Labels and aliases let an operator use its preferred terminology, store nicknames or imported codes without splitting analytics. Activated taxonomy remains tenant-scoped; only non-operational templates are shared.

### Decision 7: The primary owner surface is a management control center

The default experience combines maintenance financial position, store/category reporting and internal/provider accountability, then prioritizes:

- intake needing review
- assignments awaiting response
- missed service targets
- clarification
- proposal/approval work
- unresolved follow-up
- verification
- invoice/allocation exceptions

Reporting and accounting are first-class manager workflows built from execution records. Every number opens a filtered list and every row shows accountable party, next action, due time and escalation.

### Decision 8: Search is an operating tool

Managers must be able to find a store by code, name or address; a work order by number; equipment by tag, serial or alias; and money by proposal/invoice number. Search is organization-scoped, server-filtered and paginated.

### Decision 9: Store creation begins commissioning

The smooth flow is:

1. Core store identity
2. Contacts, hours, access and escalation
3. Optional areas and systems
4. Known assets/components
5. Internal/provider coverage
6. SLA, NTE and approval policy
7. Applicable PM
8. Readiness review

The store may accept reports before asset commissioning is complete. Readiness exposes gaps; it does not create fake data.

### Decision 10: Reporting is reversible

The canonical cost drill is:

`organization → store → category → system → asset → component → work orders → invoice allocations`

Each view shows selected financial stage, record count, period, cohort and classification coverage. Quoted, approved, committed, invoiced, credited and paid amounts remain separate.

### Decision 11: One product serves one and 65 stores

Organization, store, work-order and policy records are the same. Single-store UI hides region and comparison controls and defaults store scope. A regional operator gains optional brand/region groupings, server-side filters, bulk import and standardized blueprints. No separate schema or product fork is needed.

### Decision 12: The platform is all-trades; the pilot goes deepest in HVAC/R

The active product supports any maintenance trade through governed taxonomy and local labels. The demo proves landscaping, snow, janitorial, pest, signage, waste, plumbing, electrical, fuel, building, life safety and foodservice while concentrating the richest systems, equipment, components, PM and failure histories in HVAC and refrigeration. The maintenance accounting suite includes budgets, proposals, approvals, POs, invoices, credits, accruals, allocations, payment status and GL/export. Exclusions are POS and retail inventory, inventory valuation, vendor marketplace administration, payroll, tax, banking/payment execution, accounts receivable, general-ledger replacement, predictive maintenance, continuous tracking and route optimization.

## 5. Differentiation

Clark's is not differentiated by possessing work orders, assets or dashboards; every serious competitor has them. The defendable combination is:

1. **Owner-side record permanence** even when vendors use other systems.
2. **Progressive equipment intelligence** without blocking work or faking asset precision.
3. **Low-friction provider accountability** without mandatory portal adoption.
4. **Automatic unresolved-work control** after an incomplete visit.
5. **Canonical analytics with local operator language.**
6. **Two-axis cost traceability** through both physical equipment and maintenance accounting.
7. **One-store simplicity and 65-store control from one model.**

### Positioning statement

> Clark's Facilities is the owner-side maintenance control plane for multi-location and independent convenience retailers. It makes every issue permanent, every unresolved job accountable and every maintenance dollar traceable—from company totals to the asset or component when known—without forcing service vendors to abandon the tools they already use.

## 6. 65-store rollout implications

Official implementation guidance across Fexa, FMX, Corrigo, ServiceChannel and Ecotrak consistently emphasizes clean location data, workflow decisions, provider onboarding, role-specific training and phased adoption.

Recommended rollout:

1. Configure the organization taxonomy, priority/SLA matrix, NTE/approval policy and provider coverage.
2. Import all 65 core stores and validate exact identifiers, addresses, contacts and financial references.
3. Launch a small representative wave covering different volumes, geography and vendor arrangements.
4. Stabilize request → work order → response → visit → follow-up → verification before broad expansion.
5. Activate all maintenance categories, then add reliable HVAC/R equipment depth without delaying store- or category-level work control.
6. Expand in waves with a defined hypercare queue and role-specific training.
7. Measure adoption from source records: triage time, response time, overdue unresolved work, proposal turnaround, invoice exceptions and classification coverage.

The pilot should never seed or display a summary that cannot be reproduced from its supporting operational records.

## 7. Risks and responses

| Risk | Product response |
|---|---|
| Competitive feature overlap | Compete on workflow fit, adoption and record integrity, not checklist novelty |
| Low vendor burden reduces detail | Preserve documents, store verification, internal follow-up and optional API enrichment |
| Progressive classification leaves ambiguity | Show coverage and unclassified buckets next to asset analytics |
| Email/deep links weaken identity assurance | Purpose-bound expiring tokens, actor/channel audit and step-up confirmation for money |
| Geolocation is imperfect | Store accuracy/distance/result and show verified or exception state; never claim continuous proof |
| Financial stages can be double-counted | Separate stage measures and explicit append-only allocations/ledger entries |
| Regional UI overwhelms one-store owners | Hide optional hierarchy and portfolio comparison without changing the data model |
| Demo data looks unrealistically complete | Seed incomplete classification and exception cases; calculate all totals from records |
| Configuration becomes enterprise software | Expose a governed policy set, not an unlimited workflow-builder surface in v1 |

## 8. Official source index

All sources were accessed August 5, 2026.

### ServiceChannel

- [Platform overview](https://servicechannel.com/platform/)
- [Work orders](https://servicechannel.com/products/work-orders/)
- [Assets](https://servicechannel.com/products/assets/)
- [Mobile](https://servicechannel.com/products/servicechannel-mobile/)
- [Provider integration](https://servicechannel.com/tools/integrate-your-systems-with-servicechannel/)
- [Developer guides](https://developer.servicechannel.com/guides/)

### Fexa

- [CMMS overview](https://fexa.io/fexa-cmms/)
- [Work orders](https://fexa.io/work-order-management/)
- [Provider management](https://fexa.io/provider-management/)
- [Provider API](https://fexa.io/cmms-api-providers/)
- [Data and analytics](https://fexa.io/data-analytics/)
- [Facility software buyer's guide](https://fexa.io/guide/facility-maintenance-software-buyer-guide/)

### Corrigo/JLL Technologies

- [CorrigoPro Direct introduction](https://developer.corrigopro.com/docs/intro)
- [Integration scope](https://developer.corrigopro.com/docs/scope-your-integration)
- [Usage scenarios](https://developer.corrigopro.com/docs/usage-scenarios)
- [Quote submission](https://developer.corrigopro.com/docs/submitting-a-quote)
- [Invoices](https://developer.corrigopro.com/docs/retrieving-invoices)

### FMX

- [Maintenance management](https://www.gofmx.com/maintenance-management-software/)
- [Work Manager](https://www.gofmx.com/work-manager/)
- [Implementation](https://help.gofmx.com/hc/en-us/articles/204688159-How-is-FMX-implemented-for-new-customers)
- [Maintenance request creation](https://help.gofmx.com/hc/en-us/articles/204100375-Creating-a-Maintenance-Request)
- [User and scope permissions](https://help.gofmx.com/hc/en-us/articles/203406679-How-to-Customize-User-Access-on-your-FMX-site)

### Ecotrak

- [Platform](https://www.ecotrak.com/product/ecotrak-platform)
- [Convenience stores](https://www.ecotrak.com/industry/convenience)
- [Work orders](https://www.ecotrak.com/feature/work-order-management)
- [Pricing and product tiers](https://www.ecotrak.com/pricing)
- [Holiday Oil case study](https://www.ecotrak.com/case-studies/holiday-oil-powers-their-convenience-stores-with-ecotrak)

### Additional CMMS hierarchy sources

- MaintainX: [locations](https://help.getmaintainx.com/about-locations), [work orders](https://help.getmaintainx.com/about-work-orders)
- Limble: [work requests](https://help.limblecmms.com/en/articles/2982723-work-requests-overview), [locations versus parent assets](https://help.limblecmms.com/en/articles/8828169-locations-vs-parent-assets)
- Fiix: [asset hierarchy](https://helpdesk.fiixsoftware.com/hc/en-us/articles/211193203-About-the-asset-hierarchy), [basic setup](https://helpdesk.fiixsoftware.com/hc/en-us/articles/360044584571-Basic-setup-Overview)
