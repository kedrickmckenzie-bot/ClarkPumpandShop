# Internal dispatch: screen and workflow specification

Status: implementation plan, October 3, 2026. This document describes intended behavior; it is not evidence that a feature exists or passed validation. Use the companion engineering plan for entity, command, concurrency, and permission contracts.

## 1. Experience contract

The manager can see what needs doing, assign it, and plan a week. The technician can understand the work and record what happened. Both use the same work orders.

- Every working screen answers: what happened, what is next, who handles it, and where to click.
- Assignment, planned work, actual visits, repair results, and confirmation remain distinguishable.
- Calls and texts remain usable; an authorized manager can record their update with attribution.
- The schedule supports uncertain repairs and long drives across a large footprint.
- No live location, productivity ranking, break tracking, or compulsory minute-by-minute updates.
- Retain existing vocabulary, priority choices, visual tokens, file handling, and canonical record links.
- Do not add financial approval powers, expand store access, or expose vendor-only/private records to make a screen work.

### Implementation phases

| Phase | Visible capability |
| --- | --- |
| P1 | Internal assignment, team pickup, return and reassignment |
| P2 | Technician results, blockers, and optional/required visit handling |
| P3 | Live week/day/time scheduling and a basic shared weekly view |
| P4 | Draft/share planning, ordered stops, availability, and rough workload |
| P5 | Travel estimates, map, and along-the-way work |
| P6 | Explained comparisons of scheduling options |
| P7 | Integrated acceptance, scope, scale, and regression verification |

P1–P3 together form the first complete release: assign and schedule → technician sees work → result or blocker reaches the manager. Earlier checkpoints must be testable, but do not describe assignment alone as a completed dispatch product.

## 2. Navigation and entry points

- Keep the existing primary navigation. Add **Dispatch** inside Work for authorized planners.
- Technician primary **My work** opens a dedicated agenda; retain access to the canonical job list and equipment/store history.
- Work-order detail offers **Assign** or **Schedule** where permitted, opening the same controls as Dispatch.
- Store detail links to that store's internal work and planned work; avoid a second independent schedule.
- Requests still enter through existing issue review. Store managers do not gain work-order creation or dispatch rights from this feature.
- Vendor grouped work and vendor acceptance remain separate existing flows.
- Field manager visibility comes from actual store grants, including a verified companywide grant. A persona label never grants access by itself.
- Search supports store number, name, address, work-order number, and problem text. Preserve scope on every link.

## 3. Dates must say what they mean

| Label | Meaning |
| --- | --- |
| Next action due | Deadline for the current accountable action |
| Target completion | Optional explicit target for resolving the repair |
| Planned | Week, day, or exact appointment selected for execution |
| Recorded arrival / checkout | Saved visit evidence |
| Reported completed | Outcome reported by a person |
| Confirmed | Existing verification decision, when applicable |

Current `WorkOrder.dueAt` is a mutable next-action deadline. Do not rename it “original repair deadline,” copy it into a completion target without a stated migration decision, or assume all historical values mean repair completion.

Scheduling does not silently change a target completion or next-action deadline. If an action deadline changes as part of a legitimate workflow transition, show and audit that transition separately.

When saving an actual schedule satisfies a Schedule service task, complete that task and establish the next execution obligation through the shared command. Do not keep a fulfilled scheduling task overdue. Do not equate that transition with changing Target completion.

Week and day plans are calendar values, not midnight appointments. Show “Week of Oct 5,” “Thu, Oct 8 · Anytime,” or “Thu, Oct 8 · 10:00 AM Eastern.” Exact appointments use the store's zone; the board names its planning zone and makes cross-zone times explicit. Never convert a typed date through the browser's zone and shift the day.

## 4. Manager Dispatch screen

Recommended default: current week, previously selected authorized scope, list view. These are design defaults rather than claims about an existing customer setting. Weekend work remains reachable; no hardcoded five-day workweek.

Desktop at 1440 px:

```text
Dispatch                 < Week of Oct 5 >  Today     Search
Scope: All my stores     Technician: All    List / Week

Needs planning                           This week
Store 104 • Beer cave warm               Maria Santos
Routine • Target: Fri                    Thu • Store 109 • 2 jobs
Internal team • Ready                    Fri • Store 104 • Beer cave
[Schedule]                               Week only • Store 111 • Sink

Store 112 • Dispenser fault              Devon Price
Urgent • Next action due: Today          Wed • Store 112 • Dispenser
[View job] [Schedule]                    [Open day]
```

- P1 exposes assignment queues; P3 adds the weekly section. No empty future map or capacity controls.
- Main filters: week, store/region scope, technician, and work state. Secondary choices go under More filters.
- Needs planning includes ready unscheduled work; choosing a week must not hide unscheduled urgent work.
- Ready, Waiting, and Next visit are separate filterable states. Waiting jobs retain an owner and next action.
- Row emphasis: problem, store, assigned person/team, planned period, then applicable target/deadline and blocker.
- The selected job opens an adjacent detail panel on desktop, with a full-record link. It must not cover the action the user is performing.
- No large dashboard tile stack before records. Compact counts open exactly the corresponding scoped records.
- Target conflicts and unplanned urgent work receive readable labels; color alone does not carry meaning.

Phone at 390 px:

- Use one column: **To plan / Schedule**, then a day or week agenda grouped by technician.
- Keep week navigation and scope visible without horizontal scrolling.
- Schedule/Move buttons are the primary mechanism. Drag-and-drop is never required.
- Open the job or scheduling form as a focused full-width view, preserving the list position and filters on return.
- Show description previews with Expand; do not require opening a tiny chevron to select a job.

## 5. P1 assignment controls

Routing remains **Internal maintenance / Outside vendor / Choose later**. An internal job can be sent to a named technician, the eligible team, or a field manager for allocation.

Fields: **Who handles it?** searchable scoped choices; a responsible manager/fallback is preserved or resolved by policy. Only ask for missing information. Keep assignment distinct from the future schedule.

Buttons: **Assign**, **Take job**, **Return to team**, **Reassign**. Direct assignment does not require a technician acceptance ceremony.

- Choose later is not internal team work. Outside-vendor holds never leak into the team pickup queue.
- Available team jobs can be claimed once. A competing claim says “Maria took this job. Refresh the list.”
- Return keeps the job open, records who returned it, preserves applicable deadlines, and exposes it to the eligible team. Urgent/overdue return alerts the responsible manager.
- Reassignment removes the job from the former technician's assigned list while preserving history.
- An active visit requires explicit handling; do not move its performer, observed timestamps, or completed outcomes to the new assignee.
- An error preserves form input. Do not pretend a failed request assigned the job.

## 6. P2 technician My work

Until scheduling arrives, My work opens assigned jobs and Available team work. In P3 the recommended tabs become **Today / Upcoming / All my jobs / Available team work**. “All my jobs” retains unscheduled and unfinished work; it must not vanish at midnight.

P2 completes the technician journey while keeping P1's assignment choices. Keep the two lists easy to scan:

- Show the problem and store first. Use **Assigned to Maria** once, with **Manager: Chris** as secondary information when a person is responsible. If responsibility belongs to Facilities coordination, name that team rather than inventing a manager. Keep the next action and its due time visible without repeating the assignee's name in every field.
- Use **Ready to work** for work that is actually ready and **Needs a technician** for ready, unclaimed team work. These are presentation labels over the actual assignment/readiness state; preserve canonical task meanings and deadlines. Blocked, held, manager-pending, and unfinished inspection work keep their specific required action.
- In Available team work, show work needing attention now first. Put held jobs in a separate, secondary **For a suitable visit** section with the hold reason and applicable priority/deadline. Give each group an accurate scoped count and list destination. Held jobs remain findable and claimable under the existing rules, but are not presented as immediate obligations. Do not tuck urgent work into this optional section.
- Buttons describe the action they perform: **Open job**, **Take job**, **Record result**, and **Flag a problem**. Readiness text is a status, not a substitute for an action label.

```text
My work                         Today • Thu, Oct 8
Store 104 • 120 Main Street
Beer cave not cooling
Instructions • Equipment • Photos • Store contact
[Open job]                       [Record result]

Store 109 • 2 jobs
Sink leaking / Exterior light
[Open stop]
```

- Stop cards group jobs intended for the same visit. Each job keeps its number and outcome. An explicit second visit to that store later the same day remains a separate stop occurrence.
- My work shows published/live work only; draft changes are introduced in P4.
- Current assignments and the phone agenda agree with the manager's screen.
- Do not make prices, invoice controls, or generic workflow-task timers the technician's primary action.
- Opening history, taking a job, or planning a stop does not create a visit.

### Job detail and result

Opening a job from My work lands on a dedicated technician screen. Its first view shows store/location and equipment if known, the problem and work requested, available photos/instructions, any relevant warning, and **Record result** / **Flag a problem**. Equipment and component may be absent. Existing descriptions are reused; no new short-title entry.

Keep a **Full work record** link below the execution content for Service, Visits & notes, Prices & costs, Equipment, and History, subject to the user's permissions. Ordinary technician work must not require navigating those sections to find instructions, save a result, or ask for help. Required check-in and specialized inspection actions remain explicit; use the authorized action instead of offering a generic result shortcut that bypasses them.

**Record result** offers **Fixed / Needs more work / Needs an outside vendor** with notes and one optional multi-file/photo upload for the action. Reuse the domain's more specific outcomes where required, with plain labels.

**Flag a problem** offers **Need parts / Need help / Need a vendor / Cannot get to it today**. Ask only relevant follow-up details; unresolved work must acquire a visible accountable action. “Cannot get to it today” does not automatically mean return to team.

Check-in behavior follows company policy:

- Optional: record a no-active-visit result through a real audited outcome path; never invent an arrival or checkout.
- Required: show Check in/Check out and the authorized exception path. Do not let a generic result button bypass policy.
- Existing active visit: recording/checkout uses the same visit and per-job outcome commands; no duplicate visit or result on retry.
- Technician identity comes from sign-in. A manager recording a phone update retains their actor identity and names the reported performer/source.
- Photos/documents can be opened after saving. Upload failure retains notes and allows safe retry without duplicating the result.

A reported fix is not automatically verification. Required confirmation moves to the existing confirmation workflow; optional confirmation follows existing closure rules. Returning for parts keeps the same work order and plans another execution attempt.

## 7. P3 live scheduling

Open **Schedule** from a job, selected list rows, or a technician/day. One form:

1. **Who?** current eligible assignee/team/field manager, with clear reassignment if changed.
2. **When?** This week / Choose week / Choose day / Appointment.
3. Week/date; time only for Appointment. Optional rough repair-duration estimate.
4. **Save schedule**.

P3 saves are live. Each committed schedule command creates at most one recipient update per relevant recipient, subject to deduplication/delivery rules. Do not show Publish or claim a draft exists in this phase. Confirmed delivery is separate from a pending notification.

- Week-only work appears in a labeled Week only section; it does not consume a fabricated day/time slot.
- Day work says Anytime unless an actual time is selected.
- Scheduling beyond explicit target completion shows a conflict before save; do not silently extend the target.
- Moving work preserves assignment unless the user explicitly changes it.
- Removing a schedule leaves the job assigned and visible as Unscheduled. Releasing a job is separate.
- Existing fixed appointments remain explicit; they are not replaced by an internal plan silently.
- A planned return is another attempt on the same work order, not a cloned job.
- Stale saves show what changed and retain the proposed edit for review.

Technicians can use Schedule/Move for their own flexible day/week work. Keep Target completion and fixed appointments unchanged; show conflicts and notify the accountable manager of a material date change. Exact appointment changes, reassigning to someone else and editing Target completion remain manager actions. A technician's form keeps Who fixed to themselves instead of offering unauthorized assignees.

## 8. P4 prepare, share, and manage the day

Introduce **Prepare changes** and **Share plan** only when durable draft/published semantics exist. Draft edits must not change live assignments, technician lists, or ordinary work counts. Sharing validates the affected work again, commits the intended changes, and sends a consolidated update.

Show **Draft changes** versus **Shared plan** clearly. A manager and technician editing the same plan must see conflicts rather than overwrite each other. Urgent same-day changes can use a concise live update path; they must not wait behind unrelated unpublished work.

**Open day** shows starting location, ordered store stops, optional ending location, and jobs under each stop. Defaults use saved preferences and genuinely scheduled work; do not populate today with the technician's entire backlog. Do not assume the last check-in is their current location.

Technicians can reorder flexible stops. Respect fixed appointments and deadlines with clear conflict treatment. Provide Move up/down or Move after controls as alternatives to dragging.

The P3 authority for moving one's own flexible work continues. Ordinary same-day reorder does not ask for approval or send a ping.

Use ENGINEERING.md's action and notification tables for role defaults and recipients. Do not choose global team notifications as a shortcut.

Availability is **Unavailable** on a date or time span, without sickness/vacation reasons. Normal planning availability is optional context, not payroll or employee shift management.

Rough workload is optional: Under an hour / 1–2 hours / Half day / Full day / Not sure or custom. Bucket-to-range assumptions must be visible and configurable where applicable. Unknown jobs remain unknown; never count each as one hour or show precise free time from incomplete estimates.

Example: “Estimated repairs 3–5 hours · 2 jobs not estimated.” Driving appears separately when supported in P5. No productivity score or inferred idle time.

## 9. P5 geography and along-the-way work

Map is optional beside the list. Every map action has a list equivalent. Locations are stores and selected planned start/end points, not live technician dots. Missing coordinates remain visible and never receive made-up directions.

Driving estimates cover the selected full journey, including the ending leg if chosen. Label source/freshness and typical-versus-current assumptions. Fictional demo travel is visibly sample data. A routing outage leaves planning usable without an estimate.

**Find work along my route** lists eligible held internal pool work and the technician's own ready assigned work at additional stores. Exclude every store already in the plan, whether that store's other held work was accepted or not. Existing same-store additional-work flow remains responsible for those jobs.

- Include eligible held pool work and the technician's own ready assigned work, including ordinary non-held jobs. Already scheduled own jobs require an explicit move, not a second commitment. Ordinary unassigned repairs stay in the main planning queue unless explicitly marked suitable for a future visit.
- Exclude outside-vendor work, Choose later, work owned by another technician, and unauthorized stores.
- Show store, full expandable problem, WO number, equipment/location if known, priority/target, and estimated added driving.
- Group multiple jobs at the candidate store, with labeled independent selection and separate detail expansion.
- Confirmation: “Add Store 106 after Store 104 · about 35 extra driving minutes” and **Add 2 jobs**.
- Repair time is separate. Do not sum independent detours after adding several stops; recalculate the revised trip.
- Revalidate/claim jobs on confirmation. If a store is added, it leaves the along-the-way list immediately.
- Opening the suggestion or a job description never accepts, assigns, or releases a hold.

## 10. P6 compare scheduling options

**Find someone / Suggest a fit** shows explained options using available assignment, readiness, time-window, duration, and travel data. It does not dispatch automatically or rank technician performance.

Use **Could fit / Would require moving work / Availability uncertain**, with supporting facts. Example: “Maria already has a trip here Thursday. About 35 extra driving minutes. Repair duration unknown.” Missing duration prevents a claim that the day has enough capacity; it does not prevent an honest travel comparison.

Show displaced work and deadline conflicts before confirmation. Preserve the difference between planned locations and recorded visits. An urgent dispatch may need a manager to confirm the starting point by phone. Convenient travel must not indefinitely defer a remote store's important work.

## 11. Universal states and interaction requirements

- Loading: stable placeholders; no temporary “0 jobs” claim before results load.
- Empty: describe the selected scope/period and offer a relevant action or Clear filters.
- Permission: plain access message, no inaccessible job titles or provider data in previews.
- Partial data: retain usable records and identify unavailable estimates/sections.
- Save failure: keep edits/files where feasible; safe retry, visible confirmation only after success.
- Conflict: explain the changed assignment/plan and offer Refresh/review, without silent overwrite.
- Desktop keyboard and phone controls have labels, visible focus, adequate tap targets, and announced status/error messages.
- Restore filters, selected week, and scroll position after an action; exact action links open the correct control.

## 12. Browser acceptance by role and step

Validate at 1440 px and 390 px with fresh and retained records; record exact revision, role, scope, journey, and result. A route loading successfully is not a usability pass.

| Role / step | Required evidence |
| --- | --- |
| Facilities P1 | Assign directly, send to field manager, assign team, and preserve Choose later distinction |
| Field manager P1 | Companywide and scoped visibility; reassign/return; concurrent claim conflict |
| Technician P2 | Find assigned work, record optional no-visit result, required check-in path, photos, blocker and return |
| Store manager P2 | Existing report intake and repair confirmation work; no dispatch-power expansion |
| Manager + technician P3 | Week/day/exact time matches across screens; target conflict; unfinished and unscheduled work retained |
| Two planners P4 | Draft invisible to tech until shared; stale draft/reassignment conflict; consolidated update |
| Technician P4 | Flexible reorder with buttons on phone; fixed appointment remains explicit |
| Planner P5 | Long driving footprint, start/end legs, missing route, additional-store exclusion, concurrent acceptance |
| Planner P6 | Nearby all-day repair compared with distant short jobs; unknown estimates honestly shown |
| Owner / finance / vendor P7 | Read/write policy unchanged; vendor issuance, public check-in and invoice workflows still work |

P7 also checks cross-tenant/deep-link denial, no-store sessions, real resolver scopes, time-zone boundaries, retries, accessible alternatives, source-count drill-through, and scale. Keep uncovered cases pending with precise evidence; do not claim browser acceptance from tests alone.
