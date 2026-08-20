# Permission Model

**Status:** approved target; current enforcement is partial and preview-bound

## Authorization order

Every tenant-owned read, write, search, aggregate, export, file, job, public action, and audit lookup applies checks in this order:

1. Resolve an authenticated identity or a narrow public capability.
2. Establish `organization_id`; never infer tenancy from a record ID.
3. Resolve active membership, role, and capabilities.
4. Apply division, region, store, vendor, and assignment scope grants.
5. Apply record-state, data-class, approval-limit, and segregation-of-duties rules.
6. Record privileged overrides with reason and Audit Event.

Repository interfaces must not expose unscoped tenant `getById` methods. A valid identifier from another organization returns no data and cannot distinguish “exists but forbidden” through public projections.

## Role matrix

| Role | Core allowed actions | Material restrictions |
|---|---|---|
| Store reporter/employee | Submit issue/evidence; view permitted store progress; answer questions | No spending approval, vendor evidence edits, invoice edits, resolution, or closure |
| Store manager | Confirm impact/access; verify/reject completion; approve/reopen within delegation | No timestamp/evidence rewrite; no above-limit approval; store scope only |
| Facilities coordinator/admin | Own/classify work; request approval; assign/issue; manage PM; resolve exceptions; verify/resolve/close | Cannot self-approve above authority or silently alter approved/immutable history |
| Regional/operations approver | Review permitted regional work; approve quotes/change/emergency/routing and capital decisions within authority | Region/store scope and delegated limits apply |
| Finance reviewer/AP | Receive/match invoice evidence; open exceptions; record approved-for-payment/credit/payment status if enabled | Cannot mark technical completion, edit technician evidence, or rewrite Repair Items; platform does not execute payment |
| Internal technician | View assigned/permitted work; check in/out; record diagnosis/outcome/evidence | Cannot self-approve or self-verify above policy |
| Vendor dispatcher | Respond to its assignments/runs; propose schedule; submit estimate/invoice evidence; answer warranty/discrepancy tasks | No customer approvals, self-verification, closure, or competing-vendor data |
| Vendor technician | See eligible assigned work; check in/out; record per-WO outcomes, Repair Items, and evidence | No customer portfolio, competing vendor, or internal financial approval data |
| Executive/auditor | Read permitted operations, finance, metrics, value, and audit; act only through explicit delegated approvals | No operational edit clutter or silent admin bypass |
| Organization administrator | Configure users, roles, stores, vendors, taxonomy, policies, and templates | Admin status does not permit transactional history rewrite or bypass segregation rules |
| Support | Purpose-limited, time-bounded support action with customer context and enhanced audit | No standing cross-tenant browsing or hidden impersonation |

Role labels may vary in presentation, but capabilities and scope are server-owned. “Facilities” in the current operator UI maps to the domain's facilities administrator/coordinator responsibilities; this alias must not create a second permission system.

## Segregation of duties

Policies must support requester versus approver, recommender versus above-threshold approver, vendor submitter versus customer verifier, invoice submitter versus payment approver, finance reviewer versus technical editor, administrator versus transaction operator, and capital recommender versus capital approver where configured.

An override requires an authorized capability, explicit reason, timestamp, affected policy/rule, expiry when temporary, and Audit Event. Administrator status alone is never an override.

## Public capabilities

Store and vendor links are capabilities, not anonymous repository access. Tokens are high-entropy, opaque, stored only as hashes, organization/record/purpose-bound, expiring where appropriate, revocable, rate-limited, and audited. Projections expose only the minimum store/work/vendor context needed for the action—never internal notes, portfolio data, competing vendors, or sensitive financial approval detail.

File access uses an authorized stream or short-lived signed URL after organization, record, purpose, and visibility checks. Raw object keys are not authorization.

## Current implementation boundary

Implemented foundations include organization-first repository signatures, membership/scope data, role-shaped operator navigation, store/region checks on several mutation routes, narrow public-token projections, and tenant/role tests. However:

- the visible role is selected from a fictional preview cookie;
- missing ChatGPT identity can fall back to a demo operator;
- Northline organization selection is fixed for the showcase;
- operator reads often load the whole organization before presenter filtering;
- route and repository coverage has not passed a complete production authorization audit;
- vendor user sessions, delegated approvals, support access, revocation administration, general tenant selection, and production SSO/MFA/SCIM are absent.

Therefore production authentication, generalized server-enforced scope, and production authorization are **not complete**. No real customer data should be admitted on the strength of the preview role picker.

## Required proof

Test same-tenant allowed access, store/region denial, cross-tenant identifier denial, vendor isolation, data-class restrictions, approval limits, segregation, suspended membership, revoked/expired token, public enumeration resistance, file authorization, and audited overrides for every new mutation channel.
