# Contract and Warranty Model

**Status:** target model; operational contracts and repair-level warranty are not implemented

Contracts and warranties are versioned routing, authorization, billing, and accountability inputs. This product is not a legal drafting/redlining/e-signature system.

## Operational contracts

A `VendorContract` identifies the organization/provider relationship. Immutable/effective-dated `ContractVersion` records preserve the terms that governed historical work, including:

- source agreement reference, owner, status, effective/renewal/notice dates, Stores/regions, and scope;
- trade, work/service and Asset scope; included/excluded and emergency/PM work;
- preferred/exclusive provider rules and subcontractor policy;
- labor/rate card, trip/diagnostic/PM pricing, material markup, discounts, NTE, and change-order rules;
- scheduling authority, reserved capacity, access and evidence requirements;
- response/arrival/completion SLAs and calendars;
- qualification, insurance/license/certification, and compliance requirements;
- labor/parts/travel/diagnostic warranty terms and routing.

Vendor Assignment, Service Run, Quote, Authorization, Site Visit, Repair Item, Applied Warranty, and Invoice evidence retain the governing Contract Version or an explicit approved no-contract exception. Editing current terms never changes historical obligations.

## Qualification and compliance

Qualifications are structured by trade/work/service, Asset/Component type, PM/emergency/warranty work, manufacturer authorization, geography, after-hours status, job-size limit, and required credential. Company-level qualification is the initial standard; never imply technician-level qualification without technician data.

Blocking compliance documents have type, issuer/reference, effective/expiry dates, review state, file, and policy consequence. Expiry prevents new commitment unless an authorized, visible, expiring override is recorded on the Vendor, Work Order/Assignment, Service Run, and audit.

## Repair Item

Warranty attaches to a structured `RepairItem`, not merely to a Work Order or Asset expiration date. A Repair Item links Work Order, Site Visit, Vendor, Asset/Component, failure code, repair action/severity, removed and installed Component, part manufacturer/model/serial, supplied-by status, completion/verification time, labor/part cost, and root cause. One Work Order may produce several Repair Items with different coverage.

## Warranty records

- `WarrantyPolicy`: effective provider/contract policy container.
- `WarrantyRule`: controlled scope by Contract, trade, service/work, Asset/Component type, manufacturer/model, part source, geography, and effective dates.
- `WarrantyCoverageLine`: independent labor, parts, travel, diagnostic, consumable, equipment, or other terms, including duration/start event, provider, required routing, deductible/maximum, conditions, and exclusions.
- `AppliedWarranty`: immutable coverage snapshot created for completed Repair Item work.
- `WarrantyAmendment`: attributed correction/one-time override; never overwrites original coverage.
- `WarrantyCase`: governed investigation/routing/coverage decision for a related failure.

Manufacturer coverage is evaluated and stored separately from provider workmanship/parts coverage.

## Rule precedence

Resolve each coverage category independently:

1. Specific Warranty Amendment.
2. Quote/Authorization-specific term.
3. Contract Component rule.
4. Contract Asset/service rule.
5. Contract trade rule.
6. Vendor Component rule.
7. Vendor Asset/service rule.
8. Vendor trade rule.
9. Vendor base warranty.
10. No known coverage.

Manufacturer coverage is a separate parallel evaluation. Equal-priority overlaps cannot activate silently. A preview tool must show selected inputs, winning rule, overridden broader rules, coverage by category, provider/routing, dates, and plain-language explanation.

## Detection, routing, and billing safeguards

New issues search active Applied Warranties using exact Asset/Component/serial matches first, then related Component type/failure/time and intervening-repair evidence. Label matches high, medium, or low confidence and state “potential coverage—diagnosis required”; never assign liability before diagnosis.

Warranty-mandated routing takes precedence over provider preference and scheduler optimization. A safety/product-loss emergency, provider decline/SLA failure, inactive/noncompliant provider, manufacturer direction, dispute, or management exception may override only through an authorized, reasoned Audit Event.

Potential warranty defaults customer-charge responsibility to undetermined and places related invoice evidence on hold pending diagnosis. Final lines separate provider-covered labor/part, manufacturer-covered part, customer-responsible labor/part, travel, diagnostic, unrelated repair, and excluded work. A zero-dollar callback still counts in failure, callback, Asset lifecycle, and provider-performance evidence.

## Current implementation boundary

Current assets/components have optional warranty end dates and vendor profiles have specialty/coverage. Those fields do not supply Contract Versions, Repair Items, scoped rules, immutable Applied Warranties, precedence, routing, cases, or invoice holds. No operational contract or repair-level warranty loop is complete.
