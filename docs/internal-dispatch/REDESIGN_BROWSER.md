# Dispatch redesign browser evidence

October 4, 2026. Local Vinext preview, fictional in-memory tenant, `codex/internal-dispatch-p1` based on `880c3d5`. Screenshots are local, ignored QA artifacts under `.codex-runtime/redesign-browser`; they are not hosted screenshots or production records.

## Required screens

Desktop captures use 1440 × 900. Phone captures use 390 × 844, with full-page capture for long records. The final six record/page pairs have a measured 28px page heading and no document overflow. The expanded phone menu also measures 390px document width.

| Screen | Desktop | Phone |
| --- | --- | --- |
| Week board | [Desktop](../../.codex-runtime/redesign-browser/board-desktop.jpg) | [Phone](../../.codex-runtime/redesign-browser/board-phone.jpg) |
| Same-page job sheet | [Desktop](../../.codex-runtime/redesign-browser/sheet-desktop.jpg) | [Phone](../../.codex-runtime/redesign-browser/sheet-phone.jpg) |
| Technician page | [Desktop](../../.codex-runtime/redesign-browser/technician-desktop.jpg) | [Phone](../../.codex-runtime/redesign-browser/technician-phone.jpg) |
| Technician My work | [Desktop](../../.codex-runtime/redesign-browser/my-work-desktop.jpg) | [Phone](../../.codex-runtime/redesign-browser/my-work-phone.jpg) |
| Technician job | [Desktop](../../.codex-runtime/redesign-browser/job-desktop.jpg) | [Phone](../../.codex-runtime/redesign-browser/job-phone.jpg) |
| Technician store | [Desktop](../../.codex-runtime/redesign-browser/store-desktop.jpg) | [Phone](../../.codex-runtime/redesign-browser/store-phone.jpg) |
| Shared navigation | [Desktop](../../.codex-runtime/redesign-browser/sidebar-desktop.jpg) | [Phone](../../.codex-runtime/redesign-browser/sidebar-phone.jpg) |

[Capture dimensions](../../.codex-runtime/redesign-browser/capture-dimensions.json) record the final six page pairs. Navigation was captured separately after the phone contrast correction.

## Full internal job loop

The implementing agent followed the visible controls as Jordan Lee and Maria Santos on desktop and phone, without a step-by-step script supplied to the product:

1. Open CPS-2026-0304 from Dispatch. Assign from Chris Delgado to Maria, with a reason.
2. Schedule Tuesday, October 6. The board moves to the saved week and shows Saved.
3. Open the job through Maria's phone My work. Flag that a cooler handle and screws are needed.
4. Return to the manager's phone Dispatch sheet. Mark ready after obtaining the parts.
5. Return to Maria's phone job. Record Fixed and the installed handle.
6. Open the manager's full work order. Confirm the current result with Yes, completed. The record shows Work verified complete.

The job retains its original October 7, 2 PM due date through the parts delay and readiness. [Confirmed result](../../.codex-runtime/redesign-browser/confirmed-desktop.jpg) is workflow evidence captured before the final heading-size adjustment. The final required screen pairs above show the final visual system.

Additional browser checks:

- Desktop pointer drag from the queue to Maria/Monday opens the date form with the technician/day prefilled; saving persists the date and displays Saved. [Drag form](../../.codex-runtime/redesign-browser/drag-schedule-desktop.jpg).
- Scheduling a second appointment over Maria's 10 AM job displays the overlap plainly. Pick another retains the form and focuses the date/time field; moving it to 11 AM saves. [Warning](../../.codex-runtime/redesign-browser/overlap-warning-desktop.jpg).
- A five-job cell shows three chips and +2 more; the day list retrieves the remaining scoped jobs. Escape closes the sheet and returns focus to its chip. Board filters and position remain in place.
- A manager edits Store 104 access notes; the technician store page shows the saved instructions and contacts without financial controls.
- A corrective repair linked to an inspection uses the ordinary technician job and now schedules successfully. The checklist itself remains protected and uses its inspection record.
- After all Maria's jobs were scheduled for later, Today initially showed an empty screen. The corrected default immediately shows Coming up and both future jobs, with filters below.

## Seven-role navigation and compatibility

The crawl covered every menu destination for Maintenance / facilities, Field manager, Regional manager, Owner / leadership, Store manager, Invoice reviewer and Technician, plus selected record/form drill-throughs. There are **108 distinct role/page pairs checked at both widths**, recorded in [final crawl results](../../.codex-runtime/redesign-browser/role-crawl-final.json). All final entries show no document overflow, page error or new console error. [Raw observations](../../.codex-runtime/redesign-browser/role-crawl.json) retain initial failures and rechecks; final results use the latest observation for the same role/path.

The crawl found and corrected unstable filter IDs causing Trends/Lifecycle hydration errors, a narrow-screen Savings table overflow, and poor contrast in the expanded phone menu. It checks menu destinations and representative details, not every possible source record, filter combination or permission grant.

Compatibility spotchecks include manager search for 104 and the exact Store 104 drill-through, the unsaved store creation form, optional classification and all three internal routing choices in new work, invoice/PM/lifecycle destinations, and the account-free Store 104 vendor visit. ColdLine sees its own eligible work; the no-work-order path requires a reason and reaches the arrival form. These checks create neither an extra presentation store nor an unmatched vendor visit.

## Limits

The preview is local, fictional and resets with its process. The owned QA process was restarted to validate the final global CSS; unrelated previews and retained PostgreSQL records were preserved. Domain/migration tests use native D1 and actual isolated PostgreSQL databases, while this redesign's browser run uses the fixture adapter. Cross-channel public visits, invoice safeguards and persistence have automated coverage; their complete transaction loops were not all repeated manually during this visual pass. No live email/SMS, physical maps-app launch, geolocation hardware, hosted reset or production deployment was tested. Independent acceptance and production-readiness gates remain open.
