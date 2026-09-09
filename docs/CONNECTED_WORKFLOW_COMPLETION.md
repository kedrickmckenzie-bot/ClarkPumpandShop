# Connected workflow completion pass

This pass connects existing operator screens and preserves the domain workflow. It does not change service authorization, vendor dispatch, acknowledgment obligations, or accounting behavior.

## Navigation behavior

- A six-screen navigation trail appears throughout the operator shell. It records the actual visited path, filters, pagination, selected record, and query-selected tab. Selecting a previous stop restores that URL. Revisiting a record through a new link keeps the immediately preceding source available.
- The trail survives form submissions and reloads in the same browser tab through session storage. Changing user, tenant, role, store/region scope, effective capabilities, or demo edition clears the old path. Destination reads still enforce server permissions. Navigation history never authorizes access or associates records.
- Streamed routes wait for the loaded page heading before naming a stop. Transient mutation messages are omitted. No cross-device history or browser-history access is introduced. Hash-only scroll positions and unsaved form input are not restored.
- Contextual creation carries the current store from store pages or scoped queues. Work creation also retains supported equipment/vendor parameters from the queue. Store choices display readable names; IDs remain submitted values. Request defaults are restricted to authorized stores.
- Submitting a report opens its newly created record directly. Quick acknowledgment still needs no note or link, and does not create service work.

## Connected records

- Queue cells can carry independent destinations and suppress links to routes unavailable to the current role (including the finance role’s visits-queue restriction). Stores and vendors open their own records, recorded amounts open the work-order cost tab, and store/vendor activity counts open scoped queues.
- Vendor visit work references open work orders rather than reopening the visit. Store names, unresolved-item work references, return-visit counts, and recorded cost have corresponding destinations. Unmatched visits keep their review path without inventing work links.
- Work-order fulfillment and origin facts expose their actual vendor/report/PM/visit links. Acknowledged reports can open equipment belonging to their explicitly linked work; this is labeled linked-work equipment, not original report evidence.
- Invoice allocation lines replace raw visit/work identifiers with readable links to each exact visit, work order, and store, including every allocation on a split line. Vendor names open the vendor. Invoice reference source rows also link to their store, cost tab, and visit tab. A supplied operator reference opens a unique visible matching work order for inspection, without implying a confirmed allocation. Visit counts include the existing cross-work visit relationships.
- Trend source store names open store records while their original evidence record links and cohort filters remain intact in the source view and return trail.
- PM enrollment store/equipment names open those records independently of plan editing. Equipment PM work numbers and occurrence visit evidence are linked. Equipment PM links select the rendered tab instead of pointing at a hidden anchor.
- Store service-area open-work and 12-month cost cells open matching source work with the relevant store/category/period filters.

## Validation

Regression coverage exercises separate cell destinations, scoped count drill-through, source cohort preservation, prefilled creation permissions, unmatched versus linked vendor visits, navigation revisits/bounds, and direct post-submission routing. Browser validation uses the local fictional fixture, including desktop and 390 x 844 mobile.

Browser journeys exercised:

- Desktop: scoped Store 104 work queue → vendor → exact queue return → prefilled work form; queue cost amount → work-order Costs → invoice → exact visit checkout evidence; manager search → source work order.
- Mobile (390 x 844): readable prefilled work form and navigation trail; contextual create menu → report form with Store 104 selected → submit → new report → quick acknowledgment without note/link → store → PM enrollment → equipment PM tab → linked work reference.
- Refreshed pages and normal form submissions retained the per-tab path. An initial live-development worker connection interruption recovered on reload. The observed page flows loaded correctly afterward.

Validation results:

- `npm run db:seed`: passed; deterministic 15-store, five-vendor fixture and separate 65-store fixture.
- `npm run typecheck`: passed.
- `npm test -- --maxWorkers=1 --no-file-parallelism`: 116 files and 784 tests passed. Earlier parallel runs encountered timing-guard failures/timeouts; no thresholds or assertions were relaxed. A trends-only retry also passed before the complete serial run.
- `npm run build`: passed, with the existing emitted CSS filename conflict for `ops.D8IpgYP_.css` and plugin-timing notices.
- `npm run lint`: passed.
- `npm run test:e2e -- --maxWorkers=1 --no-file-parallelism`: 4 files and 44 tests passed.
- `git diff --check`: passed. The local browser exercise created one routine test report and acknowledged it; it is labeled as a local workflow check and is not merged or deleted. The untracked dev4.log is preserved. No external delivery, push, or deployment is part of this pass.

## Limits

The navigation trail supports the last six screens in the current tab, not an unlimited or cross-device workspace. Existing workflow state determines next actions; this pass adds contextual navigation rather than learned predictions. It does not assert that every specialized setup screen or every inline source fact has a dedicated detail page. Future screens should use independent record destinations rather than making every cell reopen the same parent record.
