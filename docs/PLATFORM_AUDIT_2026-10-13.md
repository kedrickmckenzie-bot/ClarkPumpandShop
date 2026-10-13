# Platform audit — what would make TraceOps a slam dunk (October 13, 2026)

Requested by the user: audit features and usability (bugs secondary). Goals: easy to learn, easy to use every day, and everyone gets the information they need. This is a findings-and-plan document. **Nothing here is implemented yet**; items need the user's go-ahead. The checklist version with stable IDs is in [`PLATFORM_IMPROVEMENT_PASSES.md`](PLATFORM_IMPROVEMENT_PASSES.md) under "Slam-dunk audit".

## How it was tested

- Production build (`next build`, Render runtime) on a local PostgreSQL copy of the 15-store demo — the same path a real customer would use.
- All 7 preview roles (owner, facilities, regional, store manager, finance, technician, field manager). 78 app pages per role: about 600 page visits on desktop (1440 px) and phone (390 px), with screenshots and page text.
- Walked the main journeys end to end:
  - Store employee reports a problem by store QR (phone).
  - Manager turns it into a work order and sends it to a vendor.
  - Vendor accepts from the link (phone).
  - Vendor technician checks in and starts checkout at the store (phone).
  - In-house technician "My work" (phone).
  - Everyday searches.
- Read competitor material (MaintainX, UpKeep, Ecotrak, ServiceChannel and others) for what makes maintenance software easy to adopt. Sources are at the end.

**Speed and layout:** median page load about 0.9 s, slowest 1.9 s, locally. No page scrolls sideways on a phone.

## Verdict in one paragraph

The engine is strong:
- every number opens its records;
- vendors work without accounts;
- the technician phone flow is clean;
- the Review queue has a clear New / Stuck / Done shape;
- the reports are real.

What keeps it from being a slam dunk is the experience around that engine:
- **It talks like an auditor.** Disclaimers and jargon are everywhere.
- **It hides basic facts people need**, like phone numbers, contacts and equipment model/serial.
- **"What do I do next?" is spread over several places** with numbers that don't match.
- **It is missing the first-week pieces that make software easy to adopt:** a setup checklist, adding people, help, notifications and texts.

## What is already great (keep it)

- **Review queue:** New · Stuck · Done, one plain next action per row with one button.
- **Technician phone "My work":** Today / Coming up, big "Open job", "Change date", "Give back to team". The job page leads with the problem, then a clear "Next step".
- **No-login flows:** store QR report in 3 short steps with photos; vendor link with accept / propose date / ask / decline; store-QR check-in in 3 steps that lets a tech pick several jobs and handles "I don't see my work order".
- **Drill-through:** every total opens the exact records (Trends waterfall adds up exactly).
- **Dispatch board, reports and scheduling, warranty cases, PM program depth, repeat-problem detection.**

## Findings

### A. Easy to learn (the first day)

| ID | Finding | Evidence |
|---|---|---|
| A1 | **No getting-started checklist.** Setup is a 7-row settings table. Its statuses ("Auditable", "Organization-specific", "Ready to reuse") don't say what to do next. | `/app/admin` |
| A2 | **No way to add or invite people**, or set their role and stores. There are only role-level "Maintenance responsibilities". Required for real customers and self-serve; pairs with the Auth0 plan. | No invite/people screen exists |
| A3 | **No help anywhere:** no "?" tips, glossary, tour or short videos. Work alone has 8 menu items (Review, Dispatch, Work orders, Requests, Quotes, Service visits, Tasks, Compliance) with no hint of how they differ. | Sidebar |
| A4 | **"What needs me" lives in 4+ places with different numbers.** Overview shows "Needs your action 15 (15 in Review)" right above "27 to review → Review". The sidebar says "Review 27". Tasks and "Since you last looked" are separate again. | `/app/overview` |
| A5 | **Auditor wording and repeated disclaimers.** Across pages: "coverage" ×150, "evidence" ×104, "scope" ×85, "observed" ×51, "exception" ×43. Examples: "SERVICE CONTROL", "STORE ISSUE / PRESERVED SOURCE REPORT", "Confirm the known facts without inventing details", "approximate presence, not labor" on every visit row, "Numbers, not a grade", "This record or workspace is outside your current access scope". The email setup screen shows `EMAIL_PROVIDER, EMAIL_API_KEY, EMAIL_FROM` to customers. Store employees and vendors see raw receipt IDs like `receipt-request-6b73…`. | Many pages |
| A6 | **Titles are codes, not problems.** The manager work order page title is "CPS-2026-0116"; the request page title is "REQ-263DF98E". The technician's version leads with the problem, which is better. | WO and request pages |
| A7 | **Long absolute dates everywhere** ("Due Oct 13, 2026, 1:15 PM EDT"). People scan "Due today 1:15 PM", "2 days late", "Tomorrow". | Review, lists |
| A8 | **"No access" pages are dead ends** with jargon. They should say why, and offer the right next step. | Owner on Create work order |

### B. Easy to use (every day)

| ID | Finding | Evidence |
|---|---|---|
| B1 | **The work order list is hard to scan.** Every row repeats "Clark Pump and Shop - Pine Valley". Status chips wrap to 3 lines and vendor names to 5. There is no due/age or priority column and no sorting. The count says "25+ matching". | `/app/work-orders` |
| B2 | **On a work order, the "send to vendor" form is at the bottom**, under three other boxes. The top button "Track the vendor response" is vague. There is no "Call vendor". | WO Service tab |
| B3 | **No photos when creating a work order or reporting in the app.** Only the public store-QR report takes photos. | `/app/work-orders/new`, `/app/requests/new` |
| B4 | **No duplicate warning.** Store 104's beer cave had 4 open jobs at once (2 in-house, 2 vendor). Creating or reporting doesn't say "there's already an open job for this". | Store 104 |
| B5 | **No conversation per job and no notification center.** "Record update" logs calls, but there is no message thread between store, office and vendor, and no bell/inbox. With email not live, people must remember to check pages. | All |
| B6 | **Store employees can't follow their report.** After sending they get a receipt with a raw ID — no status link ("Received → Vendor coming Thu 2 PM → Fixed"). This drives calls to the office. | Public report receipt |
| B7 | **The vendor link has no phone or contact and no ETA.** The page says "Contact the facilities team through the original service message". Accept doesn't ask "When will you be there?". | Public service link |
| B8 | **The store manager phone home is crowded:** 6 stage tiles, cost charts, repeat problems. A store manager needs four things: report a problem, what needs me (confirm repairs), who's coming and when, and what's open at my store. | Store manager Overview (phone) |
| B9 | **Phone lists are very long:** work orders ~12 screens, service visits ~14, spending ~14. They need compact rows and "show more". | Phone crawl |
| B10 | **Preventive maintenance doesn't run itself.** Repeat is "every N days" (people think monthly/quarterly/yearly). There is no "who does it" (vendor or team) and no "create and send the work order X days before". Instructions are free text, with no checklist or readings. The PM page shows 7 missed occurrences with "No work order". No month calendar (requested earlier). | `/app/pm`, `/app/pm/new` |
| B11 | **Due times land at night.** A job created at 1:39 AM is due 1:39 AM the next day. Due times should snap to business hours. | New WO |
| B12 | **The owner can't create a work order or report a problem** (access denied). For small companies the owner *is* the operator. | Owner role |
| B13 | **Search misses everyday words.** "pump 4" finds nothing. "104 beer cave" lists a closed job whose number contains 104 instead of the Store 104 beer cave. There is no "top result". Questions like "how much did we spend on HVAC" return nothing. | `/app/search` |
| B14 | **Too many steps from report to vendor:** request page → create form (prefilled) → work order page → scroll to the send form → generate link. A known vendor should be "Create & send" in one step. | Journey |
| B15 | **The team responsibilities page repeats the same 8 long settings for 3 roles.** It should be a simple grid. | `/app/admin/maintenance-responsibilities` |

### C. Everyone gets the information they need

| ID | Finding | Evidence |
|---|---|---|
| C1 | **Store phone and manager are missing everywhere.** The data has the store phone (606-555-0104 for Store 104), but it isn't shown on the store page, work order, technician job or vendor link. There is no store manager name or phone, hours, or map link. | Store 104 |
| C2 | **Store access notes never reach the vendor.** The notes exist ("Ask the manager for the rear service door key…") and the vendor page can show them. But the vendor page reads a frozen copy of the store made when the work was sent, and that copy leaves them out. | Vendor link |
| C3 | **The equipment page hides the basics.** Make, model, serial, install date and age sit in a closed "Equipment details" at the bottom. There is no nameplate photo and no equipment QR sticker. The page doesn't say the obvious: "Same problem 5 times in 12 months: evaporator icing". It is 5 screens long, with a leftover second tab set at the bottom. | `asset-101-beer-cave` |
| C4 | **The vendor page lacks people and prices:** no named contacts, after-hours number, rates (hourly, trip charge, emergency) or agreement. Lots of hedging text instead. | Vendor detail |
| C5 | **The technician job page lacks the unit:** no map/navigate link and no equipment card (model, serial, manual, this unit's history). It shows "recent work at this store" instead. | `/app/my-work/[id]` |
| C6 | **No budget.** Owners ask "are we on budget?" first. There is no optional budget per store or area with pacing. | Owner |
| C7 | **The "Savings" page hides the value.** "Confirmed financial benefits: No recorded amount", with paragraphs of qualifiers. Owners can't see what the platform caught for them. | `/app/reports/value` |
| C8 | **Columns that are always empty:** invoices show "Approved amount: Not recorded" and "Recorded paid: Not recorded" on every row. Hide a column when nothing is known. | `/app/invoices` |

### D. Owner and leadership "wow"

| ID | Finding |
|---|---|
| D1 | Leadership scorecard (agreed in the trends review): planned vs repair %, vendor vs in-house, fixed on first visit, time to fix, repeat problems, PM on time, cost per store. Each as a 12-month line vs last year, clickable. |
| D2 | **Ask TraceOps (AI):** plain-language questions about their own data, answered with links to the records. Example: "Which stores had the most refrigeration calls this year?". UpKeep markets the same idea. It builds on the AI already in the product. |
| D3 | Monthly owner email ("your maintenance month in 60 seconds"). The scheduled report already exists and needs email. |
| D4 | Budget pacing (C6) and "money caught" (C7). |
| D5 | Trends fixes already agreed: same months last year by default, contract-services switch, plain wording, "more jobs vs pricier jobs" sentence. |

### E. Competitive must-haves (to win deals)

| ID | Finding |
|---|---|
| E1 | Email **and text messages** to vendors and stores; c-store vendors live on text. |
| E2 | Real sign-in plus a people page (Auth0 + A2). |
| E3 | **After-hours emergency path.** Stores are open 24/7: who is called or texted at 2 AM, and how it escalates. |
| E4 | **Spanish** on the public pages (store report, vendor link, check-in) first, then the app. |
| E5 | **Equipment QR stickers:** scan to see the unit's history, troubleshoot, or report a problem for that unit (MaintainX/UpKeep do this). |
| E6 | **Refrigerant log for refrigeration equipment.** Industry coverage says EPA's newer HFC rules under the AIM Act lower the leak-repair trigger to systems with 15+ lbs of refrigerant, starting 2026. C-store competitors (Ecotrak, Fexa) sell AIM Act tracking. Verify the rule text before building. |
| E7 | **Pricing heads-up:** Ecotrak's pricing page shows a "Build" self-serve plan at $25 per location per month, with a 30-day trial and up to 10 locations. A 2025 press release said $25 per year, so confirm. Plan the $50–75 single-store offer to win on AI troubleshooting, in-house tech support and owner insight, or have a cheaper basic tier. |
| E8 | Later: cooler temperature sensors (UpKeep markets them). Partner rather than build. |

### F. Bugs found while auditing

| ID | Bug |
|---|---|
| F1 | `/app/my-work/next`, `/app/my-work/check-in` and `/app/my-work/[id]` crash ("This page didn't load", React #441) for owner, facilities, regional and store manager, instead of a friendly message. |
| F2 | Public report photo upload: "1 file was received, but attachment storage needs operator review". Uploads aren't stored without private file storage configured. Production needs S3-compatible storage (P6-03), and the message to the employee should be plain. |
| F3 | Vendor link: right after "Accept work", the "Your next step" box still says "accept, suggest a visit time…" until reload. |
| F4 | Accountability package: Overview links to Review and Dispatch, which that package hides. |
| F5 | Overview numbers disagree: "Needs your action 15" vs "27 to review" (see A4). |
| F6 | Store phone not passed to the vendor link (C1), and access notes left out of the frozen store copy (C2). |
| F7 | Due times at night (B11). |
| F8 | Request references are inconsistent: "REQ-263DF98E" (new) vs "REQ-26-104D" (seeded). |
| F9 | The equipment page ends with a leftover "Overview / Preventive maintenance" tab set and a "Review this record" section that repeats the page. |
| F10 | Technician compliance page logs a 403 for one background request. |

## Slam-dunk plan (recommended order)

Sizes: **S** = one working session, **M** = 2–3 sessions, **L** = 4+ sessions or needs an outside account (email/SMS provider, Auth0).

| Order | ID | What | Why it matters | Size |
|---|---|---|---|---|
| 1 | SD-01 | **Plain words and one to-do number.** One "To do" with the same count everywhere. Problems as page titles. Relative dates. Remove repeated disclaimers and raw IDs. Friendly "no access" pages. | Biggest learnability win; visible in every demo. Fixes A4–A8, F5, F8. | M |
| 2 | SD-02 | **Contacts everywhere.** Store card (phone, manager, hours, map, access notes) on store, work order, tech job and vendor link. Vendor contacts and rates. Tap to call or navigate. ETA on accept. | Ends phone tag; a vendor or tech can act without calling. Fixes C1, C2, C4, C5, B7, F6. | S–M |
| 3 | SD-03 | **Faster daily flows.** Send form at the top. "Create & send" in one step. Photos on create and report. Duplicate warning. Compact work list with priority, due and sorting. Business-hours due times. | Fewer clicks for the person using it all day. Fixes B1–B4, B11, B14. | M |
| 4 | SD-04 | **Getting-started checklist and People page.** Add stores, vendors and people (invite, role, stores). Print QR posters. Optional equipment and PM. Progress shown. | Needed for Clark go-live and the self-serve plan. Fixes A1, A2, B15. | M (+Auth0 L) |
| 5 | SD-05 | **Store manager and employee on the phone.** Four-part home. Report-tracking link for the employee ("Received → Scheduled → Fixed"). | Stores stop calling the office. Fixes B6, B8, B9. | M |
| 6 | SD-06 | **Owner pack.** Leadership scorecard, trends fixes, budget pacing (optional), "money caught" page. | The star of the show for owners. D1, D4, D5, C6–C8. | M–L |
| 7 | SD-07 | **PM that runs itself.** Monthly/quarterly picker, who does it, automatic work order and send ahead of the due date, short checklist with readings, month calendar view. | Fewer missed PMs; less manual work. Fixes B10. | M–L |
| 8 | SD-08 | **Notifications.** In-app bell, email when configured, texts for emergencies, daily digest, after-hours path. | People get told instead of having to look. Fixes B5, E1, E3. | L |
| 9 | SD-09 | **Equipment at a glance.** Specs at the top, "same problem N times" callout, repair-or-replace summary, nameplate photo, QR stickers. | Answers "what is this unit and what's wrong with it" in 5 seconds. Fixes C3, E5. | M |
| 10 | SD-10 | **Ask TraceOps and better search.** Better ranking and a "top result". Plain-language questions answered with linked records. | Owners and managers find anything without learning menus. Fixes B13, D2. | M |
| 11 | SD-11 | **Help built in.** One-line menu descriptions, "?" tips on key screens, a short glossary, empty states that teach. | New users learn by doing. Fixes A3. | S–M |
| 12 | SD-12 | **Owner can report and create** (setting), Spanish public pages, refrigerant log. | Small-company fit and c-store differentiators. Fixes B12, E4, E6. | M–L |
| — | SB | Quick bug fixes F1–F10. | Small, independent; can ride with any batch above. | S |

## Research notes and sources

- MaintainX request portal: a public web page where anyone can submit requests without an account, shareable by link or printable QR code. Reviewers praise QR requests and ease of use. [help.getmaintainx.com](https://help.getmaintainx.com/set-up-a-request-portal)
- UpKeep's convenience & fuel page: staff scan equipment to report with no paid seat. It also markets cooler and fuel sensors, compliance rounds with photos and readings, and the "Nova" AI assistant that answers plain-language questions about site data. [upkeep.com](https://upkeep.com/solutions/convenience-fuel/)
- Ecotrak's c-store roundup (vendor-authored) ranks after-hours dispatch, equipment breadth, vendor network, compliance (AIM Act refrigerant), multi-location visibility, PM and AI cost-anomaly detection. [ecotrak.com](https://www.ecotrak.com/resources/blog/best-facilities-management-software-for-convenience-stores-in-2026)
- Ecotrak pricing page (Build plan, $25 per location per month, 30-day trial, up to 10 locations). [ecotrak.com/pricing](https://www.ecotrak.com/pricing). A 2025 press release said $25 per year per location. [webull.com](https://www.webull.com/news/12841729522467840)
- Why maintenance software adoption fails: too many screens, slow or clunky mobile, too many required fields, built for the office. Vendor blogs, directional only. [coastapp.com](https://coastapp.com/blog/cmms-implementations-fail/), [llumin.com](https://llumin.com/blog/why-tech-first-cmms-fails-how-to-fix-it/)
- AIM Act refrigerant management: 15 lb leak-repair threshold for HFC systems, enforcement from January 1, 2026, per industry coverage. Confirm against 40 CFR Part 84. [achrnews.com](https://www.achrnews.com/articles/165547-aim-act-compliance-for-grocery-refrigeration), [Rheem summary (PDF)](https://media.rheem.com/blobazrheem/wp-content/uploads/sites/36/2024/10/Alert-AIM-Refrigerant-Management-Final-Rule_9-27-2024.pdf)
- KPI targets (planned ≈70%+, first-trip fix 85%+) are vendor rules of thumb, not standards. [vixxo.com](https://www.vixxo.com/facilities-management-news/the-next-level-in-c-stores)
