# Database Reset and Seed

**Status:** deterministic seed foundation and a fail-closed PostgreSQL development/demo reset command are implemented; D1 reset and a live empty-database reset drill are not

## Current behavior

| Command/path | What it currently does |
|---|---|
| `npm run db:seed` | Builds and validates deterministic presentation and 65-store fixtures and seed statements. It does **not** mutate, clear, migrate, reset, or seed D1/PostgreSQL. |
| Local `npm run dev` | Uses the in-memory fixture when no durable database is configured; mutations reset on process restart. |
| Hosted D1 bootstrap | Applies deterministic Northline seed data when the version marker is absent; requires migrations to already exist. It is idempotent bootstrap, not a reset command. |
| `npm run db:migrate:postgres` | Applies unapplied PostgreSQL migrations under advisory locks. It is not destructive reset. |
| `npm run db:seed:postgres` | Idempotently ensures the Northline seed version in configured PostgreSQL. It does not clear unrelated records or recreate schema. |
| `npm run db:reset:postgres` | After all safety checks pass, drops and recreates only the connected database's `public`/Drizzle schemas, applies every PostgreSQL migration, seeds Northline through the transaction repository, and verifies one Organization, 15 Stores, and five Vendors. |
| `npm run render:predeploy` | Runs PostgreSQL migration, then idempotent seed. It is deployment bootstrap, not reset. |

The reset command is non-interactive and fail-closed. It runs only when `ALLOW_DESTRUCTIVE_RESET=true`, `OPS_ENVIRONMENT` is exactly `development`, `test`, `demo`, or `local`, `NODE_ENV` is not `production`, no Render service marker is present, `DATABASE_URL` names a non-system PostgreSQL database, and `OPS_RESET_DATABASE_CONFIRM` exactly matches that parsed database name. The command also verifies that `current_database()` matches the confirmation before acquiring advisory locks or dropping a schema. Guard behavior has unit coverage; a live disposable-database reset drill is still required before production readiness can be claimed.

### D1 release boundary

D1 data is shared state and is not versioned with a Worker deployment. Same-release bootstrap races are restart-safe, but an empty or deliberately reset D1 database must be initialized by exactly one application seed version. Do not use a split/gradual Worker deployment across different fixture versions until the current seed marker has been written and verified. A future guarded D1 reset must remove application traffic, apply migrations and the current deterministic seed, verify the marker plus the 15-Store/five-Vendor contract, and only then restore traffic. Never reset the shared D1 binding while an older Worker version can still receive requests.

Normal `wrangler deploy` behavior sends 100% of traffic to one version; gradual deployments intentionally allow two versions to serve simultaneously, while D1 state remains outside Worker version history. See [Workers versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/) and [gradual deployments](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/).

## Fixture contract

The fictional presentation tenant must contain exactly 15 Stores across three Regions, exactly five approved outside Vendors, and two internal technicians. Source records—not hardcoded summary totals—drive the UI. A separate approximately 65-Store fixture proves scale and never appears as a prospect's portfolio. IDs and fixture clock are deterministic, seed writes are restart-safe, and invariants validate organization linkage and causal ordering.

The target directive contains broader seeded scenarios than the current fixture. Their presence must be verified by tests before the seed story is called complete.

## PostgreSQL reset procedure

Set the connection through the normal secret mechanism; never paste credentials into source or command history. In PowerShell, the required non-secret controls are:

```powershell
$env:ALLOW_DESTRUCTIVE_RESET = "true"
$env:OPS_ENVIRONMENT = "development"
$env:OPS_RESET_DATABASE_CONFIRM = "traceops_dev"
npm run db:reset:postgres
```

The command executes only when all of these are true:

1. The target resolves to an explicitly classified disposable local/development/demo environment.
2. Production and any unknown/unclassified connection are denied.
3. `ALLOW_DESTRUCTIVE_RESET=true` is set for that invocation.
4. The command prints the resolved backend and database identity without exposing credentials.
5. The schema target is exact; no broad filesystem or account deletion is involved.

It then:

1. Acquires an exclusive reset lock.
2. Drops/recreates only the application schema or approved disposable database.
3. Applies the clean migration baseline.
4. Seeds deterministic source records through the repository/seed path.
5. Verifies the in-memory fixture invariants before writing, then verifies one Northline Organization, exactly 15 persisted Stores, and exactly five persisted Vendors before commit.
6. Prints the resolved database name, host, classified environment, migration count, seed statement count, and verification summary without printing credentials.

The script does not delete object storage, reset D1, validate a backup restore, persist a separate reset receipt, or run the complete quality suite automatically. `npm run db:seed` separately validates the presentation and approximately 65-Store fixture contracts. These remaining checks must be run and recorded after a live disposable-database reset.

## Data authority and safety

The repository is currently declared to contain disposable demonstration/development data. If any environment contains real customer or production data, that contradicts the directive and blocks destructive reset. Preserve unrelated user work and never treat `NODE_ENV` alone as sufficient proof that a database is disposable.

Reset authority does not authorize deleting storage buckets, external services, credentials, or other applications. Uploaded evidence cleanup needs its own exact, tenant-scoped, recoverable procedure.

## Verification after a reset

Run and record exact results for:

```bash
npm run db:seed
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run build:render
```

Then inspect manager search/drill-down, store creation, deferred classification, direct and estimate work, public vendor action, cross-channel visit, no-WO exception, invoice safeguard, PM/lifecycle, role projections, and responsive store/vendor views. A successful fixture validator alone is not reset proof.
