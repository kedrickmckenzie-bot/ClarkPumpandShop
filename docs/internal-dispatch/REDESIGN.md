# Dispatch redesign

User-authorized October 4, 2026, from `880c3d5286875921a4c536ac7dcd312ac00f66f0` on `codex/internal-dispatch-p1`. This follows the owner's revised scope and order instead of starting the remaining phase prompts wholesale. Original IM/IDP acceptance IDs remain unchanged.

## Build order and acceptance

- [x] RD-01: Week board by technician/day, independent side queue, native scoped counts/filters/pagination, accessible live scheduling and same-page job sheet. Desktop dragging supplements Schedule → technician → day. Day and List views remain available. Week-only and Sunday work remain visible without inventing dates.
- [x] RD-02: Scoped technician page with contact, week, open/waiting/recent work and covered stores; no rankings, timesheets or live tracking.
- [x] RD-03: Everyday wording, conditional friendly timezone labels, explicit conflict recovery with Keep this date / Pick another, and DST occurrence choices. Preserve original deadlines, independent follow-ups, grants, command version checks, idempotency, audit and outbox.
- [x] RD-04: Technician store contacts, directions and manager-editable optional access notes; scoped notes/photos history without costs; five recent jobs on the focused job screen. Hide financial routes and record tabs at the server boundary as well as in navigation.
- [x] RD-05: Expandable sidebar tree shared with the phone menu; active section stays open; remove the top section bar; maximum six manager primary destinations, with Compliance nested under Work. Technician destinations: My work, Stores, Equipment, Work history, Search.
- [x] RD-06: Meaningful tests for each area; seed, typecheck, lint, full tests, workflow tests, Sites and Render builds. Desktop 1440px / phone 390px screenshots for board, sheet, technician page, My work, job, technician store and navigation; all-seven-role link/overflow/error checks; browser assign → schedule → blocker → ready → fixed → confirm without instructions.

## Visual and interaction contract

Cool-gray canvas, white surfaces, dark slate navigation, cobalt `#2457d6` for the main action and links. Body 15–16px, labels at least 13px, headings 19–28px; 4–6px corners, 8px spacing scale, visible keyboard focus. Status words accompany semantic colors. One filled primary per job/panel/form. Phone actions and inputs are at least 44px with 8–12px gaps. Reassign/give back/remove date open a short form before confirming. Empty fields stay hidden; no raw zones, internal state words or IDs in product copy.

The week board uses Monday–Saturday columns and technician plus Not assigned rows. At most three chips per cell; more opens the day's list. Today is highlighted, past days dimmed. Phone uses a day picker and collapsible technician sections. Sheets close with Close/Esc and retain board position and filters. Loading, empty, permission, error and partial-result states are explicit. Owners/read-only roles receive view actions only.

Existing domain commands remain the only assignment, schedule and readiness mutations. No provider provisioning, paid maps, automatic route ordering, shift rosters, hosted reset, live delivery, merge or deployment is included. The owner separately authorized committing and pushing this validated redesign on October 4, 2026. Local previews use fictional records; the presentation stays at 15 stores, five vendors and two technicians.

## Evidence

### Implemented behavior

- Dispatch is now an explicit operational week board rather than the generic list presenter. Native queries filter, count, order and paginate by tenant and current store scope before returning small pages. Board/day counts, the urgency-first side queue, overflow day lists, recent activity and store/equipment search totals work in the fixture and SQL adapters.
- The same-page sheet reads a fresh, operational-only DTO. Owners/read-only users get view controls. Saves call existing assignment, schedule and readiness commands with the same work/assignment/schedule versions, retry receipts, current grants, audit and targeted outbox behavior. Stale saves show recovery; date warnings require an explicit Keep this date or Pick another action. Significant changes require a short reason. Dragging opens the same form as keyboard/phone Schedule.
- Technician profiles and tools use bounded scoped reads and contain contacts, stores, job notes/photos and internal/vendor work history. Financial providers, prices and admin controls are excluded from technician record/search paths. Optional store access notes have their own version fence, idempotent receipt and atomic audit. D1 migration 0071 and PostgreSQL migration 0072 upgrade populated data without inventing contact information or schedules.
- The shared sidebar tree preserves role/edition visibility and current-section highlighting; the redundant global top section bar is removed. The phone menu uses the same tree. Page titles use the menu's plain labels.
- Browser-discovered corrections protect checklist work while allowing its separate corrective repair to schedule, keep future-only technician work visible on Today, stabilize filter IDs to avoid hydration errors, and remove narrow-screen Savings overflow. Final phone job actions use a full-width primary with secondary actions below.

### Final local validation

All required checks pass on the final implementation:

| Check | Result | Local log |
| --- | --- | --- |
| `npm run db:seed` | Deterministic fixture: 15 stores, five vendors, two technicians; separate 65-store fixture | `.codex-runtime/redesign-seed-release.log` |
| `npm run typecheck` | Passed | `.codex-runtime/redesign-typecheck-release.log` |
| `npm run lint` | Passed | `.codex-runtime/redesign-lint-release.log` |
| `npm test -- --maxWorkers=1` | 208 files; 1,476 passed; 15 intentional adapter-specific skips; 786.16 seconds | `.codex-runtime/redesign-tests-release.log` |
| `npm run test:e2e -- --maxWorkers=1` | Four files; all 68 passed; 113.79 seconds | `.codex-runtime/redesign-e2e-release.log` |
| `npm run build` | Vinext/Cloudflare build passed | `.codex-runtime/redesign-build-release.log` |
| `npm run build:render` | Next/Render build passed | `.codex-runtime/redesign-build-render-release.log` |

The full test run enables actual isolated PostgreSQL dispatch tests with `OPS_DISPATCH_TEST_DATABASE_URL`, alongside native Miniflare D1 and fixture tests. The 15 skips are adapter-inapplicable cases, not an unavailable PostgreSQL run. Retained PostgreSQL records are preserved.

Reproduction-first logs for the inspection scheduling restriction and future-only empty screen are retained under `.codex-runtime/redesign-corrective-before.log` and `.codex-runtime/redesign-upcoming-before.log`; their targeted after runs and final full suite pass. The adapter regression also checks that the original inspection remains protected and unchanged. The final phone-only width adjustment was verified with measured 44px/full-width primary actions and captured again; final typecheck/lint/workflow/build checks follow it.

An earlier full run during concurrent browser work had one 15-second public-workflow timeout and stale label assertions. The assertions were updated for the requested titles/words; the quiet final full/workflow runs pass without increasing timeouts. Browser activity was idle during these final test runs.

[Browser evidence and all fourteen required screenshots](REDESIGN_BROWSER.md) record the manager/technician loop, drag, overflow day list, keyboard sheet recovery, conflict recovery, contact notes, seven-role menu crawl and compatibility spotchecks. Automated domain checks use fixture/native D1/actual PostgreSQL; the browser preview uses the local fictional fixture. No live delivery, physical maps/geolocation proof or hosted production certification is claimed. Original P1–P3 independent acceptance and production gates remain separate and unchanged.

RD-01–RD-06 describe the implemented redesign and its local validation. They do not close the earlier independent acceptance gates or certify a production deployment. The owner authorized publishing the snapshot on `codex/internal-dispatch-p1`; later phase prompts have not been implemented wholesale. The localhost preview remains available on port 3040.

### Review publication

This commit contains the validated application, schema/migrations, tests and documentation. Review its changes against `880c3d5286875921a4c536ac7dcd312ac00f66f0` using `git diff 880c3d5286875921a4c536ac7dcd312ac00f66f0..codex/internal-dispatch-p1`. Source remains unchanged after the recorded release checks; the publication update changes documentation only. QA logs/screenshots remain ignored local artifacts, as documented in the browser evidence. Publishing this branch does not authorize a merge or deployment.
