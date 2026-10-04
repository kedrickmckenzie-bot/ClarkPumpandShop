# Revised Assign release — October 4, 2026

Owner-approved implementation on `codex/internal-dispatch-p1`, based on `931bcb7c62654cc483bb34b9edf678b25eca6441`. This supersedes the week-grid main view; original IM, IDP and RD acceptance IDs and independent production gates remain unchanged.

## Implementation

- Dispatch opens Assign inside the existing Work sidebar. Incoming cards wrap the complete problem, store number/name, status, planned date, entered estimate or unknown duration, and plain deadline. Today is the second tab, with ordered readable stops and explicitly future map space. Search all jobs retains the paged list.
- Technician rows show current work and next dated commitment, home region, optional skills and secondary day counts. Empty days are faint without dashes. Multiple rows expand independently. Compare opens two people’s full cards together with the selected incoming problem.
- At 1440 × 900, the first five complete technician rows end at approximately 388, 512, 635, 759 and 883 px. The selected-job state also retains five rows (fifth bottom approximately 884 px), with matches in the day strip. Dispatch suppresses the optional Recently viewed strip to retain that density after navigation. At 390 × 844, the first incoming card and Assign button are visible without scrolling; the chooser includes current/next work, skills and Same/Different region.
- Skill and region matches are suggestions only. Sparse rows never claim availability. Current and next summaries use independent bounded repository queries; dated plans use native day/time/priority/id ordering and stable pagination, so the first general-work page cannot hide an earlier stop. Today pages and Compare expose further-work links when needed.
- Assignment keeps the saved plan. A day choice explicitly changes the plan and retains entered estimates. Saves and Undo call the existing internal assignment/schedule commands, carrying work, assignment and schedule versions. Undo refuses a newer intervening change. Existing result, readiness and confirmation commands remain authoritative. Owners have no Assign buttons; command permissions and store scopes are unchanged.

## Data and persistence

The presentation contract is six fictional technicians, approximately 36 open internal team jobs, the same 15 stores and five vendors. Thirty stable new job identities add varied started, parts, next-visit, assigned and unassigned examples to the existing internal stories. Loads, daily counts and estimates derive from records. Unknown estimates remain unknown. Demo work-order numbers use the unused 8401–8430 range.

Technician profiles contain optional home region and skill tags, tenant/member uniqueness, and tenant-scoped foreign keys. D1 and PostgreSQL migrations add this metadata. Existing showcase bootstrap invokes an INSERT … ON CONFLICT DO NOTHING backfill restricted to the new dispatch identities. No seed-version reset or hosted reset is introduced. Repeated backfills on native D1 and actual PostgreSQL preserve a changed customer problem, version, deadline and existing plan. Fresh fixtures and fresh database seeds contain the same dataset. Hosted databases were not reset or directly changed in this work.

## Browser proof

Local fixture preview: `http://localhost:3040/app/dispatch`. Screenshots and crawl JSON are saved in `C:/Users/Kedrick/Downloads/Dispatch Assign - Production Proof`.

The real browser loop used CPS-2026-8425 (North Market drain): assign Maria while retaining the date; Undo restores the prior assignee/date; reassign; schedule October 5 with a 90-minute estimate; technician reports replacement trap/gasket needed; manager marks ready after parts arrive; technician records Fixed; manager confirms Completed as expected. The saved confirmation and attributed history are visible on the work order. This was fictional local data, not a hosted operational repair.

The folder includes an `index.html` proof gallery. Screenshots: `15-selected-five-rows.jpg`, `07-assign-desktop-final.jpg`, `10-assign-phone.jpg`, `08-today-desktop.jpg`, `09-today-phone.jpg`, `12-compare-desktop-final.jpg`, `14-compare-phone.jpg`, `11-chooser-phone.jpg`, `13-owner-read-only.jpg`, and loop evidence `03-needs-parts.jpg` through `06-confirmed.jpg`.

The final crawl covers 112 distinct role/page pairs at both 1440 and 390 px: all menu destinations for Maintenance / facilities, Field manager, Technician, Owner / leadership, Regional manager, Store manager and Invoice reviewer, plus representative Dispatch/job/store/equipment/vendor drill-throughs. All have a rendered heading, no detected page error and no document horizontal overflow. The owner Dispatch check separately confirms zero Assign buttons. This is not an exhaustive crawl of every record/filter combination or a claim of live map/provider validation.

## Required checks

Final checks passed on the frozen release source:

| Check | Result | Local evidence |
| --- | --- | --- |
| `npm run db:seed` | Deterministic, causally valid; 15 stores / five vendors / six technicians; separate 65-store fixture | `assign-final-seed.log` |
| `npm run typecheck` | Pass | `assign-final-typecheck.log` |
| `npm run lint` | Pass | `assign-final-lint.log` |
| `npm test -- --maxWorkers=2` | 209 files; 1,480 passed; 15 intentional adapter-specific skips | `assign-frozen-full.log` |
| `npm run test:e2e -- --maxWorkers=1` | Four files; 68 passed | `assign-final-e2e.log` |
| `npm run build:render` | Pass; Next/Render production build | `assign-final-build-render.log` |
| `npm run build` | Pass; Vinext/Cloudflare production build | `assign-final-build.log` |
| Native persistence / policy | Actual isolated PostgreSQL and native D1 cases included in the full run; backfill preservation, plan-order pagination, permissions, concurrency and rollback | `assign-final-targeted.log`, full suite |

Logs are under `.codex-runtime`. The final full run completed in 652.54 seconds with `OPS_DISPATCH_TEST_DATABASE_URL` pointing only to the disposable localhost PostgreSQL test database. No customer database was migrated by the tests.

Earlier full runs exposed obsolete two-person/count expectations and historical pre-scheduling seed assumptions; those were corrected without relaxing the underlying access or workflow assertions. A parallel run during builds timed out once in public-link recovery; the unchanged test subsequently passed in the workflow suite and the final full run. The late-today regression was added while a serial run already held an older transformed helper and failed in that run; all four focused Assign tests passed in a fresh process. The entire frozen-source suite was then rerun successfully, rather than combining partial reruns or extending timeouts. These earlier observations remain in `assign-full-tests.log`, `assign-final-full.log`, `assign-final-serial.log` and `assign-final-deadline.log`.

The owner authorized commit and push to the existing branch. This release does not deploy, reset hosted records, enable live delivery, or close the separate P1–P3 independent reassessment / production-readiness gates.
