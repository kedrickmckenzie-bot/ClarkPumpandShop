# TraceOps Convenience Suite: Competitive Research and Product Decisions

**Research date:** August 15, 2026
**Market:** multi-site facilities management, CMMS, field service, vendor accountability, and convenience retail operations
**Decision scope:** the clean-slate TraceOps Convenience Suite product and experience

## Executive conclusion

The market does not need another generic work-order tracker. Industrial CMMS products optimize technicians and assets. Enterprise facilities platforms coordinate locations, vendors, proposals, spend, and capital planning. Contractor field-service systems optimize dispatch, selling, labor, and invoicing for the service company. Convenience-retail systems own POS, fuel, inventory, and back-office accounting.

TraceOps belongs between those categories:

> An operator-owned facilities control system that connects every store issue, service authorization, vendor interaction, observed visit, outcome, cost, equipment history, and management decision in one auditable service story.

The product must combine:

- ServiceChannel's provider accountability and exact-record drill-through.
- Corrigo's provider, asset, and operational intelligence.
- Fexa's flexible multi-provider workflow.
- Ecotrak's multi-unit simplicity and equipment orientation.
- OpenWrench and MaintainX's low-friction external participation.
- ServiceTitan's separation of parent work, appointment, and participant state.
- TraceOps' own c-store taxonomy, visit evidence, progressive setup, transparent lifecycle review, and value ledger.

The defining product principle is:

> **One service story, one accountable next action, many optional depths.**

## Research method and evidence limits

The review used current official product pages, help centers, public workflow guides, pricing pages, release notes, product screenshots, and customer stories. Public product screenshots were inspected for navigation, screen hierarchy, filters, record anatomy, mobile behavior, and density.

Customer savings and performance figures are vendor-reported evidence. They prove that buyers value the outcome, not that TraceOps can promise the same result. Product roadmap statements are not treated as current capability. Competitor comparison pages are treated as sales material, not neutral fact.

## Market structure

| Category | Representative products | What they optimize | Commercial model | TraceOps decision |
|---|---|---|---|---|
| Multi-site facilities management | ServiceChannel, Corrigo, Fexa, Ecotrak, OpenWrench, FMX | locations, external providers, work, proposals, spend, PM, assets | custom or per location | Primary comparison set |
| Industrial CMMS | MaintainX, Limble, UpKeep, Fiix | internal technicians, procedures, assets, parts, PM | per user/technician | Borrow mobile and asset patterns; avoid industrial breadth |
| Contractor field service | ServiceTitan, FieldEdge, ServiceTrade | dispatch, routes, pricebook, selling, labor, invoices, payments | per technician/suite | Integrate with vendor systems; do not recreate them |
| C-store fuel/compliance | Titan Cloud, Vixxo | fuel assets, compliance, managed maintenance, vendor networks | enterprise quote | Closest vertical threat and strategic integration benchmark |
| C-store back office | PDI, Petrosoft | POS, pricebook, inventory, fuel, accounting, daily operations | enterprise quote | Integration boundary, not product scope |
| Frontline communications | Zipline, WorkJam | messages, tasks, scheduling, training | enterprise quote | Do not dilute TraceOps into a general task platform |

Industrial CMMS pricing is usually per user: MaintainX publishes $20 and $65 annual-billing tiers, UpKeep starts at $24, and Fiix publishes $45 and $75 tiers. Multi-site facilities platforms are generally custom-priced, and ServiceChannel explicitly prices per location. TraceOps should price around managed locations and operator value, with unlimited store requesters and no vendor seat charge. Per-vendor or per-technician fees would suppress the occasional participation the product requires.

## Closest enterprise competitors

### ServiceChannel

Official sources: [platform](https://servicechannel.com/platform/), [work orders](https://servicechannel.com/products/work-orders/), [assets](https://servicechannel.com/products/assets/), [Contractor Scorecard](https://servicechannel.com/products/contractor-scorecard/), [mobile](https://servicechannel.com/products/servicechannel-mobile/), [RaceTrac case](https://servicechannel.com/case-studies/racetrac/), [2026 release](https://servicechannel.com/blog/summer-2026-product-release/).

What it does well:

- Connects work orders, planned maintenance, providers, proposals, invoices, assets, analytics, and capital planning.
- Supports location staff, corporate teams, internal technicians, and external providers.
- Allows direct issue reporting without complete asset data.
- Routes work through warranty, landlord, approval, provider, or self-help rules.
- Supports multiple arrival channels, including provider app, IVR, badge, and geofenced check-in.
- Shares provider performance measures across customer and provider.

Screen anatomy observed:

- Provider scorecards use a wide filter strip for provider, trade, priority, geography, location, brand, period, and benchmark cohort.
- Tabs separate network summary, repair trends, maintenance trends, and benchmarking.
- KPI screens place a large measure and definition next to a time-series chart.
- Benchmark screens show the customer's value beside quartile distributions.
- Location/mobile views surface saved work filters, upcoming provider visits, current work, and asset context.
- Work records combine notes, provider activity, visits, parts, time, proposals, invoices, and assets.

Keep:

- Shared provider accountability with exact record drill-through.
- Saved role-specific filters and location dashboards.
- Warranty context before dispatch.
- Multiple check-in channels.
- Per-location commercial framing.

Adapt:

- Use the customer's approved vendors rather than making a marketplace central.
- Present location and time as evidence, never certified labor or automatic invoice proof.
- Make accountless browser links capable enough that a vendor app remains optional.

Avoid:

- Provider-network complexity and fees.
- Dense enterprise terminology on ordinary manager screens.
- Opaque grades without numerator, denominator, period, cohort, and source records.

Relevant vendor-reported evidence: RaceTrac describes reducing unresolved daily tickets needing manual intervention from roughly 300 to 150 after centralizing its store maintenance workflow. This is buyer-value evidence, not a guaranteed TraceOps outcome.

### Corrigo

Official sources: [product](https://www.jll.com/en-us/products/corrigo), [business intelligence](https://www.jll.com/en-us/guides/corrigo-business-intelligence-facilities-management), [create work order](https://help.corrigo.com/Content/Work_Orders/create_wo.htm), [assign work](https://help.corrigo.com/Content/Work_Orders/assign_wo.htm), [complete work](https://help.corrigo.com/Content/Work_Orders/complete_wo.htm), [invoice authorization](https://help.corrigo.com/Content/Vendor_Management/authorize_vendor_invoice_payment.htm).

What it does well:

- Rich approval, NTE, cost, vendor, and invoice governance.
- Separates provider, asset, and operational intelligence.
- Uses repair history, useful life, book value, age, and replacement cost for asset analysis.
- Uses equipment-specific troubleshooting and call avoidance.
- Supports internal and external delivery on one portfolio.

Screen anatomy observed:

- Work creation is a large, sectioned form covering customer/location, asset/task, assignment, priority, specialty, access, dates, warranty, NTE, and PO data.
- Provider assignment uses a search dialog and an explicit “Assign and Send” action.
- Completion captures disposition, completion codes, notes, labor, materials, miscellaneous cost, and warranty.
- Provider Insights shows first-time fix, on-time arrival, labor rates, cost, and bottom performers.
- Asset Insights shows asset count, replacement count/cost, missing PM, missing data, and breakdown charts.
- Operational Insights shows work volume, cost, score, cycle time, and invoice turnaround.

Keep:

- Distinct analytical lenses for providers, assets, and operations.
- Equipment-aware call avoidance.
- Explicit cost categories and reconciliation.
- Dynamic cost-control guidance.

Adapt:

- Put advanced cost controls behind progressive disclosure.
- Translate the underlying states into one plain next action.
- Make every recommendation transparent and reviewable.

Avoid:

- One giant work-order form.
- Popup-heavy assignment.
- Editable time records presented as verified arrival.
- AP vocabulary in the main facilities workflow.

### Fexa

Official sources: [platform](https://fexa.io/), [pricing](https://fexa.io/pricing/), [orchestration model](https://fexa.io/blog/fexa-facilities-orchestration-platform/), [executive dashboard](https://fexa.io/blog/fexalytics-executive-dashboard-overview/), [create work order guide](https://info.fexa.io/hubfs/FEXA%20-%20Creating%20a%20Work%20Order.pdf?hsLang=en), [visit guide](https://info.fexa.io/hubfs/FEXA-%20Visit%20Process%20and%20ETA.pdf?hsLang=en), [asset tracking guide](https://info.fexa.io/hubfs/Vendor%20User%20Guide%20Asset%20Tracking%20-%20FEXA%20UPDATED.pdf?hsLang=en).

What it does well:

- Flexible multi-provider and multi-trade assignments.
- Duplicate warnings, alternate routing, NTE, proposals, visits, invoices, PM, assets, and rule automation.
- One analytics layer across work, spend, assets, providers, and teams.
- Vendor-guided HVAC/R asset enrichment.
- Explicit call-avoidance workflows.

Screen anatomy observed:

- A floating create button begins work; store, trade, and problem are the essential fields.
- The work-order grid is the primary queue.
- Work detail shows location, priority, assignee, dates, scope, and assignment requirements.
- Service assignments show provider, NTE, response deadline, arrival deadline, and completion expectations.
- Visits are nested under assignments, making the data model clear but the user-visible status chain harder to decode.
- Fexalytics combines spend, average invoice, NTE variance, aging, proposals, missed deadlines, call avoidance, and provider trends.

Keep:

- Flexible workflow and multiple-provider support.
- Duplicate warnings and call-avoidance tracking.
- One analytics layer.
- Vendor-assisted asset enrichment.

Adapt:

- Keep work, assignment, bid, visit, and cost states separate in data while showing one current action.
- Store asset type separately from the practical location/name.
- Allow vendor enrichment without blocking service.

Avoid:

- Requiring users to interpret chained visit, assignment, and workflow statuses.
- Rigid asset naming conventions.
- Infinite customer fields in ordinary workflows.
- Application tabs for every open record.

### Ecotrak

Official sources: [platform](https://www.ecotrak.com/product/ecotrak-platform), [work orders](https://www.ecotrak.com/feature/work-order-management), [assets](https://www.ecotrak.com/feature/asset-management), [pricing](https://www.ecotrak.com/pricing), [convenience retail](https://www.ecotrak.com/industry/convenience), [2026 roadmap](https://www.ecotrak.com/resources/blog/q2-2026-ecotrak-roadmap-product-enhancements-and-what-s-next), [API](https://api-docs.ecotrak.com/), [L5 Capital case](https://www.ecotrak.com/case-studies/case-study/l5-capital-manages-more-work-orders).

What it does well:

- Fast issue intake and prebuilt asset/dropdown choices.
- Strong multi-unit restaurant and c-store language.
- Work, assets, proposals, RFPs, PM, warranty, providers, and reports.
- Role-based dashboards and monthly work calendars.
- Human verification after OCR.
- Sensor events that can enter the facilities workflow.

Screen anatomy evidenced publicly:

- Module-oriented navigation with work, assets, proposals, RFPs, PM, providers, invoices, and reports.
- Role dashboards support widget tables, KPI trackers, notes, and links.
- Dispatch views filter by ETA, emergency, organizational scope, and assignment.
- Asset records show warranty, make/model/serial, repair history, maintenance history, and total spend.
- Location PM and work calendar views support operational planning.

Keep:

- Fast operator intake.
- C-store equipment language.
- Role-based dashboards.
- Verify-before-save automation.
- Sensor-to-work pathway.

Adapt:

- Asset and category classification must be deferrable.
- AI should suggest and explain, not decide.
- Component hierarchy should come from optional templates.

Avoid:

- Requiring an asset to create work.
- Presenting roadmap features as finished.
- Opaque predictive downtime or replacement claims.

### OpenWrench

Official sources: [platform](https://www.useopenwrench.com/), [supplier workflow](https://www.useopenwrench.com/supplier), [request service](https://www.useopenwrench.com/fm-university/how-to-request-service), [onboarding](https://www.useopenwrench.com/fm-university/buyer-onboarding-guide), [supplier quick start](https://www.useopenwrench.com/sm-university/supplier-quick-start-guide).

What it does well:

- Plain, multi-location service workflow.
- Free vendor participation and no requirement that technicians use the mobile app.
- Accept, schedule, start, finish, and bill stages.
- Optional asset onboarding; its own guide calls assets a potential phase-two goal.
- General/location/asset work, PM, proposals, invoices, messaging, and inspections.
- One-click technician check-in is a stated product pattern.

Screen anatomy observed in official images:

- A left icon rail and work-order screen with a stage ribbon: Requested, Open, In Progress, On Hold, Completed, Cancelled.
- Search and segmented filters for fresh/stale and planned/reactive.
- Work rows show problem, location, state, urgency/SLA, trade, vendor, WO number, and timing.
- Work detail separates Overview, Chat, Quotes, and Invoices.
- Chat is visually prominent and supports photos.
- Inspection screens pair a checklist with mobile answer choices and photo evidence.

Keep:

- Optional asset onboarding.
- Vendor-free participation.
- Plain accept/schedule/start/finish model.
- Communication tied to the service record.

Adapt:

- Make accountless service authorization, proposal, visit, and outcome flows first-class.
- Retain one customer work-order number as the billing reference.
- Replace its visually small, low-contrast screen treatment with readable enterprise UI.

Avoid:

- Depending on every vendor to create an account.
- Combining invoice submission with the core operational definition of success.

### Titan Cloud

Official sources: [maintenance](https://www.titancloud.com/solutions/maintenance/), [retail](https://www.titancloud.com/industries/retail), [2026 maintenance sheet](https://www.titancloud.com/wp-content/uploads/2026/02/Product_Sheet_Titan_Maintenance_2026.pdf), [Jacksons case](https://www.titancloud.com/wp-content/uploads/2025/11/Titan-Cloud_Jacksons_casestudy.pdf).

Titan Cloud is the closest c-store-specific strategic competitor. It connects fuel and store assets, vendors, technicians, work orders, PM, compliance, warranty, budgets, mobile work, inspections, and analytics. Its advantage is direct fuel-system and compliance depth, including tank gauges, dispensers, alarms, testing, and regulatory data.

Keep:

- Fuel, non-fuel, and EV assets in one location model.
- Warranty and component context.
- Site, region, vendor, asset, and category reporting.
- Future sensor/alarm pathway.

Adapt:

- TraceOps should be easier for regional operators that do not need an energy-asset optimization suite.
- Fuel/compliance integrations should remain a future adapter, not inflate V0.
- Vendor accountability should work for landscaping and plumbing as naturally as refrigeration and dispensers.

Avoid:

- Competing immediately in ATG, wetstock, environmental compliance, or fuel inventory.
- Assuming continuous equipment telemetry exists.

### Vixxo

Official sources: [company](https://www.vixxo.com/), [facilities services](https://www.vixxo.com/facility-management/facility-management-services), [2026 platform analysis](https://www.vixxo.com/facilities-management-news/the-ai-powered-fm-platform-beyond-dashboards-and-reports), [cost-control analysis](https://www.vixxo.com/facilities-management-news/why-technology-alone-is-not-reducing-total-facilities-spend).

Vixxo is primarily a managed facilities outcome competitor. It combines a service platform, provider network, invoice auditing, asset analysis, and program management. Its strongest lesson is that visibility without operating intervention does not change cost.

Keep:

- Focus on time to arrive, time to complete, first observed resolution, PM completion, average work cost, SLA exceptions, and quote cycle time.
- Turn every insight into a queue, owner, action, and tracked outcome.

Avoid:

- Claiming the software alone changes vendor behavior.
- Copying managed-service promises that TraceOps is not staffed to deliver.

## CMMS and field-service references

### MaintainX

Sources: [pricing](https://www.getmaintainx.com/pricing), [work requests](https://help.getmaintainx.com/create-a-work-request?platform=mobile), [mobile](https://help.getmaintainx.com/getting-started-new-users/mobile-app-overview), [external work](https://help.getmaintainx.com/external-work-orders), [request portals](https://help.getmaintainx.com/set-up-a-request-portal), [vendor management](https://www.getmaintainx.com/use-cases/vendor-management), [media kit](https://www.getmaintainx.com/media-kit).

Observed product screens are clean, readable, and split-pane. Work lists remain on the left while the selected record appears on the right. Mobile and desktop share recognizable hierarchy. Work detail uses four prominent state actions—Open, On Hold, In Progress, Done—followed by assignment, description, and procedure. Asset detail uses Details and Work Orders, with subassets directly visible. Reporting uses a stable top tab row, filter chips, large measures, and simple charts.

Keep minimal requests, QR prefill, split-pane efficiency, accountless external links, comments/files, and internal final review. Avoid industrial downtime measures, mandatory procedures, parts, and purchasing breadth.

### Limble

Sources: [pricing](https://limble.com/pricing), [request portal](https://help.limblecmms.com/en/articles/6801095-how-to-set-up-a-work-request-portal), [mobile](https://help.limblecmms.com/en/articles/11698403-using-the-new-limble-mobile-app), [task completion](https://help.limblecmms.com/en/articles/3497506-how-to-complete-a-task), [vendor sharing](https://help.limblecmms.com/en/articles/3610812-how-to-share-a-task-with-a-vendor), [location verification](https://help.limblecmms.com/en/articles/6372045-verify-location), [dashboards](https://help.limblecmms.com/en/articles/6825268-how-to-set-up-custom-dashboards).

Keep the mobile Details / Instructions / Comments pattern, prominent QR action, Resume Later / Finish vendor workflow, and chart-to-record drill-through. Adapt location verification into explicit point-in-time visit evidence. Avoid a rigid 10-meter pass/fail rule or making an instruction checklist the entire service lifecycle.

### UpKeep and Fiix

Sources: [UpKeep pricing](https://upkeep.com/pricing/), [UpKeep portal](https://help.onupkeep.com/en/articles/12158452-configure-the-new-upkeep-request-portal), [UpKeep work record](https://help.onupkeep.com/en/articles/15545270-how-to-view-and-process-work-orders-on-web-new), [Fiix pricing](https://fiixsoftware.com/cmms/pricing/), [Fiix portal](https://helpdesk.fiixsoftware.com/hc/en-us/articles/360038455092-Enable-the-work-request-portal), [Fiix create work](https://helpdesk.fiixsoftware.com/hc/en-us/articles/9352747946516-Create-a-new-work-order-v6).

Keep UpKeep's quick-panel versus full-record pattern and Fiix's explicit “I can't find the asset.” Avoid UpKeep's background GPS model, excessive work-record tabs, and either product's parts/PO depth. Historical records must preserve the name/classification at the time of service rather than silently changing when an asset is renamed.

### FMX

Sources: [pricing](https://www.gofmx.com/pricing/quote/), [maintenance request](https://help.gofmx.com/hc/en-us/articles/204100375-Creating-a-Maintenance-Request), [mobile work list](https://help.gofmx.com/hc/en-us/articles/34089695304845-Getting-Started-with-the-Mobile-App-FMX-Work-List), [vendor guide](https://help.gofmx.com/hc/en-us/articles/207459253-FMX-Technician-and-Vendor-Work-Request-Guide), [dashboard](https://help.gofmx.com/hc/en-us/articles/208485536-Dashboard-Basics).

Keep mobile Recent / Nearby / Overdue / On Hold shortcuts and the separation of resolved from finalized. Avoid requiring vendor accounts, tenant-hostname login, and unrelated reservation/purchasing breadth.

### ServiceTitan, FieldEdge, and ServiceTrade

Sources: [ServiceTitan status model](https://help.servicetitan.com/v1/docs/statuses-and-actions-on-jobs-and-appointments), [dispatch](https://help.servicetitan.com/docs/use-the-new-daily-and-weekly-dispatch-board), [mobile actions](https://help.servicetitan.com/docs/explore-job-details-and-actions-in-fma), [ServiceTrade mobile](https://servicetrade.com/products/servicetrade-platform/features/mobile-app/), [ServiceTrade Service Link](https://servicetrade.com/products/servicetrade-platform/features/service-link/), [FieldEdge platform](https://fieldedge.com/field-service-software/).

These products prove that job, appointment/visit, technician, proposal, and invoice state must be distinct. TraceOps should map to these vendor-owned records, not replace their dispatch boards, routes, pricebooks, technician payroll, inventory, quoting, sales, or payment systems.

Keep ServiceTitan's visible next field action and state separation, ServiceTrade's customer-readable after-service report, and FieldEdge's clear en-route state. Avoid real-time tracking, vendor sales tools, and per-technician adoption requirements.

## C-store operating context

Official sources: [NACS equipment downtime](https://www.convenience.org/stay-current/news/2024/july/9/2-the-impact-of-equipment-downtime_operations), [NACS 2025 State of the Industry presentation](https://www.convenience.org/events/SOI/Presentations/Financial-and-Operational-Lessons_SOI2025.pdf), [PDI Enterprise](https://pditechnologies.com/increase-productivity/erp-back-office/enterprise-retail-software/), [Petrosoft reports](https://help.petrosoftinc.com/Content/Reports/b_reports.htm), [Zipline](https://getzipline.com/platform/), [WorkJam retail task management](https://www.workjam.com/library/retail_task_management_the_next_generation/).

The NACS 2025 State of the Industry material reports average 2024 repairs and maintenance of $5,719 per store per month. A $150 monthly TraceOps price is therefore about 2.62% of that benchmark. That does not prove a sale; it defines the required value threshold. TraceOps must help the customer control or explain more than 2.62% of maintenance spend and administrative effort without inventing savings.

The product must reflect:

- 24/7 operations and limited store labor.
- Revenue, food-safety, fuel, customer-experience, and comfort consequences.
- Thirty or more maintainable assets in many stores.
- Internal, external, and blended service models.
- Different store formats, foodservice programs, dispenser counts, car washes, and regional weather.
- Equipment failures described by symptoms, not diagnoses.
- Back-office, POS, pricebook, inventory, and fuel accounting already owned by other systems.

## Screen-pattern synthesis

### Patterns that create enterprise value

- A persistent scope and period context.
- One queue showing what needs action now.
- Clear accountable party, next action, due time, and escalation.
- Split-pane lists for high-frequency triage; full pages for consequential decisions.
- Fixed work-record header with customer WO number, store, state sentence, owner, and due time.
- Chronological immutable activity.
- Exact-record drill-through from every KPI, chart segment, exception, and outlier.
- Saved role-specific views.
- Mobile screens with one prominent next action.
- Human confirmation after OCR, AI, benchmark, or match suggestions.
- Optional depth for assets, PM, cost, invoice, and portal adoption.

### Patterns that make platforms feel generic or burdensome

- A large menu of disconnected modules.
- Dashboard cards with no action or source records.
- One giant work-order form.
- Tiny typography and excessive table density.
- A single overloaded status.
- Mandatory asset, component, vendor, or cost center before intake.
- App/account requirements for occasional vendors.
- Opaque vendor grades, asset health scores, savings, or replacement directives.
- Treating geofence or time onsite as proof of invoiced labor.
- Making invoice entry a prerequisite for operational or lifecycle insight.

## Decisive Keep / Adapt / Avoid matrix

| Area | Keep | Adapt for TraceOps | Avoid |
|---|---|---|---|
| Platform spine | One record across service, visits, cost, asset, provider | One visible service thread linked to the immutable request and canonical WO | Separate mini-apps that force reconstruction |
| Intake | Plain-language, QR-aware fast reporting | Store and problem only; classify later | Required asset, component, vendor, or cost center |
| Routing | Direct internal/outside assignment and rules | Internal maintenance, Outside vendor, Choose later | Becoming a vendor dispatch replacement |
| Bids | Multi-provider proposals | Bid request is distinct; selecting one creates one service assignment | Sending several active service authorizations |
| Vendor access | Secure links, mobile web, optional portals | Accept, decline, date, question, visit, outcome, files | Mandatory accounts/apps or vendor fees |
| Accountability | Shared metrics and source rows | Show denominator, period, cohort, and coverage | Opaque grades and accusations |
| Visit evidence | Channel-independent check-in/out | Point-in-time location, source, accuracy, distance, consent, result | Background tracking and backdated verified time |
| Status | Separate work, assignment, visit, outcome, cost states | Derive one plain next-action sentence | One overloaded status or chained UI jargon |
| Spend | NTE, proposals, warranty, duplicate and repeat flags | Money requiring review plus human outcome | Fake savings, automatic denial, full AP |
| Equipment | Asset history, warranty, PM, costs | Template + quantity + quick name/location + vendor enrichment | Giant forms and rigid naming |
| Lifecycle | Age, expected life, repair history, replacement cost | Transparent review packet and capital forecast | Percent-spent rule, downtime inference, opaque score |
| PM | Occurrences create canonical WOs | Show numerator, denominator, window, and exact occurrences | Unsupported compliance percentages |
| Reporting | Interactive dashboards and exports | Dashboards act; reports are immutable handoff records | Dead charts and unversioned exports |
| Setup | Templates, imports, defaults, rules | C-store blueprints with progressive configuration | Infinite settings exposed to daily users |

## TraceOps product decisions

### 1. The operator work order is the service spine

The original request remains immutable. The operator WO is the canonical service authorization and billing reference. Vendor tickets, vendor invoices, and optional accounting PO references remain separate. Every assignment, issuance, visit, outcome, follow-up, cost, invoice link, asset link, and audit event attaches to this service thread.

### 2. Simple UI requires richer state, not less state

TraceOps stores separate request, work, assignment, visit, outcome, follow-up, cost, and invoice states. It derives one user-facing sentence such as:

> Waiting on Summit Refrigeration to propose a service date · due today at 4:00 PM.

Every unresolved work order has an accountable party, next required action, due timestamp, and escalation destination.

### 3. Vendor adoption is optional

Email/SMS secure links, QR/mobile web, trusted store device, manual phone/email updates, future app, and optional vendor portal invoke the same domain commands. A technician may check in and out through different channels. No-WO service creates an unmatched visit for review rather than blocking work.

### 4. Dashboards are action surfaces

Every metric must answer:

- What is the exact scope, period, cost basis, taxonomy path, and cohort?
- Which source records produced it?
- What decision or action follows?
- Who owns that action and when is it due?

### 5. TraceOps tracks value without manufacturing ROI

The product uses a value ledger with review states:

- Identified.
- Under review.
- Confirmed.
- Realized.
- Rejected.

Eligible events include warranty-covered cost, duplicate dispatch avoided, invoice overage corrected, selected proposal difference with scope caveat, callback charge prevented, and customer-confirmed administrative avoidance. PM completion is not automatically monetized. The customer must confirm any dollar outcome.

### 6. Equipment setup is template-first and progressive

Organization templates define c-store equipment types and optional default components. Store onboarding uses quantity selectors, then a quick naming/location step. Serial, model, install date, warranty, and component details are additive. Vendors may enrich equipment data during service.

### 7. Lifecycle is a decision packet, not a verdict

At work authorization—not invoice review—the platform may flag capital review using:

- Current repair/proposal amount.
- Current installed replacement benchmark.
- Asset age and expected-life range.
- Remaining expected life.
- Warranty.
- Related repair count and cost.
- Same-component repeats.
- Visit outcomes and unresolved follow-up.
- PM history.
- Replacement lead time and customer criticality when known.

The review shows repair-now cash, replace-now cash, capital pulled forward, expected replacement window, evidence, and uncertainty. It never says “replace because lifetime repairs reached X% of replacement.” A configurable review threshold may decline as remaining expected life declines, but a dollar floor prevents a small repair near end of life from triggering a pointless capital review.

### 8. Replacement estimates are versioned references

Assets reference an equipment replacement profile; they do not each store a copied estimate that must be manually updated. An approved replacement quote can propose a new effective-dated benchmark for the matching template/cohort. A human reviews affected assets, source quote, date, scope, and any size class before publishing. One quote is allowed and described plainly as “based on one recent approved quote”; multiple comparable quotes may produce a median/range. An outlier never silently updates the fleet.

### 9. C-store specialization is the wedge

The initial program templates are Refrigeration, HVAC, Forecourt, Foodservice, Electrical/Lighting, Plumbing, Exterior/Site, Security/IT, and Car Wash where applicable. Intake uses symptom language such as beer cave warm, pump unavailable, ice machine not producing, canopy lights out, or restroom leak. The underlying platform remains modular enough for future suites, but the user interface does not expose hypothetical industrial complexity.

## What makes $150 per store per month credible

A generic work-order tracker does not justify the price. A portfolio facilities control system can if it consistently exposes and helps resolve:

- Above-authorization work.
- Duplicate and repeat service.
- Warranty opportunities.
- Proposal variance.
- Rate and cost outliers.
- Multiple-visit work.
- Missing or unmatched visit evidence.
- Aging approvals and vendor responses.
- PM exceptions with denominator.
- Store, equipment, and vendor cohorts driving cost.
- Upcoming capital needs.
- Administrative intervention and confirmed value outcomes.

The CEO-level answer to “What did the platform do?” should be a drillable record of work controlled, visits observed, exceptions resolved, and value confirmed—not a marketing score.

## Final decision

Do not copy one competitor. Do not reskin the current generic platform. Retain the durable domain and persistence work that already supports the service record, then replace the operator experience and presenter architecture around:

> **One service story. One accountable next action. Every source record underneath it.**
