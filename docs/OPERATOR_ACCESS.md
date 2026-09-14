# Operator access

Pass 4 separates the fictional preview from authenticated operator access. The current private Sites showcase remains a preview; this document is the deployment and provisioning contract for authenticated mode, not evidence of a real-customer rollout.

## Runtime configuration

| Runtime | Configuration | Result |
| --- | --- | --- |
| Fictional Sites showcase | `OPS_ACCESS_MODE=preview` | Existing 15-store demo and clearly labeled role controls |
| Ordinary local fixture development | No access setting, no database, nonproduction Node environment | Fictional preview |
| Authenticated Sites deployment | `OPS_ACCESS_MODE=authenticated`, `OPS_IDENTITY_PROVIDER=sites` | Sites-verified subject plus active database membership required |
| Deployed runtime without identity configuration | No provider | Access denied with a short setup message |
| Render | Authenticated mode; no Sites provider | Access denied until a verified Render identity adapter is integrated |

Sites runtime variables are configured through Sites and take effect on deployment. Vinext's local Cloudflare worker reads ignored `.env.local` values; parent-shell variables alone do not configure that worker. Never bake production secrets into a build. Keep `DB` and `FILES` bindings while the Sites showcase is active.

## Membership provisioning

An administrator must provision an active `User` with ID `sites:<verified Sites subject>`, an active organization membership, and explicit scope grants. The verified subject comes from the Sites dispatch identity boundary; never map an account by email or trust those headers on an arbitrary Node host. Sites authentication remains owned by Sites. There is no automatic signup, email-based account claiming, or fallback to a seeded persona.

An optional `OPS_ORGANIZATION_ID` selects a default company. Otherwise the signed-in user enters a company code (the stable organization ID). The HttpOnly, SameSite cookie is only a selector: every request verifies membership in that company. Multiple active memberships for the same user/company are rejected rather than choosing a more powerful role. Membership suspension, suspended users, absent scopes and unknown roles deny access.

Read scopes support organization, division, region and store grants. Organization-wide grants must reference the selected organization. Empty assigned-store lists deny access. Supported read permissions are `ops:*`, `ops:read`, `ops:write`, `ops:read_write`, `ops:store_manage` and `ops:finance_read`; write access requires write permissions throughout the readable scope. Mixed broad-read/narrow-write grants remain read-only until separate write scopes are implemented. This conservative limitation prevents a narrow grant from becoming companywide write access.

Company setup and operations that span stores require companywide access. Store-bound commands still check their exact store and role/capability. Operator mutation routes reject cross-site form submissions. Page, API, export and audit attribution use the same active membership and stored user identity. Authenticated sessions ignore all preview-role/package cookies; preview mutation and accounting-demo routes are disabled.

## Data and public access

All operator snapshots now require an explicit organization. Local snapshots filter tenant rows and membership-linked users; SQL adapters constrain queries by organization. Remaining large snapshots are the separate Pass 5 performance/extraction work. Authenticated repository startup does not seed demo data, and reporting uses the current time outside preview.

Public vendor/store capabilities remain separate from operator login: token hashes resolve a purpose, expiration and exact tenant-owned subject before returning a narrow view. Public channels call the shared domain commands. Existing transactional audit, amendments, idempotency, version fences, vendor eligibility, cross-channel visits and unresolved-checkout follow-ups remain in force. Location capture uses one-time arrival/departure requests, never continuous tracking.

## Evidence and remaining rollout gates

`tests/ops-production-identity.test.ts` covers identity, membership revocation, organization switching, division/store grants, cross-site requests and mixed/read-only permissions. `tests/ops-access-boundary-regression.test.ts` covers expired/revoked/wrong-purpose/cross-tenant capabilities and empty-scope reads/aggregates. The PostgreSQL engine suite verifies membership and grant queries against migrated tables. The complete regression suite also covers private files, public vendor boundaries, transactional audit, retries and concurrency.

Real identity onboarding, Render identity integration, production database/object-store provisioning, delivery providers, recovery drills and infrastructure-scale evidence are still deployment gates. Do not describe the fictional role picker or this local validation as production authentication in use by customers.
