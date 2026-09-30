# TraceOps — first Clark’s demo walkthrough

Prepared September 29, 2026. Main walkthrough: about 25 minutes, plus questions. Links below open the Render demo. Counts and dates may change as the demo is used.

## Your message

> “This gives you one place to see what needs attention across the stores, get the work handled, and keep the history. You can start with the basics and use the other parts as they become useful.”

Speak naturally; these are prompts, not a speech to memorize. After each click, pause long enough for him to look at the screen. Describe the problem this solves before describing the control.

## Before the meeting

1. Use the hosted Render demo, not localhost. Select **Complete** and **Maintenance / facilities**. Keep that role throughout the main walkthrough.
2. Confirm the latest deployment has finished. Rehearse the links below in order.
3. Close unrelated tabs. Keep Overview, Store 104, the store QR page, equipment history, capital planning, Compliance, and the camera task ready in separate tabs.
4. Use the current store QR page, not an old service link. Resetting the demo can invalidate earlier links. Generate and rehearse a fresh vendor link only if you plan to demonstrate the vendor response screen.
5. Open the demo on your phone ahead of time if you will show the QR experience. Do not make the first phone connection during the meeting.
6. Use existing records for most of the walkthrough. Opening forms is enough to explain setup. If you want one live save, rehearse the optional work-order creation below first.
7. Read the **rehearsal findings** at the end. Check the deployment notes before using inspection detail or the cost example.

**Opening disclosure:** “These are fictional stores and sample records, so we can explore freely. They aren’t your actual maintenance history.”

---

## 1. Learn what matters to him — 2 minutes

**Screen:** [Overview](https://traceops-convenience-demo.onrender.com/app/overview).

**Say:**

> “Before I show you around, what part of store maintenance do you get involved in?”
>
> “When something breaks, where does the process get frustrating—getting it reported, chasing the vendor, knowing it was fixed, or figuring out what it cost?”

Let him answer. Use his answer later: “This is the part that addresses what you mentioned about ___.”

**Transition:** “Let me show you a normal day, then how those individual repairs turn into useful information for the business.”

## 2. Start with what needs attention — 3 minutes

**Click / point:**

1. Point to **Needs your action** and **Open items**.
2. Click **Needs your action** to show the supporting queue. Return with Back.
3. Point to **Reported operating problems**.
4. Open **View all … priority reports**. Switch between **Needs review** and **All unresolved problems**. Return to Overview.

**Say:**

> “The first question is: what actually needs me today? Open items are everything I can see. Needs your action is where I have a decision or follow-up.”
>
> “Here are the reported problems affecting store operations. Once we create a work order, the report leaves the default review list. We can still see it under all unresolved problems until the work is resolved.”
>
> “The numbers open the records behind them, so you can go from the overview straight to the problem.”

**Point out:** Who acts next, what they need to do, and the due date on a queue item.

**Value:** Less time collecting updates and deciding where to start.

**Do not:** Read every tile or explain every filter. One drill-through proves the idea.

## 3. Show the store as the common starting point — 2 minutes

**Click:** **Stores**, search **104**, open **Store 104**. Shortcut: [Store 104](https://traceops-convenience-demo.onrender.com/app/stores/store-northline-104).

**Point to:**

- The open issue report near the top.
- Open work, recorded cost, and PM status.
- **Compliance**, **Warranties**, and **Vendors** links.
- ColdLine marked **Preferred here**.

**Say:**

> “If someone calls about a store, I can start with the store number. Here are the problems already reported, the work underway, the equipment, and the history.”
>
> “I can also see which vendors cover this location and who we prefer here. A preference can be specific to one store; it doesn’t have to apply companywide.”

**Value:** The next person can understand the store without finding the person who remembers its history.

## 4. Show how a problem becomes work — 3 minutes

**Click:** The Store 104 report **“Beer cave door is not sealing and packaged beverages were moved to backup coolers.”** Shortcut: [report REQ-26-104D](https://traceops-convenience-demo.onrender.com/app/requests/request-current-104-beer-cave-door).

**Point to:** Problem description, reporter, Urgent priority, and **Potentially related work**.

**Say:**

> “The store describes what they see. They don’t have to diagnose the compressor or know what the repair will cost.”
>
> “The reviewer can see related work before creating another job. If this is already being handled, we can link the report to that work.”

**Click:** **Create work order**. Show the prefilled store, problem, and priority. Expand **Choose how to handle it** or the relevant choices if needed.

**Say:**

> “The report carries forward, so maintenance doesn’t retype it. We can use internal maintenance, an outside vendor, decide later, or save a small job for a suitable visit.”
>
> “Equipment, spending limits, and detailed service instructions can be added when we know them. A store and a problem are enough to get started.”

**Stop:** Do not submit this particular report during the main demo; it already has potentially related door work. Return or switch tabs.

**Optional live save:** Use [Store 103’s routine faucet report](https://traceops-convenience-demo.onrender.com/app/requests/showcase-report-103), review related work, then create a work order using **Choose later**. Rehearse first; this changes the shared demo. Show the resulting number and source-report link. Do not repeatedly create copies.

## 5. Show the vendor’s simple experience — 3 minutes

**Open:** [Store 104 service desk / QR page](https://traceops-convenience-demo.onrender.com/public/store/yxXEL85UZIlTAPwVDanaA1n5n2O0Sx5cmQc2s3TQYUM).

**Say:**

> “The people doing the work don’t have to learn this whole system. A technician can scan the store code or use the store device.”

**Click:**

1. **Vendor check-in**.
2. **ColdLine Refrigeration & HVAC**.
3. Open **CPS-2026-0116** to show its description, then select it if demonstrating the next step.
4. Point out **I don’t see my work order**.

**Say:**

> “They choose their company, then the work they came for. They can open the job to see the problem before selecting it.”
>
> “If someone was called directly and doesn’t have a work-order number, we can still record the visit and send it for review.”

**Stop:** Before the final check-in submission unless you deliberately want a live visit. The main demonstration does not need a new visit.

**If you rehearsed a complete check-in:** After check-in, show the separate additional-work offer when eligible work is available. Say: “These are other approved jobs they can add while they’re here.” Availability depends on vendor and work eligibility; do not promise the offer will appear every time.

**Value:** Participation without forcing every vendor to adopt a portal, plus a record of who came and what they were there to do.

**If asked about vendor acceptance:** Show a freshly prepared secure service link. Explain accept, decline, scheduling, and questions using the controls actually displayed. For this demo, use copy-link handoff; don’t claim an email was delivered unless delivery is confirmed.

## 6. Show the repair story after the visit — 2 minutes

**For a pending confirmation:** choose **Work → Needs confirmation → Confirm repair**. As Facilities, CPS-2026-0201 opens the original problem, technician result, and Yes / No / Not sure choices directly. The Store manager preview covers Store 104, so it cannot confirm that Store 101 example. Don’t submit a result during rehearsal unless you intend to change the demo record.

**Open:** [CPS-2026-0104 — Visits & notes](https://traceops-convenience-demo.onrender.com/app/work-orders/wo-northline-104?view=visits).

**Transition:** “Here’s an earlier completed repair on that beer cave, so you can see what the record looks like afterward.”

**Point to:**

1. Visit 1: diagnosis and **Parts Required**.
2. Visit 2: compressor replacement and the beer cave pulling down to **36°F**.
3. The store result check and recorded **Fixed** confirmation.

**Say:**

> “The first trip didn’t finish the job. The return trip and outcome stayed on the same work order.”
>
> “We keep what the technician reported and the later confirmation that the problem was fixed. A completed visit and a confirmed repair are different facts.”

**Value:** A useful record of the repair, including return visits and the result.

**Keep precise:** Check-in/out is evidence of approximate presence, not proof of billable labor. For tomorrow, do not use this record’s Prices & costs tab without addressing the rehearsal finding below.

## 7. Turn repair history into a decision — 4 minutes

**Click:** Return to Overview → **Most frequent equipment issues** → Store 104’s **Beer cave – rear sales floor**.

Shortcut: [Store 104 beer-cave history](https://traceops-convenience-demo.onrender.com/app/equipment/asset-104-beer-cave?cohort=issues&history=12&issueFrom=2025-10-01&issueTo=2026-09-29&currency=USD#equipment-review).

**Point to:**

1. Five unplanned work orders in the displayed period.
2. Recorded work cost and the actual supporting jobs.
3. **Compressor** in the component selector.
4. Warranty terms: labor, part, diagnostic, and manufacturer coverage, with their dates.

**Say:**

> “This is where the history starts helping with decisions. Instead of asking whether we’ve worked on this cooler before, we can see the jobs, the component, the result, and the recorded costs.”
>
> “A unit can have different warranties on different parts and on the vendor’s work. Before paying for another repair, we can see what coverage is recorded and check whether it applies.”

**Important wording:** Call them “issues” or “work orders,” not “five breakdowns” or “five outages.” Warranty dates do not establish that a particular failure is covered.

**Then open:** [Planned replacements](https://traceops-convenience-demo.onrender.com/app/lifecycle?view=capital&start=2026-09&months=12&currency=USD). From Overview the link is **View capital forecast**.

**Click / point:** **Monthly breakdown**, then the Store 112 ice-machine plan. Show the **3 / 6 / 12 / 24 months** look-ahead choices. You can open **Plan a replacement** to show the form without saving.

**Say:**

> “Once we decide a replacement should be planned, we can put an estimated amount against a month and see the money needed over the coming months.”
>
> “This ice machine is a proactive replacement. It doesn’t have to break or trigger a repair warning before we plan for it.”

**Value:** A record of past work that also supports future spending decisions. Planning amounts are estimates, not approved spending.

## 8. Show recurring inspections and paperwork — 2 minutes

**Click:** [Compliance](https://traceops-convenience-demo.onrender.com/app/compliance).

**Point to:** **Overdue**, **Missing paperwork**, **Open findings**, and the inspection rows.

**Use these examples:**

- Store 104: fire-extinguisher check overdue.
- Store 110: hood inspection performed, report still missing.
- Store 114: safety inspection with an open finding.
- Weekly store walks assigned to internal people; fuel inspection assigned to PumpPro.

**Say:**

> “You can schedule your own inspections and recurring store walks, assign the work internally or to a vendor, and keep the returned paperwork with the inspection.”
>
> “It also separates ‘someone performed it’ from ‘we have the result and required paperwork.’ The hood inspection is a good example: the visit happened, but the report is still needed.”

**If rehearsed successfully:** Open **New schedule** and point out recurrence, assignee, and master document. Say: “Use the checklist you already have: download it, complete it, and return the paperwork and photos.”

**Inspection detail:** The fix has been checked locally; after deploying it, rehearse Store 114’s inspection → Open corrective work. Describe compliance as tracking the inspections and requirements the company sets up.

## 9. Show a manager getting an answer back — 2 minutes

**Open:** [Store 109 camera task](https://traceops-convenience-demo.onrender.com/app/tasks/showcase-task-camera).

**Say:**

> “Sometimes the next step isn’t a repair. It’s ‘please check this and tell me what you find.’”

**Point to:**

1. The request and camera time window.
2. Returned findings: **Needs attention**.
3. Observed camera times **9:12–10:06** and the note that the full work area wasn’t visible.
4. **Reviewed — close task**, **Send back for more information**, and replies.

**Say:**

> “The store has returned its findings, and the requester has a clear next action. They can close it or ask for more information without losing the conversation.”
>
> “You can also send a general task by store, with no vendor or work order involved. Choose a person, someone at the store, or anyone responsible for that store.”

**Optional form:** Open [New task](https://traceops-convenience-demo.onrender.com/app/tasks/new). Select a store and show the recipient choices and **Let me know when this is done**, checked by default. Leave without sending.

**Value:** Clear ownership and a returned answer. No need to keep a separate reminder to call the store again.

## 10. Finish on the overview and ask for the next step — 2 minutes

**Return:** [Overview](https://traceops-convenience-demo.onrender.com/app/overview).

**Say:**

> “The main benefit is that the report, work, visit, result, and history stay connected. Your team can start with the parts that help today and add more as needed.”

**Ask, then listen:**

> “Which part of that would be most useful for your team?”
>
> “Where would this not fit the way you work?”
>
> “Who else should we walk through it with?”

If he wants to try it: “Let’s choose a small group of stores and agree on what we want to learn—whether reports get captured, follow-ups get handled, and people can find the history.” Discuss rollout, price, and commitments after understanding who would use and approve it.

---

## Optional branches — use when he asks

### “Where is our money going?”

Overview → **Where maintenance dollars go** → click a service area such as HVAC, or a highest-cost store. Show the underlying work list and its period. Then open **Spending & planning** if he wants deeper comparison.

Say: “You can follow the number back to the jobs behind it. This is recorded maintenance cost; it isn’t a claim about the company’s entire accounting spend.”

### “Can we track invoices?”

Open [Invoices](https://traceops-convenience-demo.onrender.com/app/invoices). Show the upload/drop area and review list if present. Demonstrate extraction with a known sample only after rehearsing that file on Render.

Say: “Invoices can be attached to the work and reviewed when the information needs attention. You can open the source document to see what the vendor actually submitted.”

Do not use the $585 unmatched demo invoice to demonstrate line-item extraction: it currently has no invoice items. Its attached file is explicitly a fictional summary, not a vendor-original invoice. Do not describe invoice review as payment execution.

### “How do we avoid a separate trip for every small problem?”

Store 104 → **Jobs saved for later**. Show the door closer, faucet, and canopy-light examples. Point to **Group jobs for a visit**.

Say: “Small jobs can stay visible until there’s a suitable visit. Only appropriate approved work is offered; it doesn’t get silently added to the technician’s job.”

### “What about preventive maintenance?”

Store 104 → **Preventive maintenance** → **Open full PM record**. Show due, missed, and completed work, plus a program’s service window.

Say: “We can see what should have happened and the completion records behind it, instead of assuming a recurring appointment means the work was done.”

### “Can the store report it themselves?”

Store 104 QR page → **Report a store problem**. Show the input form. Avoid submitting another beer-cave report just for demonstration.

Say: “They report what they see. The reviewer handles assignment and related work.”

## If time gets cut to 10 minutes

1. Overview and one queue drill-through — 2 minutes.
2. Store 104 and report-to-work form — 2 minutes.
3. QR company selection and job description — 1 minute.
4. Equipment history, warranties, and capital forecast — 3 minutes.
5. Ask what fits and who should see it next — 2 minutes.

## Rehearsal findings — presenter notes, not sales copy

Read-only hosted checks were performed September 29. No work orders, tasks, inspections, or visits were submitted during preparation.

- Verified: Overview, Store 104, report and creation form, issued work overview, company-first QR job selection, completed visit history, equipment history/warranty table, capital forecast, Compliance dashboard, and returned camera findings.
- **Compliance detail fix:** PostgreSQL returned history as decoded JSON while the page expected JSON text. The repository now normalizes it. Local browser retest opened the inspection, history, and corrective-work link. Deploy the fix and rehearse Render before showing the detail live.
- **Do not reuse old vendor tabs:** One existing secure service link returned unavailable. Prepare a fresh link before demonstrating vendor response; do not assume a pre-reset link works.
- **Cost example needs reconciliation:** CPS-2026-0104’s Prices & costs screen showed $9,385 recorded work cost and a $11,575 confirmed linked invoice, while its caption says matched invoices supply vendor cost. The cause was not investigated for this script. Do not use that screen to claim automatic invoice-to-cost reconciliation until checked.
- **Invoice extraction is not proven by seeded records:** The $585 invoice has zero invoice items and a sample summary attachment. Rehearse an actual supported upload before using extraction as a live demonstration.
- Counts and source dates are sample data. Do not present them as Clark’s actual results or measured savings. The demo does not prove production email delivery or production readiness.

**One sentence to remember:** “You can see what needs attention, get someone on it, and find the full history when the next question comes up.”
