# Owner and Operator UX Principles

**Status:** approved target principles; implementation is partial  
**Primary authority:** [CSTORE_PLATFORM_REBUILD_BLUEPRINT.md](CSTORE_PLATFORM_REBUILD_BLUEPRINT.md)

## Doctrine

> Simple by default. Complete on demand. Safe by policy. Explainable by evidence.

All roles use the same canonical records. Role-aware projections change emphasis, permitted scope, and available actions; they do not create separate products or duplicate facts.

## Information architecture

Use no more than six primary destinations:

1. Overview
2. Work
3. Stores
4. Equipment
5. Vendors
6. Spend & planning

Setup and administration are secondary. Avoid navigation organized around every database entity.

## Every consequential screen answers

1. What is happening?
2. Why is it in this state?
3. Who owns the next action?
4. When is that action due?
5. What is blocking progress?
6. What operating or financial exposure exists?
7. What evidence supports the record?
8. What can this user do next?

For open service work, present one plain sentence such as “Waiting on Summit Refrigeration to propose a date by 4:00 PM.” That sentence is a projection of lifecycle state, open Workflow Tasks, holds, and child records—not a free-form UI guess.

## Progressive disclosure

Present information in this order:

1. Conclusion or current condition.
2. Required decision or next action.
3. Plain-language explanation.
4. Financial and operating impact.
5. Supporting evidence.
6. Complete technical detail.

Do not remove professional depth to simplify the executive view. Put depth behind a split view, full record, tab, or source table.

## Role expectations

### Owner and executive

Lead with decisions, exposure, stalled work, PM exceptions, abnormal spend, vendor outliers, warranty opportunity, capital review, confirmed value, and what changed. Show recommendation, confidence, deadline, accountable owner, and one-click evidence. Avoid operational edit clutter unless the executive enters an explicit approval task.

### Facilities and operations

Favor dense, readable queues and tables with persistent filters, saved views, stable sorting/pagination, bulk actions, schedules, approvals, assignments, contracts, warranties, SLAs, and exception detail. A dashboard is an action surface, not a data museum.

### Store employee and manager

Issue intake asks for location, observed problem, operational/safety/customer impact, and optional evidence. It must not require a trade, failure code, component, or vendor. Store progress uses plain language. Store managers may verify outcomes only within scope and policy.

### Vendor dispatcher and technician

Participation is mobile-first and account-optional. Secure links must support accept, decline, date proposal, questions, check-in/out, evidence, and outcomes with minimal duplicate entry. Do not require a separate clock for every Work Order at one store.

### Finance

Show exact cost bases, invoice links, unmatched balances, authorization variance, and evidence. Do not imply payment execution or permit finance users to rewrite technical evidence.

## Interaction levels

- **Summary:** a small number of outcome and attention indicators.
- **Queue:** searchable, filterable, stably paginated source records.
- **Split view:** rapid triage without losing queue context.
- **Full record:** consequential decisions, complete timeline, financial and technical evidence.
- **Public/mobile task:** one prominent next action with minimal disclosed data.

Cards summarize. Exact records belong in tables, queues, timelines, split views, and full record pages. Every metric, chart segment, exception, and outlier must carry a drill-through that reproduces its scope, period, cost basis, taxonomy path, cohort, classification coverage, numerator, denominator, and exclusions.

## Visual and content system

- Neutral cool-gray canvas; white working surfaces; deep slate navigation and record headers.
- One restrained cobalt action/focus color; semantic status colors remain brand-independent.
- Readable 15–16 px body text, visible focus, sufficient contrast, and strong table hierarchy.
- Comfortable default density and an optional compact density for high-volume work.
- One primary action per context.
- No marketing gradients, glass effects, playful illustration, decorative charts, tiny labels, or excessive rounded-card grids in the operator application.
- Product label, logo, metadata, links, and brand colors come from central brand configuration. Routes, domain types, database names, event names, CSS names, and storage keys remain brand-neutral.

## Required states

Every important surface has designed loading, empty, partial/stale, error, and permission-denied states. Actions provide a stable success receipt or a recoverable error, preserve entered input when safe, and never leave the user guessing whether a consequential mutation committed.

Keyboard flow, labels, validation relationships, focus restoration, reduced motion, responsive layout, and non-chart alternatives are release requirements. Mobile store/vendor tasks must remain one-action clear.

## Current implementation boundary

The enterprise shell and several role-shaped views exist, but the operator path still loads a full tenant snapshot and uses a large generic presenter. The visible role picker is a fictional preview control, not authorization. Saved views, complete server pagination, production identity/scope, full state coverage, and consistent exact drill-through remain incomplete.
