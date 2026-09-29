# TraceOps — Complete Feature Inventory

**Purpose:** a full list of what the platform does today, written so another AI (or a person) can turn it into a one-page sales sheet. Nothing has been cut. Decide later what to include.

**As of:** September 29, 2026 — code version `ae5c876` on branch `codex/platform-rebuild`.

**Product in one sentence:** TraceOps is maintenance management built for convenience-store and fuel chains. It takes a problem from "the store reported it" to "the vendor fixed it and we know what it cost," with every number traceable back to the exact records behind it.

**Core chain the product follows:**
Store problem or scheduled maintenance → work order → in-house team or outside vendor → vendor accepts → technician checks in and out → result and follow-up → cost and invoice → dashboards, reports and equipment history.

---

## How to read the ratings

Each feature gets **one score out of 10**, combining two things:
1. **How well it works today.** Tested, polished, no rough edges.
2. **How much a c-store buyer will care.** Does it solve a real pain?

| Score | Meaning |
|---|---|
| 9–10 | Standout. Lead the pitch with it. |
| 7–8 | Strong. Include it as supporting value. |
| 5–6 | Works, but either niche or needs polish. |
| 1–4 | Early, untested, or low buyer interest. |

**Tested?** column:
- ✅ means I clicked through it in a browser myself.
- 🔎 means I looked at the screen or code but didn't run the full workflow.
- ⚪ means not tested by me, so the rating is less certain.

---

## Top 12 at a glance (the sales-sheet headliners)

| # | Feature | Score |
|---|---|---|
| 1 | Vendor check-in / check-out by QR code or link (no app, no account) | 10 |
| 2 | Every number opens its source records (drill-down) | 9 |
| 3 | Camera-check tasks (verify vendor time against security cameras) | 9 |
| 4 | Vendors pay no fees and need no login | 9 |
| 5 | Invoice checks against the work order and visit | 9 |
| 6 | Maintenance Overview dashboard | 9 |
| 7 | One-click secure vendor link (accept, propose date, ask, decline) | 9 |
| 8 | Store employee problem reporting by phone (QR) | 9 |
| 9 | Store tasks with shared lists, claiming and automatic routing | 9 |
| 10 | Every open job shows owner, next step, due time, escalation | 8 |
| 11 | Equipment history with repair-or-replace planning | 8 |
| 12 | Preventive maintenance with completion % | 8 |

---

## 1. Dashboards and visibility

| Feature | What it does | Who uses it | Tested | Score |
|---|---|---|---|---|
| **Maintenance Overview** | One home screen: items to review, upcoming vendor visits, visits without checkout, 12-month repair cost, specific store problems (for example "Store 104 · beer cave door not sealing"), and the review queue. Every box is clickable. | Facilities manager | ✅ | 9 |
| **Owner brief** | A company-at-a-glance page for owners: decisions waiting, overdue work, reported problems, spending. | Owner / leadership | ✅ | 8 |
| **Regional and store manager home pages** | Each role gets its own home page, limited to its region or store. | Regional manager, store manager | ✅ | 8 |
| **Drill-down on every number** | Every total, chart segment and count opens the exact work orders, visits, costs or invoices behind it. The time period and store scope carry through. | All managers | ✅ | 9 |
| **Maintenance spending view** | Spending by store, region, service area (HVAC, refrigeration, fuel and so on) and period (3, 6 or 12 months, year to date). Switch between "recorded work cost" and "linked invoice amount." | Facilities, finance, owners | ✅ | 8 |
| **Spending trends and comparisons** | What changed and why: cost this period versus last, change by store, comparisons against similar equipment at other stores, vendor response speed. | Facilities, owners | 🔎 | 7 |
| **Company-wide search** | One search box finds stores (by number, name, address or old names), work orders, vendors, equipment and visits, limited to what you're allowed to see. | Everyone | ✅ | 8 |
| **Record checks** | Automatic checks for problems in the records, such as open work with no next step. | Facilities admin | 🔎 | 6 |
| **Honest labels on money** | Costs are always labeled: recorded work cost, approved amount, linked invoice amount, unmatched amount. Nothing is silently combined. | Finance, owners | ✅ | 7 |

## 2. Work orders (the core record)

| Feature | What it does | Who uses it | Tested | Score |
|---|---|---|---|---|
| **Fast work order creation** | Only a store and a problem are required. Priority defaults to Routine. Equipment and category can be added later. | Facilities, regional | ✅ | 9 |
| **Routing choices** | Internal maintenance, outside vendor, "choose later," or "save for a later visit." | Facilities | ✅ | 8 |
| **Plain-language vendor search** | Type "walk-in," "beer cave," "card reader," "pothole" or "slushie," and the right vendor appears. Search covers specialties, equipment types, store coverage and preferred vendors. Some everyday words still miss ("toilet," "lights out"). | Facilities | ✅ | 7 |
| **Accountable state on every job** | Every open job shows its current stage, who acts next, the due time, and who hears about it if it's late. | Everyone | ✅ | 8 |
| **Separate reference numbers** | Your work order number, the vendor's ticket number, the vendor's invoice number and an optional accounting PO are kept as separate fields. | Facilities, finance | 🔎 | 6 |
| **Spending limit (NTE) and approval rules** | Optional "not to exceed" amount. Approval is required only when a price is involved, following company rules (by store, work type and amount). | Facilities, approvers | 🔎 | 7 |
| **Store report → work order** | Turn a store employee's report into a work order in one step. Keeps the report's priority (for example Urgent) and links both ways. | Facilities | ✅ | 8 |
| **Follow-ups** | Unresolved outcomes (waiting on parts, return visit needed) create the required follow-up automatically, with an owner and a due date. | Facilities | ✅ | 8 |
| **Store confirms the repair** | The store answers "fixed / not fixed / not sure" after the vendor finishes. | Store manager | 🔎 | 7 |
| **Work order history and audit trail** | Every change, response, visit and cost is recorded with who and when. Nothing is silently overwritten. | Everyone | ✅ | 7 |
| **Saved views and bulk follow-up** | Save filtered lists; send follow-ups on several jobs at once. | Facilities | ⚪ | 5 |

## 3. Vendors (no app, no fees)

| Feature | What it does | Who uses it | Tested | Score |
|---|---|---|---|---|
| **Secure vendor link** | Each job produces a private link. The vendor can accept, propose a date, ask a question or decline, with no account or app. | Vendors | ✅ | 9 |
| **Copy link, print or email** | The manager gets a receipt with a big "Copy link" button. Print/PDF handoff is also available. Email sends once an email provider is set up. | Facilities | ✅ | 8 |
| **No vendor fees** | Vendors never pay per invoice or per job. (For comparison, ServiceChannel reportedly charges vendors 1.5% per invoice.) | Sales point | — | 9 |
| **Vendor directory and coverage** | Approved vendors with specialties, contacts, which stores they cover, and optional preferred vendors per store. | Facilities | ✅ | 7 |
| **Vendor documents** | Track vendor paperwork (such as insurance certificates) and whether it's current. | Facilities | 🔎 | 6 |
| **Vendor accountability numbers** | Response speed, jobs with a recorded visit (for example 97%), open follow-ups. Clearly labeled "not a vendor grade." | Facilities, owners | ✅ | 7 |
| **Quote requests** | Ask one or more vendors for pricing without creating duplicate work orders. Vendors reply through a secure link. | Facilities | 🔎 | 7 |
| **Unlisted company arrival** | A technician from a company not on file can still check in. That creates a restricted company record for a manager to review and approve. | Technicians, facilities | ⚪ | 6 |

## 4. Technician visits (proof of who was there, and when)

| Feature | What it does | Who uses it | Tested | Score |
|---|---|---|---|---|
| **QR / link check-in and check-out** | The tech scans the store's QR code or opens the job link. They pick their company, then their job, enter their name and crew size, and check in. Times are set by the server, not the phone. | Technicians | ✅ | 10 |
| **Check out from any phone** | The visit can be finished from a different phone using the original job link. | Technicians | ✅ | 9 |
| **Company-first job list** | "Who are you with?" first, then only that company's jobs at the store. | Technicians | ✅ | 8 |
| **Optional location check** | Location is captured only at check-in and check-out, never continuously. The app records the distance from the store and whether it was verified, skipped or denied. | Technicians, facilities | ✅ | 8 |
| **"No work order" visits** | A tech without a work order can still check in with a reason. It becomes a visit for a manager to review, so service is never blocked. | Technicians, facilities | ✅ | 8 |
| **Outcome at checkout** | Completed, waiting on parts, return visit needed, quote needed, couldn't find the issue, couldn't complete. Notes and photos, plus an optional parts ETA. | Technicians | ✅ | 8 |
| **Extra approved work at the same visit** | After check-in, the tech is offered other already-approved jobs at that store. They can add them to the same visit. | Technicians | 🔎 | 7 |
| **Honest time records** | Time onsite is approximate presence, not certified labor. A verified time is never backdated. | Everyone | ✅ | 7 |

## 5. Store QR codes and store employees

| Feature | What it does | Who uses it | Tested | Score |
|---|---|---|---|---|
| **Printable QR code per store** | Create, download or print a store QR code. It prints as one clean page with instructions. Codes are secure and expire after one year. | Facilities | ✅ | 8 |
| **Store employee problem reporting** | Scan the QR code, choose "Report a problem," and complete 3 steps (name, what's wrong plus urgency and photos, review). The manager sees it immediately. | Store staff | ✅ | 9 |
| **Store impact questions** | Optional: is the store operating, any safety concern, is product at risk, are customers affected? | Store staff, managers | ✅ | 7 |

## 6. Store tasks (internal requests, including camera checks)

| Feature | What it does | Who uses it | Tested | Score |
|---|---|---|---|---|
| **New task by store** | Pick a store, then the person or group responsible there (with roles shown). Types: camera review, equipment check or general. | All managers | ✅ | 9 |
| **Camera-check workflow** | The requester sets time windows as "time shown on camera." The store manager records what the camera showed and a finding (matches, doesn't match, partly, no footage). The requester sees **requested vs. observed times side by side**. Visits prefill their times in store-local time with a 15-minute buffer. | Facilities, store managers | ✅ | 9 |
| **Shared lists and claiming** | "Anyone responsible for this store" or "Someone at the store." One click on "I'll take it." Two people can't claim the same task (tested). | All managers | ✅ | 9 |
| **Replies on the task** | Short back-and-forth kept with the task. A "New reply" marker appears for the other person. | All managers | ✅ | 8 |
| **Automatic routing of results** | Done / Needs attention / Couldn't complete. Problems always return to the requester. Successes return only if "Let me know" was checked. The requester can close it or send it back. | All managers | ✅ | 9 |
| **Overdue alerts to a named fallback** | Overdue tasks go to a named backup person without taking the task away from whoever claimed it. | All managers | ✅ | 8 |
| **Task lists** | My tasks · Shared tasks · Waiting on others · History. Tasks also appear on the store page and on linked records. | All managers | ✅ | 8 |
| **Privacy** | Only the people involved and their supervising managers can see a task (tested). | — | ✅ | 7 |

## 7. Invoices and costs

| Feature | What it does | Who uses it | Tested | Score |
|---|---|---|---|---|
| **Invoice checks (flags)** | Flags duplicate invoices, amounts over the approved limit, charges above agreed vendor rates, a vendor who didn't do the assigned work, open warranty claims, and invoices with no work order. | Finance, facilities | 🔎 | 9 |
| **Invoice upload with automatic reading** | Drag and drop invoice PDFs or photos. An AI reader pulls out the details and matches the work order, vendor and store. Clean matches are recorded; only exceptions need review. The AI reader must be connected first. Without it, files are saved for manual entry. | Finance | ✅ (upload) / ⚪ (AI reading) | 7 |
| **Manual invoice entry** | Enter an invoice by hand, starting from a work order search. | Finance | 🔎 | 6 |
| **Invoices from accounting** | Import invoices from an accounting system and link them to the work they cover. | Finance | ⚪ | 5 |
| **Simple cost entry** | Enter a total (internal or vendor), with an optional line-item breakdown. The assigned vendor fills in automatically. | Facilities | 🔎 | 7 |
| **No double counting** | An invoice that replaces an earlier cost entry adds a correcting record. It never erases the original. | Finance | 🔎 | 7 |
| **Never pays anyone** | TraceOps records and checks. It never approves or sends payment. | Sales point | — | 5 |
| **Savings and risk tracking** | Separates confirmed savings, possible recoveries (flagged amounts, counted once) and planning estimates. | Owners, finance | ✅ | 7 |

## 8. Equipment, warranties and replacement planning

| Feature | What it does | Who uses it | Tested | Score |
|---|---|---|---|---|
| **Equipment records** | Every piece of equipment: tag, model, serial, installed date, expected life, supplier, and full repair history, down to parts (compressor, fan motor and so on). | Facilities | ✅ | 8 |
| **Quick store equipment setup** | Pick equipment types and quantities (beer cave, walk-in freezer, dispensers). Standard parts are created automatically. | Facilities | 🔎 | 7 |
| **Most frequent equipment issues** | Ranks the equipment with the most repairs, with cost. Every row opens its history. | Facilities, owners | ✅ | 8 |
| **Warranty tracking** | Warranty terms per equipment and part. Warranty is checked on every repair. Vendor warranty rules are set once. Warranty claims have a clear next step. | Facilities | 🔎 | 8 |
| **Repair-or-replace planning** | Transparent rules (age, expected life, repeat repairs, cost) suggest a human review, never an automatic replacement. Shows the repair estimate beside the replacement cost. | Facilities, owners | ✅ | 8 |
| **Replacement budget planning** | Plan replacements by month and year, with annual targets and saved planning costs. | Owners, finance | 🔎 | 7 |

## 9. Preventive maintenance (PM) and compliance

| Feature | What it does | Who uses it | Tested | Score |
|---|---|---|---|---|
| **Scheduled maintenance plans** | Create one-store plans or company-wide schedules (for example "fall HVAC check at all 15 stores"). New equipment joins automatically. | Facilities | ✅ | 8 |
| **PM completion %** | Shows, for example, "93% completed, 92 of 99 ended windows," and opens the exact records. Missed items have a "Create work order" button. | Facilities, owners | ✅ | 8 |
| **Inspections and compliance** | Schedules for inspections and renewals (fire extinguishers, food safety, fuel permits): due soon, overdue, missing paperwork, open findings. Readable dates. | Facilities | ✅ | 7 |
| **Secure inspection links** | Send an employee or vendor a link to download blank forms and upload the completed paperwork and photos. | Facilities | 🔎 | 7 |

## 10. Planning and efficiency

| Feature | What it does | Who uses it | Tested | Score |
|---|---|---|---|---|
| **Save small jobs for one visit** | Hold small approved jobs at a store until a suitable vendor visit, instead of paying separate trip charges. | Facilities | 🔎 | 7 |
| **Send approved jobs together** | Offer several approved jobs at one store to the same vendor. The vendor picks the date. Each job keeps its own number, result and cost. | Facilities | 🔎 | 7 |
| **Grouped work planner** | Suggests grouping work into fewer vendor visits, with estimated savings. | Facilities | 🔎 | 6 |
| **Email inbox** | Forward maintenance emails in and attach them to the right work. Needs a mailbox connection. | Facilities | ⚪ | 5 |

## 11. Reports and exports

| Feature | What it does | Who uses it | Tested | Score |
|---|---|---|---|---|
| **7 live reports** | Vendor visit accountability, open maintenance work, spending by store, recorded spending, PM completion, repair-or-replace, invoice checks. | Managers, owners | ✅ | 8 |
| **Spreadsheet (CSV) export** | Every report downloads as a spreadsheet that includes its definition and scope, limited to what the user may see (tested). | Managers, finance | ✅ | 7 |

## 12. Setup, roles and security

| Feature | What it does | Who uses it | Tested | Score |
|---|---|---|---|---|
| **Add a store** | Number, name, address, region, time zone, old names for search. Takes about 3 seconds, then goes straight to equipment setup. | Admin | ✅ | 8 |
| **Bulk import (CSV)** | Import stores, vendors, equipment quantities and open work orders from a template, with row-by-row checking. Up to 100 rows per file. | Admin | 🔎 | 7 |
| **Roles with automatic limits** | Facilities, owner, regional manager, store manager, invoice reviewer. Each sees only its stores and region. Blocked from other stores even through direct links and downloads (tested). | Everyone | ✅ | 8 |
| **Company separation** | Every record belongs to one company. Automatic tests confirm one company can't reach another's data. | — | 🔎 | 7 |
| **Delegated responsibilities** | Let store managers create or send routine work within their stores and approval limits. | Admin | 🔎 | 6 |
| **Service areas and equipment groups** | Organize spending the same way at every store (Refrigeration › Walk-in › Beer caves). | Admin | 🔎 | 6 |
| **Approval policies** | Who approves spending, by location, work type and amount. Each decision keeps the rule that was used and who decided. | Admin | 🔎 | 6 |
| **Email notifications** | Choose which events send email, and to whom. Needs an email provider. | Admin | 🔎 | 5 |
| **Private files and photos** | Uploaded photos and documents are private and open only for people with access to the record. | — | 🔎 | 7 |
| **Works on phones** | Every page checked at phone width with nothing running off the screen. | Everyone | ✅ | 8 |
| **Brand can change** | "TraceOps" is a working name. Name, logo and colors come from one setting. | — | 🔎 | 4 |

---

## Not built yet (don't put these on a sales sheet)

- **Real logins.** Planned with Auth0. The demo uses a role picker.
- **Temperature and water-leak sensors.** Researched, not built.
- **Automatic invoice reading.** Built, but needs an AI provider key to switch on.
- **Email delivery.** Needs an email provider to be connected.
- **Native phone apps.** Everything is mobile web, which works well on phones.
- **Connections to accounting systems** beyond the demo import.
- **Built-in vendor marketplace.** Not planned. Customers bring their own vendors.

## Things TraceOps deliberately does NOT do

These are good for setting expectations:
- It doesn't pay vendors or run accounting.
- It doesn't track technicians continuously. Location is checked only at check-in and check-out.
- It never replaces equipment or accuses a vendor automatically. It shows the facts, and people decide.

---

## Suggested sales-sheet angle (for the AI writing it)

- **Headline idea:** "See every HVAC and refrigeration visit: who came, when they arrived, when they left, what they billed. Then check it against your cameras."
- **Lead with:** QR check-in, the vendor link with no fees, camera-check tasks and invoice checks. That's the overbilling story.
- **Support with:** the Overview dashboard with drill-down, store employee reporting, equipment history and repair-or-replace, and PM completion.
- **Close with:** works on any phone, no app for vendors, up and running without months of setup.
