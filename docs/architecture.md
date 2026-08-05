# Clark's Operations Architecture

**Decision date:** August 5, 2026  
**Architecture:** Production-shaped full-stack web monolith with deterministic demo adapters

## Decision summary

The repository uses a multi-tenant TypeScript application deployed as one monolith rather than microservices. React renders responsive executive, manager, vendor and technician experiences; framework route handlers expose mutations and integration boundaries; framework-independent domain services compute metrics and enforce workflow invariants; SQLite-compatible relational storage holds operational records; object storage holds files. The first pilot target is approximately 65 stores, while the same tenant model must remain comfortable for one-store and other regional operators.

The application is optimized for a deterministic owner demonstration but keeps external effects—database, files, email, tokens and geolocation—behind explicit adapters. Native applications can later call the same HTTP/domain layer.

## Technology stack

- **Language:** TypeScript 5.9 in strict mode.
- **UI:** React 19.2, Next App Router-compatible routing and server rendering.
- **Runtime/build:** vinext 1.0 beta, Vite 8 and a Cloudflare Worker-compatible ESM output.
- **Styling:** Tailwind CSS 4 plus a small product-specific CSS token layer; accessible native controls and Lucide icons.
- **Validation:** Zod at request and form boundaries.
- **Relational data:** Cloudflare D1/SQLite with Drizzle ORM and committed SQL migrations.
- **Blob data:** Cloudflare R2 behind a `FileStore` interface.
- **Testing:** Vitest for pure domain/integration/render checks plus an end-to-end domain journey; browser-driven QA for principal pages and responsive states.
- **Deployment:** Sites/Cloudflare with logical D1 and R2 bindings declared in `.openai/hosting.json`.

### Why this stack

- One deployable unit is appropriate for a small product team and avoids distributed transactions across a tightly connected work-order graph.
- TypeScript supports shared domain and validation contracts across UI, routes and future native/API clients.
- A relational database is the correct source of truth for hierarchies, many-to-many links, financial allocation reconciliation and audit history.
- SQLite/D1 gives a simple demonstration path while preserving standard SQL and Drizzle migrations for a later PostgreSQL move.
- R2 separates file bytes from transactional metadata and has an S3-like object-storage migration path.
- Server rendering provides fast, linkable owner drill-downs while client islands handle filters, role switching, uploads and geolocation.

## Repository structure

```text
app/                         Route pages, layouts and HTTP handlers
  api/                       Vendor, visit, upload and demo mutation endpoints
  assets/[assetId]/          Asset detail
  components/[componentId]/  Component detail
  email-outbox/              Development email preview
  pm/                        PM dashboard
  reports/new/               Frontline intake
  stores/[storeId]/          Store and store-system drill-down
  systems/[categoryId]/      Company category explorer
  technician/[token]/        Store QR flow
  vendor/accept/[token]/     Secure vendor response
  work-orders/[workOrderId]/ Internal work-order detail
components/                  Shells and reusable product UI
db/                          Drizzle schema, migration helpers and adapters
drizzle/                     Generated SQL migrations
lib/domain/                  Pure rules, calculations and workflow services
lib/demo/                    Deterministic fixture generator and scenario IDs
lib/server/                  Repositories, permissions, email, files and tokens
public/demo-files/           Fictional seeded document previews
scripts/                     Seed/verification utilities
tests/                       Unit, integration, rendered and end-to-end tests
docs/                        Research and product/architecture decisions
```

## Execution and data modes

### Deterministic demo mode

The fixture generator uses a fixed seed and clock to produce all organizations, locations, systems, assets, work orders, visits, PM occurrences, financial records and audit events. The same generated records feed pages and calculation services; dashboard summaries are never separate constants.

The demo can be reset to that fixture. Browser-only presentation mutations may be held in the demo session to keep scripted flows repeatable. The UI labels all simulated location/email states as Demo Mode.

### Persistent mode

D1 is the operational source of truth. The seed command writes the deterministic fixture through repository adapters using stable IDs and is idempotent. Route handlers validate and authorize mutations, append audit events and then return updated projections. R2 stores upload bytes; D1 stores object keys and metadata. Every repository method requires an organization context; there is no unscoped default query.

The production path must not depend on the fixture repository. During demo development a fixture projection may be used as a fallback if the local D1 binding is absent; that fallback is visible in environment documentation and is a deferred production limitation, not silently treated as durable data.

## Database model

All tenant-owned tables include `organization_id`. IDs are stable text ULIDs/UUIDs in the demo; timestamps are ISO-8601 UTC text. Money is integer cents. Coordinates are decimal degrees; distances and accuracy are integer meters.

### Identity and organization

- `organizations(work_order_prefix, time_zone, review_policy, settings_json)`
- `memberships(organization_id, person_id, status)`
- `regions(organization_id)`
- `stores(organization_id, region_id?, code, latitude, longitude, geofence_radius_m)`
- `store_areas(store_id)`
- `people(organization_id, kind)`
- `role_assignments(person_id, role, region_id?, store_id?, vendor_id?)`
- `vendors(organization_id)`
- `vendor_contacts(vendor_id)`

### Maintenance hierarchy and taxonomy

- `service_categories(organization_id)`
- `system_types(service_category_id)`
- `store_systems(store_id, service_category_id, system_type_id)`
- `asset_classes(service_category_id)`
- `assets(store_system_id, asset_class_id)`
- `component_types(service_category_id)`
- `components(asset_id, component_type_id)`

Physical foreign keys enforce belonging; taxonomy keys enable cross-store comparison.

`region_id` is nullable by design. Queries always begin with `organization_id`; they never infer tenant through a region. Vendor records are tenant-owned in v1 so pricing, evaluations and contracts cannot leak across customers, even when the same real-world vendor serves multiple operators. A future shared vendor directory would be a separate global identity joined through organization-private vendor relationships.

### Intake and work control

- `employee_reports(store_id, reporter_id, original_description, immutable fields...)`
- `report_reviews(report_id, reviewer_id, decision, context)`
- `work_orders(store_id, service_category_id, store_system_id?, asset_id?, component_id?, current control fields...)`
- `work_order_reports(work_order_id, report_id)`
- `work_order_classification_events(work_order_id, prior/new association fields, actor, reason)`
- `vendor_responses(work_order_id, vendor_id, response, identity, token_id)`
- `service_visits(work_order_id, vendor_id, technician_entered_name, session_hash, arrival/departure evidence, outcome)`
- `follow_ups(work_order_id, source_visit_id?, accountable kind/id, action, due_at, escalation, status)`
- `comments(work_order_id, visibility, author_id, body)`

The original employee-report columns are never updated after insert. Application authorization and database triggers protect them in production migrations. Classification changes occur through a domain service that updates the current projection and appends a classification/audit event together.

### PM

- `pm_plans(organization_id, scope/frequency/window/vendor/evidence fields)`
- `pm_plan_targets(pm_plan_id, target_type, target_id)`
- `pm_occurrences(pm_plan_id, due_at, window_start/end, status, work_order_id?, completed_at?, waiver fields?)`

Unique `(pm_plan_id, due_at, target_type, target_id)` prevents duplicate materialization.

### Finance and files

- `quotes(work_order_id, vendor_id, amount_cents, status)`
- `authorizations(work_order_id, quote_id?, type, amount_cents, status)`
- `invoices(work_order_id, vendor_id, number, total_cents, status)`
- `credits(invoice_id, amount_cents, status)`
- `cost_allocations(financial_type, financial_id, store/category/system/asset/component targets, amount_cents, work_class, cost_category)`
- `documents(organization_id, object_key, safe filename, mime, bytes, classification, uploader, visibility)`
- `document_links(document_id, entity_type, entity_id)`
- `communications(work_order_id, channel, direction, visibility, delivery_state)`
- `outbox_messages(organization_id, work_order_id?, recipient, subject, html/text, delivery_state)`

Application validation and a transaction/batch guard require invoice allocation totals to be between zero and the invoice total. Credits remain separate; reports subtract posted credit allocations.

### Security and audit

- `public_tokens(organization_id, purpose, token_hash, record_type/id, expires_at, used_at?, revoked_at?)`
- `audit_events(organization_id, entity_type/id, event_type, actor_type/id, occurred_at, immutable JSON details)`

Indexes follow actual queues and drill-downs: open WOs by org/status/due, store/category/time, vendor/acceptance, open follow-ups/due, occurrence/status/due, allocation targets/posted date, visits/work order and audit entity/time. Migrations run `PRAGMA optimize` after index creation. List endpoints use cursor pagination and a stable secondary ID sort; company aggregates execute in SQL or bounded projection queries rather than shipping every record to the client.

### Pilot scale and customer-size adaptation

The initial capacity target is one 65-store organization with roughly 8,000–12,000 work orders, 5,000 PM occurrences and tens of thousands of audit/file metadata records per year. That volume is within the chosen monolith and D1 model when indexes, pagination and bounded aggregates are used. A synthetic 65-store scale fixture verifies assumptions during test runs.

Customer shape is configuration, not a separate product edition:

- Single-store organizations have no required region row; owners may hold several roles through assignments.
- Multi-store organizations can add regions later without changing store/work-order IDs or history.
- Navigation derives from enabled modules, store count and permissions; it does not hardcode Clark's regions or store codes.
- Work-order numbers are unique per organization using an organization prefix/sequence.
- Taxonomy defaults can be copied from platform templates, then governed per organization without sharing operational data.
- Cross-organization aggregation is prohibited in customer-facing services. Future benchmarking requires a separately reviewed anonymization/consent pipeline.

## Service and repository boundaries

Pure domain modules accept records and a supplied clock. They do not import React, D1, R2 or environment state.

- `work-order-service`: lifecycle transition guards, progressive classification and unresolved-work invariant.
- `follow-up-service`: outcome mapping, creation, completion and overdue logic.
- `pm-service`: occurrence generation, due-window classification and compliance.
- `finance-service`: allocation validation, spend classification and hierarchical rollups.
- `analytics-service`: periods, medians, percentiles, cohorts, outlier drivers and reconciliation.
- `replacement-service`: threshold reasons and recommendation narrative.
- `geofence-service`: Haversine distance and verification state.
- `permission-service`: role/scope/field-level projections including vendor history restrictions.

Server adapters implement `OperationsRepository`, `FileStore`, `EmailDelivery`, `TokenService` and `Clock`. This keeps route handlers thin and supports D1→PostgreSQL, R2→S3, and outbox→email-provider changes.

## Authentication and role-based access

### Demo

No production credentials are required. A visible role switcher selects one of seven fixed fictional personas. Server mutations also receive/derive a demo persona and run the same permission checks; the switcher is not represented as production security.

### Production path

- Company users authenticate through enterprise OIDC/SSO; stable external subject maps to `people` and assignments.
- A person may be a member of more than one customer organization, but every request selects one active membership and receives a tenant-scoped session context.
- Vendor office uses account authentication or short-lived, single-purpose emailed tokens for initial response.
- Technician QR flow uses a store-purpose token plus ephemeral, same-browser session identifier; it is not a general account.
- Server authorization first restricts `organization_id`, then role/scope, then record field projection.
- Denial occurs before existence-sensitive detail is returned to reduce cross-tenant enumeration.

## Audit-event strategy

Audit events are append-only facts, not a mutable activity note. Event types include report submitted/reviewed, WO created/issued/status changed/reclassified, email created/delivered/opened, vendor response, visit check-in/out, location exception, follow-up created/overdue/completed/rescheduled, document uploaded, quote/authorization/invoice/credit/allocation, verification, PM status and watchlist disposition.

Each event contains actor, timestamp, entity, visibility and structured before/after or source IDs. UI timelines merge domain events in timestamp order but permission-filter details.

## File-storage abstraction

`FileStore.put`, `get`, `delete` and `signedDownload` operate on opaque keys. Upload flow:

1. Validate authenticated scope, entity ownership, declared class, MIME, extension and maximum bytes.
2. Sanitize display filename; generate server-owned object key.
3. Stream bytes to R2 and record metadata/link in D1.
4. Append audit event.
5. Serve through an authorized route or short-lived signed link; never expose the bucket publicly.

Demo accepts common images, PDF, text/CSV and office formats up to 10 MB. Malware scanning, document OCR and production retention/legal-hold policies are deferred.

## Email abstraction

`EmailDelivery.send(message)` returns provider message ID and state. `OutboxEmailDelivery` writes previewable messages and is the default. A future adapter may call a transactional provider when `EMAIL_PROVIDER` and credentials are configured. Templates are versioned and render both text and HTML. Secrets live only in environment configuration.

## QR and public-token design

Store QR and vendor acceptance URLs use high-entropy opaque token material. D1 stores only a SHA-256 token hash plus purpose, record mapping, expiration and revocation/usage state. A token is useless for another purpose. Vendor response tokens expire and can be single-use; store QR tokens are long-lived, rotatable and reveal only the limited technician page after lookup.

The demonstration may use deterministic signed tokens generated from a local secret so QR links remain stable. Production secrets have no fallback, are rotated through environment management, and tokens carry version identifiers for migration.

## Geofence calculation and privacy

The server runs the Haversine formula over store and reported coordinates. Evidence classification order is:

1. No coordinates/error → denied or unavailable.
2. Reported accuracy above configured threshold → inaccurate.
3. Distance above store radius → outside geofence.
4. Otherwise → verified.

The default store radius is 200 m and default acceptable accuracy is 150 m, both configurable. Stored evidence is limited to the two submitted points, accuracy, derived distance, timestamp, token/session hashes and result. No background watcher, route or continuous location is collected. UI copy accurately explains that browser permission denial must be fixed in browser settings; rescanning cannot reset it.

## Demo-mode design

`VerificationProvider` has `BrowserGeolocationProvider` and `DemoGeolocationProvider`. Demo states produce typed readings that flow through the same geofence classifier where coordinates exist or the same exception mapping where they do not. The page and resulting timeline show an amber “Demo simulation” badge. Email delivery, vendor acceptance and reset use the same visible pattern.

## UI architecture and accessibility

- Desktop shell uses a compact left rail, global scope/date controls and clear breadcrumbs.
- First viewport leads with an exception brief and evidence-based next action, not generic welcome cards.
- Cards are links to filtered tables. Tables have semantic headers, visible focus, keyboard-accessible rows/links and responsive overflow.
- Mobile technician and employee flows use one-column steps, minimum 44 px targets and no executive chrome.
- Color supplements text labels/icons and meets accessible contrast. Motion is limited and respects reduced-motion preference.
- Definitions and active periods sit next to metrics; data-coverage badges prevent false precision.

## Testing approach

### Unit

- Work orders at store-only depth and later valid/invalid classification.
- Haversine and verification states.
- PM generation/window/compliance.
- Follow-up creation, overdue and closure guards.
- Allocation equality and hierarchical rollups.
- Period comparisons, median/percentile outliers and drivers.
- Replacement reasons and recommendation guard.
- Vendor field-level permission projections.

### Integration/end-to-end domain journey

A test executes report → review → WO → issue → vendor acceptance → check-in → unresolved checkout → follow-up → reclassification → return visit → store verification → invoice/allocation → close and asserts rollups/audit events.

### Rendering and browser QA

Server-render principal routes and assert product metadata, no starter artifacts, accessible landmarks and core scenario links. Use browser automation to inspect Command Center, Store 45, CU-1, `CWO-0245`, PM, vendor acceptance and mobile technician flows at desktop and mobile widths. Verify no dead controls in the principal narrative and correct overflow/focus states.

## Path from demo to production

1. Make D1 the only repository mode; add deployment-time migrations, backup/restore and environment isolation.
2. Add OIDC SSO, SCIM/role provisioning, vendor accounts and production session protection.
3. Add antivirus scanning, signed download expiry, retention, DLP and document OCR/classification review.
4. Add transactional email with webhook delivery/open/bounce events and token rotation.
5. Add background jobs for PM materialization, reminders, escalations and overdue snapshots.
6. Integrate store masters and financial references with PDI/Petrosoft/accounting; add ServiceTitan/ServiceChannel-style vendor exchange only where vendors support it.
7. Add rule governance, cohort configuration, accounting close/reconciliation and data-quality stewardship.
8. Load/performance, accessibility, security and disaster-recovery testing; production observability and support playbooks.
9. Move to PostgreSQL when concurrency, data volume, integration workloads or reporting justify it. Drizzle repository boundaries and standard relational keys minimize the change.

The 65-store pilot does not itself require microservices or PostgreSQL. Migration should be driven by measured write contention, reporting/query needs, multi-region requirements or customer count—not store count alone.

## Path to future native applications

Native apps should not share database access. They authenticate to versioned HTTP endpoints that expose the same validated commands and permission-filtered projections. The responsive PWA remains the first-class employee/vendor entry point. A native technician app becomes reasonable only if offline service, managed-device camera behavior, push notifications or richer evidence capture proves necessary.

## Known demonstration limitations

- The demo role switcher is not authentication.
- Location simulation is visibly synthetic; real browser geolocation depends on device/browser permissions and accurate configured store coordinates.
- Fixture documents are fictional; production malware scanning/OCR is not included.
- Email defaults to the local outbox.
- Accounting, POS, vendor FSM and SSO integrations are architectural seams only.
- Replacement and outlier thresholds are illustrative governance defaults, not validated Clark's capital policy.
