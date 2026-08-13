# Isolated Render deployment

This runbook deploys the TraceOps demo without sharing or changing any DockSafe
service, database, bucket, environment group, domain or credentials.

## 1. Create the TraceOps PostgreSQL database

Inside the dedicated TraceOps Render project and environment, create a new
PostgreSQL database in the same region as the future web service. Give it a
TraceOps-specific name. Keep the database private and copy its **Internal
Database URL** only after the web service is created in the same project/region.

Do not point `DATABASE_URL` at a DockSafe database. The migration creates the
TraceOps `ops_*` tables and enables PostgreSQL's `pg_trgm` extension for indexed
store and vendor search.

## 2. Create the web service

Create a new **Web Service** from
`kedrickmckenzie-bot/ClarkPumpandShop`, branch `main`, with these settings:

- Runtime: Node
- Root directory: leave blank
- Build command: `npm ci && npm run build:render`
- Health-check path: `/api/ready`
- Auto-deploy: leave off until the first verified deployment

For a paid web service, use:

- Pre-deploy command: `npm run render:predeploy`
- Start command: `npm run start:render`

Render does not offer pre-deploy commands on Free web services. For a Free
demo service, leave Pre-deploy blank and use this start command instead:

- Start command: `npm run start:render:free`

That command applies migrations and the seed before starting the server. Both
operations are locked and restart-safe, so repeated Free-service starts do not
duplicate source data or race another runner.

The repository pins Node 22.13 through `.node-version`. Render injects `PORT`;
the start script binds the standard Next server to `0.0.0.0` and serves both
application routes and generated CSS/JavaScript assets.

## 3. Configure isolated environment variables

Use `.env.render.example` as the checklist, but enter values in Render rather
than committing a `.env` file. Required application settings are:

- `TRACEOPS_RUNTIME=render`
- `DATABASE_URL` from the new TraceOps PostgreSQL database
- `NEXT_PUBLIC_SITE_URL` set to this web service's final HTTPS origin
- `PUBLIC_TOKEN_SECRET` generated specifically for TraceOps

For uploaded evidence, create a separate private S3-compatible bucket and set
the `S3_*` variables from `.env.render.example`. Do not use Render's ephemeral
local disk and do not reuse DockSafe object-storage credentials. The core demo
continues if uploads are not configured, but upload actions fail closed instead
of pretending evidence was stored.

## 4. First deployment and verification

The pre-deploy command applies every unapplied migration transactionally and
then seeds the deterministic Northline presentation tenant under a PostgreSQL
advisory lock. Rerunning it is safe; the seed marker prevents duplicate data.

After deployment, verify:

1. `GET /api/health` returns HTTP 200 and `status: ok` (manual liveness check).
2. `GET /api/ready` returns HTTP 200 and `postgresql:ready`; this is the Render
   traffic health check so an instance cannot be considered ready without its
   database.
3. `/app/overview` renders styled HTML, CSS and JavaScript.
4. Search finds stores by number and address and vendors by name/specialty.
5. A work-order mutation survives a service restart.
6. No TraceOps service shows a DockSafe database, bucket, environment group or domain.

Only then enable auto-deploy for `main`.

## Demo-versus-production boundary

This deployment is a durable, multi-user-capable demo foundation, not a customer
production launch. The visible role picker is preview-only; production identity,
server-enforced user scopes, real outbound delivery, object malware scanning,
backups/recovery drills and operational monitoring must be completed before real
customer or vendor data is admitted.
