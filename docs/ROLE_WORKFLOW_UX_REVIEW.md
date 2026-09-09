# Role workflow UX review

**Reviewed baseline:** `9704757`
**Purpose:** working guide for the coordinated role, record, accountability, visit, held-work, and financial-evidence pass.

| Role | Start and main jobs | Owns | Receives / creates | Highest-impact friction addressed |
|---|---|---|---|---|
| Store manager | Store overview; report a symptom, review employee reports, confirm observable results | Store reports, observable confirmation, requested store information | Sends reports to facilities; receives status and confirmation requests | Separate “needs your action” from work being handled; show related open work before creating duplicates |
| Facilities coordinator | Action center; triage, route, schedule, verify, escalate, and manage held work | Provider decisions, internal ownership, operational follow-up | Receives store reports/vendor responses; creates assignments, authorizations, tasks, visits, and escalations | Queue reason and clearing action were inconsistent; stable internal ownership was only a label |
| Maintenance director | Overview/action center; workload, aging, repeat work, PM, vendor follow-through, capital review | Reassignment, escalation, portfolio intervention | Receives escalated obligations; delegates auditable internal ownership | Portfolio-to-record drill-through and reassignment needed a durable owner identity |
| Regional manager | Scoped overview and stores; compare locations and intervene where authorized | Delegated scoped decisions and follow-up | Receives scoped escalations; creates regional follow-up | Visibility and mutation authority need distinct copy and controls |
| Owner / executive | Overview and spend/planning; understand business consequence and material decisions | Leadership and capital decisions | Receives significant escalations; creates leadership decisions | Routine operations could compete with consequential claims; money bases need explicit separation |
| Finance | Invoice review; match, allocate, review exceptions and adjustments | Financial review decisions only | Receives invoice evidence; creates review decisions/adjustments | Shared invoice adjustments and other-job line exceptions could be falsely attributed to each work order |
| Vendor / technician | Secure authorization or store-device visit; respond, check in, record per-job outcomes, check out | Vendor response and observed service facts | Receives authorized scope; creates visit/outcome evidence and follow-up triggers | Mobile path must stay brief; one visit must preserve independent outcomes and no-WO exception handling |

## Shared interaction and workflow rules

1. The first viewport states the problem, business impact/current observation, internal owner, next actor/action/deadline, and any concurrent blocker. Only the role-appropriate next action is visually primary.
2. Service progress, operating condition, internal accountability, next actor, and financial review remain separate facts. History never becomes current merely because it is the latest completed fact of its type.
3. The current visit cycle is selected from every linked visit/work record, including one that has not recorded an outcome. Verification applies only to the exact immutable outcome it reviewed.
4. Internal ownership is a persisted membership or supported team identity. Reassignment is audited and never changes a vendor-owned next action.
5. Invoice line allocation is the only work-order attribution basis. An exception on another allocated line is disclosed as shared invoice context, not attributed to this job. Invoice-level adjustments remain explicitly shared unless a supported allocation exists.
6. Lists answer a queue question; details explain and act; overview surfaces consequences and exceptions. Portfolio metrics state whether they cover the full scoped population or the filtered result set and link to supporting records.
7. Held work preserves each job’s authorization, owner, deadline, outcome, follow-up, and financial history. “Approve to wait,” “add to a suitable visit,” and “dispatch now” remain distinct.
8. Meaningful actions return a clear confirmation and preserve a useful route back to the prior list/filter context.

## Remaining demo boundaries

The role picker is a preview of fictional data, not production authentication. Delivery is represented by an outbox and does not imply real email/SMS delivery. Invoice review does not approve or execute payment. The 15-store presentation demonstrates workflows; the separate scale fixture demonstrates approximately 65-store behavior.
