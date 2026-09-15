# Convenience Suite Demo

Use the desktop operator workspace for the presentation. Mobile is required only for vendor check-in and checkout. Current validation and release status live in [the pass checklist](docs/PLATFORM_IMPROVEMENT_PASSES.md); older reviews are historical.

## Demo facts

Clark Pump and Shop is fictional: 15 stores, three regions, five approved outside vendors and two internal technicians. The September 15 seed check reports 100 requests, 422 work orders, 399 visits, 144 assets and 222 PM occurrences. Totals come from these records and subsequent saved activity. The separate 65-store fixture is a correctness fixture, not production load proof.

The hosted demo persists changes in D1 and uses the FILES binding for evidence. Local development resets when its in-memory process restarts. The role picker is a preview control. Do not describe email/SMS as delivered or accounting as connected; no payment is approved or executed here. Import currently previews a file without applying it.

## Desktop walkthrough

1. **Overview:** show work needing attention and who owns the next action. Open a count to its matching records.
2. **Search:** find Store 104 and open its record. Follow work, visits, equipment and spending from the store context.
3. **Work creation:** enter the store and problem. Routine and Choose later provide a simple start. Show Internal maintenance and Outside vendor; search for “beer cave” to find ColdLine. Classification can wait.
4. **Service authorization:** show the operator WO number and billing instruction. Open the secure vendor action link and its response choices. A manual phone response stays visibly attributed. Keep the vendor ticket, vendor invoice and optional accounting PO separate.
5. **Invoice review:** open supporting work and visit evidence. Keep approved amount, recorded work cost, linked invoice amount and unmatched amount separate. Differences are review facts, not proof that service was invalid.
6. **PM:** open a completed count to its source occurrences. Preserve the store, reporting window and numerator/denominator.
7. **Repair or replace:** open the equipment planning register and one equipment record. Compare that equipment's repair price with its replacement information, then follow cost, warranty and service-history evidence. Missing prices remain visible; replacement requires a human decision.

Store 104 was checked on September 15 with nine completed PM occurrences and ten planning-register records. These are observed counts, not figures to promise after further demo mutations. In its beer-cave comparison, repair price, vendor replacement quote and planning estimate are separate.

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

All required commands, 933 tests, 54 workflow checks and both builds passed for private version 50. The workflow command uses Vitest and is not a repeatable real-browser suite. Manual browser evidence and remaining production gates are recorded in the checklist. Demo readiness does not mean production readiness.
