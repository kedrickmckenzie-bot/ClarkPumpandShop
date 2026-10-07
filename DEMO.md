# Convenience Suite Demo

Use the desktop operator workspace for the presentation. Mobile is required only for vendor check-in and checkout. Current validation and release status live in [the pass checklist](docs/PLATFORM_IMPROVEMENT_PASSES.md); older reviews are historical.

## Demo facts

Clark Pump and Shop is fictional: 15 stores in three districts (North 101–105, Central 106–110, South 111–115), five approved outside vendors and a six-person in-house team. The seeded showcase holds two years of history: about 815 jobs, 790 visits, 144 pieces of equipment and 222 PM visits. Totals come from these records and from anything changed in the preview since. The separate 65-store fixture is a correctness fixture, not production load proof.

**How the company works (the story every page tells):**

- **Central is in-house country.** Four techs are based at the Central shop (Maria Santos and Sam Patel for refrigeration and kitchen equipment, Devon Price for plumbing, Jordan Brooks for general repairs). Alex Morgan (North) and Riley Chen (South) handle small local jobs. Far-off stores mostly use vendors; vendors still do Central jobs that need a specialist.
- **Seasons show up.** Refrigeration and cooling calls peak in summer; heating and snow in winter.
- **Each vendor has a personality the scorecards reveal:** ColdLine (refrigeration, some HVAC) is fast and usually fixes it first time but costs the most, and carries the Store 104 beer-cave compressor callbacks now under warranty review; ClearFlow (HVAC, plumbing, kitchen) is good in Central, slower in the South, with more HVAC return visits; PumpPro (fuel) answers fastest; BrightLine (electrical) sometimes declines or pushes the date; GreenLot (lot, snow) is busy in winter. ColdLine and ClearFlow both do HVAC, so that type of work shows side by side.
- **Most vendor jobs need a repair check before they close.** A few checks were rejected and the vendor came back. Some jobs are waiting for their check right now, and a couple are overdue.
- **The last few days have something everywhere:** repairs confirmed, new urgent jobs, a BrightLine decline at Store 113, jobs waiting for a vendor to accept, scheduled visits, and repeat problems at the Store 104 beer cave and the Store 112 ice machine.

The hosted demo persists changes (D1 on the Sites preview, PostgreSQL on Render) and stores evidence files. Local development resets when its process restarts. Version v17 resets the hosted demo company once on its next start (only the fictional tenant) and seeds this story; later starts keep whatever was changed. The role picker is a preview control. Do not describe email/SMS as delivered or accounting as connected; no payment is approved or executed here.

## Desktop walkthrough

1. **Overview:** "Since you last looked" shows what changed (repairs confirmed, new urgent jobs, a vendor decline, newly overdue); each part opens exactly those jobs, and **Mark as seen** saves your last look. Repeat problems lists the Store 104 beer cave and Store 112 ice machine. Open any count to its matching records.
2. **Search:** find Store 104 and open its record. Follow work, visits, equipment and spending from the store context.
3. **Work creation:** enter the store and problem. Routine and Choose later provide a simple start. Show Internal maintenance and Outside vendor; search for “beer cave” to find ColdLine. Classification can wait.
4. **Service authorization:** show the operator WO number and billing instruction. Open the secure vendor action link and its response choices. A manual phone response stays visibly attributed. Keep the vendor ticket, vendor invoice and optional accounting PO separate.
5. **Invoice review:** open supporting work and visit evidence. Keep approved amount, recorded work cost, linked invoice amount and unmatched amount separate. Differences are review facts, not proof that service was invalid.
6. **PM:** open a completed count to its source occurrences. Preserve the store, reporting window and numerator/denominator.
7. **Repair or replace:** open the equipment planning register and one equipment record. Compare that equipment's repair price with its replacement information, then follow cost, warranty and service-history evidence. Missing prices remain visible; replacement requires a human decision.
8. **Vendor scorecards (Vendors → Scorecards):** one row per vendor with arrows against the previous period. Tap HVAC to compare ColdLine and ClearFlow side by side; open ClearFlow to see it slower in the South and a fix that did not hold at Store 113. Every number opens its jobs.
9. **Dispatch (Work → Dispatch):** the in-house board centered on Central stores, the map, and next-visit small jobs. Switch to Maria Santos to show the technician phone, AI troubleshooting on the Store 104 beer cave, and checkout by chat.

In its beer-cave comparison, repair price, vendor replacement quote and planning estimate are separate.

## Vendor phone walkthrough

1. Open the store QR link, confirm the store, select the vendor and enter the technician name.
2. Select eligible work and check in. Location is optional under the demo policy; an explicit decline is recorded. There is no continuous tracking.
3. Resume the same visit using its secure checkout link.
4. Choose the actual outcome and add a short note. An unresolved outcome creates a follow-up.
5. Return to the desktop work order and show the saved owner, next action and due time.

Observed onsite duration is approximate presence evidence, not certified labor. The September 15 local check used ColdLine and CPS-2026-0116, then recorded Return visit required. Its follow-up owner and action appeared in the desktop work and lifecycle views. This was local QA activity, not a seed change.

For the no-WO exception, choose **No work order provided / I don't see my work order**, record why service is needed, and later reconcile the visit from the operator queue. Preserve the actual visit time; do not imply that authorization existed earlier.

## Before presenting

Start from Overview with the intended preview role and demo package. Use the live UI counts; hosted demo mutations persist. Avoid resetting shared hosted data just to rehearse. The current package picker offers Accountability and Complete; do not present older package names as available controls.

Current validation results are recorded in [the pass checklist](docs/PLATFORM_IMPROVEMENT_PASSES.md). Demo readiness does not mean production readiness.
