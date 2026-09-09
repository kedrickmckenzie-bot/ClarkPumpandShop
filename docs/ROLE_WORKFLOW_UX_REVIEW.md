# Role workflow UX review

**Reviewed baseline:** `b8651a8`
**Purpose:** working guide for the coordinated role, record, accountability, visit, held-work, and financial-evidence pass.

| Role | Start and main jobs | Owns | Receives / creates | Highest-impact friction addressed |
|---|---|---|---|---|
| Store manager | Store overview; **Report a problem**, **Needs your response**, **Being handled**, and **Upcoming visits** | Store reports, observable confirmation, requested store information | Sends reports to facilities; receives only assigned decisions/confirmation requests | Store 104 scope and status paths are prominent; facilities-only held/dispatch/bulk-task controls are suppressed unless the limited client capability is enabled |
| Facilities coordinator | Action Center lanes; triage, route, quote, schedule, verify, escalate, and manage held work | Provider decisions, internal ownership, operational follow-up | Receives store reports/vendor questions/responses; creates assignments, authorizations, tasks, visits, and escalations | One complete projection states the reason, clearing action, owner, due time, source count, and lane without a 200-record cap |
| Maintenance director | Overview/action center; workload, aging, repeat work, PM, vendor follow-through, capital review | Reassignment, escalation, portfolio intervention | Receives escalated obligations; delegates auditable internal ownership | Portfolio-to-record drill-through and reassignment needed a durable owner identity |
| Regional manager | Scoped overview and stores; compare locations and intervene where authorized | Delegated scoped decisions and follow-up | Receives scoped escalations; creates regional follow-up | Visibility and mutation authority need distinct copy and controls |
| Owner / executive | Overview and spend/planning; understand business consequence and material decisions | Leadership and capital decisions | Receives significant escalations; creates leadership decisions | Routine operations could compete with consequential claims; money bases need explicit separation |
| Finance | Invoice review; match, allocate, review exceptions and adjustments | Financial review decisions only | Receives invoice evidence; creates review decisions/adjustments | Shared invoice adjustments and other-job line exceptions could be falsely attributed to each work order |
| Vendor / technician | Secure quote or authorization link; respond, check in, record per-job outcomes, check out | Quote revisions, vendor response, and observed service facts | Receives requested pricing scope or authorized work; creates attributed response/visit/outcome evidence and follow-up triggers | Pricing, authorization, appointment, attendance, and outcome now remain visibly distinct; one visit preserves independent job outcomes and no-WO exception handling |

## Shared interaction and workflow rules

1. The first viewport states the problem, business impact/current observation, internal owner, next actor/action/deadline, and any concurrent blocker. Only the role-appropriate next action is visually primary.
2. Service progress, operating condition, internal accountability, next actor, and financial review remain separate facts. History never becomes current merely because it is the latest completed fact of its type.
3. The current visit cycle is selected from every linked visit/work record, including one that has not recorded an outcome. Verification applies only to the exact immutable outcome it reviewed.
4. Internal ownership is a persisted membership or supported team identity. Reassignment is audited and never changes a vendor-owned next action.
5. Invoice line allocation is the only work-order attribution basis. An exception on another allocated line is disclosed as shared invoice context, not attributed to this job. Invoice-level adjustments remain explicitly shared unless a supported allocation exists.
6. Lists answer a queue question; details explain and act; overview surfaces consequences and exceptions. Portfolio metrics state whether they cover the full scoped population or the filtered result set and link to supporting records.
7. Held work preserves each job’s authorization, owner, deadline, outcome, follow-up, and financial history. “Approve to wait,” “add to a suitable visit,” and “dispatch now” remain distinct.
8. Meaningful actions return a clear confirmation and preserve a useful route back to the prior list/filter context.
9. Store-manager observable confirmation is enabled by default. Client Setup may enable routine creation/dispatch by store managers, but dispatch depends on create permission and all scope, approval, vendor, NTE, priority, and state checks remain mandatory.
10. Verification is tri-state and exact-outcome-bound: **Yes** may resolve/close eligible routine work, **No** creates corrective work without alleging invoice invalidity, and **Not sure** routes facilities review without recording success or rejection.
11. The one closure evaluator is used for manual close, confirmation-time auto-close, and re-evaluation after the final required operational task. Financial-only tasks neither block service closure nor get silently completed by it.
12. Quote requests collect pricing facts; selection records a provider/pricing choice; authorization permits work; a confirmed appointment records timing; visit evidence records attendance/outcome. No one state silently creates another.
13. Action Center rows normally represent one decision/case. Related source IDs are retained and counted; independent obligations on the same work order stay separate. Overdue external commitments remain visible to the internal owner.

## Remaining demo boundaries

The role picker is a preview of fictional data, not production authentication. Delivery is represented by an outbox and does not imply real email/SMS delivery. Invoice review does not approve or execute payment. The 15-store presentation demonstrates workflows; the separate scale fixture demonstrates approximately 65-store behavior.

The open attention queue does not yet provide a completed/history lane, source-by-source expansion for grouped rows, or **Save and open next**. Quote files are not yet associated with immutable proposal revisions. Advanced confirmed-opportunity/review-window analysis still uses the compatibility snapshot even though the normal lists and ordinary held-work path remain bounded and query-first. These are explicit follow-on gaps, not hidden product claims.
