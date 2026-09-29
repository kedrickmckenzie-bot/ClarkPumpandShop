# Refreshed convenience-store demo

This is a fictional 15-store, five-vendor portfolio with two internal maintenance technicians. Refresh dates are anchored to the day the seed is created. They do not silently change after people start using the demo.

## What to show

| Start here | Story |
| --- | --- |
| Store 103, 108 or 115 | A new routine report is visible on the store page before a work order exists. |
| Store 104 | The existing beer-cave repair, vendor handoff, visit history and component warranty callback stay connected. A store task asks for a door check. |
| Work → Tasks | A shared access check, store equipment checks, completed routine task and camera findings awaiting the requester. |
| Store 109 camera task | The unmatched $585 invoice links to a camera request using the invoice date as a search day, not as proof of service. Findings remain a human review. |
| Compliance | Weekly store walks at all 15 stores, an overdue extinguisher check, upcoming fuel inspection, completed food inspection, missing hood paperwork, expiring permit evidence and failed exit-light inspection. |
| Store 114 safety inspection | Finding → internal corrective work → verification still needed. The inspection remains open. |
| Store 108 food inspection | Performed and reviewed, with downloadable fictional evidence. |
| Weekly walk | Download the master checklist; later upload completed paperwork/photos through the normal workflow. |
| Planned replacements | Five plans, four future months and one unpriced/undated proposal. Planning estimates are not approved spend. |
| Store vendors | Refrigeration preferences at three stores; other stores need no preferred vendor. |

Existing repair history, PM, invoices, repeat-cost examples, quote comparisons, vendor visits and warranty evidence remain in the base fixture. The new stories extend that history. Sample documents are explicitly labeled fictional text files, not actual permits or certifications. Two invoice summaries reproduce the source totals ($585 and $11,575); they are labeled summaries rather than vendor-original invoices. No outgoing email is represented as delivered.

## Render reset

Deploy the updated code and run existing database migrations first. In the **web service Shell** connected to the demo database, run:

```sh
OPS_ENVIRONMENT=demo OPS_RESET_TENANT_CONFIRM=org-northline-demo npm run db:reset:demo
```

This replaces records belonging to `org-northline-demo`, including edits and test records. It preserves the database schema, other tenants, shared user rows and storage objects. The reset runs in one transaction and rolls back on failure. It verifies 15 stores and five vendors before committing. The existing whole-database reset command is unchanged and should not be used for this task.

Refresh the app afterward. Check Tasks, Compliance, planned replacements and Store 103 open reports. A normal deployment does not reset an existing demo tenant.

## Local

Ordinary local development uses the same refreshed showcase when the server starts. Restarting the process resets its in-memory records. Tests retain their deterministic baseline and separately validate the new showcase, its dates, evidence bytes and PostgreSQL reset behavior.
