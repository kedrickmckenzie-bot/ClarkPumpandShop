# Compliance schedules

Compliance contains customer-defined inspections and renewals. Each schedule identifies a store, optional equipment, requirement source, owner or approved vendor, recurrence, evidence requirement and escalation lead time. These are company-entered requirements, not a legal requirement catalogue.

## Operator flow

1. Create a schedule. One-time, daily intervals and monthly intervals cover common frequencies; annual means every 12 months.
2. The schedule worker prepares occurrences through 90 days and creates normal work orders when the reminder window starts. Outside work uses the existing service authorization and approval rules.
3. Record performed, a finding, or a reviewed pass. Performing an inspection does not close it. Required paperwork must be attached before a maintenance reviewer closes it.
4. Findings can create linked corrective work. That work must be resolved before inspection closure. Reviewers retain the inspection report, repair evidence and closing notes together.

Records retain result history, attribution, private files, work links and delivery status. Corrections use version checks. Pausing stops future preparation and delivery without deleting existing work.

## Dashboard

Due in 30/60/90 days, overdue, scheduled, awaiting review, missing paperwork, open findings and documents expiring within 30 days all open their supporting inspections. Windows overlap. Counts use the viewer's organization and store scope. A reviewed pass is an operator decision, not an independent certification of legal compliance.

## Delivery and persistence

The existing `jobs:postgres` worker runs scheduling before processing the outbox. Configure and schedule that worker and its existing email provider for real delivery. The local Schedule controls action prepares work and queues messages only. Vendor authorization emails contain the issued work scope and work-order reference. Both internal and vendor assignees receive a secure inspection link. Reminder delivery rechecks current state and suppresses closed or paused items. Escalations notify scoped facilities users and identify the schedule's escalation owner.

SQLite/D1 and PostgreSQL migrations persist schedules and occurrences. Evidence uses the existing private storage adapter. Local memory and upload state reset with the development process. Five fictional schedules illustrate the feature without adding stores or vendors.


## Instructions and blank forms

Schedule creation accepts up to five PDF, JPG, PNG, WebP or text files, 8 MB total. Each generated inspection stores its own immutable file metadata snapshot, pointing to private object storage. Its work order and inspection page offer downloads. Vendor authorization emails attach those saved forms; an existing valid service-authorization link can download only the master files for its work order. Completed inspection evidence is not exposed through that endpoint.

The Master forms section replaces the schedule's set for newly generated inspection dates, with an audit record. Already-generated dates keep their original files, including dates prepared within the 90-day window. This makes the version used for an inspection stable. To change instructions on existing work, use the normal work-order amendment process; replacing master forms does not silently alter issued work.

Blank forms never count toward evidence or the required-paperwork closure gate. Completed reports and photos upload together under Completed paperwork & photos; JPG, PNG and WebP are supported. Uploading evidence leaves a performed inspection awaiting reviewer approval. This MVP uses downloaded/printed forms and uploaded results; no form designer or electronic checklist builder is included.

## Assignment and inspection links

Choose a store, then search Assigned to for an active employee account or an approved vendor covering that store. Internal inspection work is assigned to that person, including store managers; ordinary maintenance routing retains its existing technician rules.

When work is prepared, the email contains the work-order number and a secure inspection link. The assignee can download instructions, record completion or findings, and upload completed paperwork and photos without signing in. The app and link update the same inspection and retain earlier uploads. Results remain awaiting maintenance review; the link cannot approve or close an inspection.

Links last 30 days. Reminder delivery creates a fresh link to the same inspection. A reviewer can also use Open assignee link on the inspection page. Tokens are opaque and hashed at rest; access is limited to the named inspection's instructions and submitted evidence. Paused schedules, inactive/out-of-scope assignees, changed assignments, revoked tokens and expired links cannot submit. No unrelated work-order files are exposed. Uploads use the same private storage adapter and limits in both channels.

The assignee continues receiving reminders when escalation also notifies facilities. Actual outbound email still requires the configured delivery provider and worker; preview actions only queue messages.
