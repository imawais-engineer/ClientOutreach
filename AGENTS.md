# ClientOutreach Dashboard — local environment notes

Next.js lead dashboard for imawais.engineer. Repo: `https://github.com/imawais-engineer/ClientOutreach`.
This clone lives at `/data/home/ClientOutreach-web`; it is separate from the Python pipeline in `/data/home/ClientOutreach`.

## Stack

- Next.js 13.5.1 (App Router) + React 18 + TypeScript + Tailwind + shadcn/ui
- Postgres accessed directly with `pg` from API routes (`lib/db.ts`)
- Cookie auth for the dashboard (`SITE_EMAIL` / `SITE_PASSWORD`), `x-api-secret` for agent pushes

## Database

The service currently points at **Supabase** (production data, PostgreSQL 17):
`db.<project-ref>.supabase.co:5432` via `CONNECTION_STRING` in `.env.local`.
The direct 5432 host works from this VM; a Vercel/Netlify serverless deploy must use
the **transaction pooler** on port 6543 instead, or connections will run out.

A local Postgres container is kept as a fallback (same schema, older rows):

```bash
docker ps --filter name=clientoutreach-pg
# data volume: /data/home/clientoutreach-pgdata
docker exec clientoutreach-pg psql -U clientoutreach -d clientoutreach -c '\dt'
```

The app runs under systemd, bound to localhost only:

```bash
sudo systemctl status clientoutreach-web --no-pager
sudo journalctl -u clientoutreach-web -n 50 --no-pager
sudo systemctl restart clientoutreach-web
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/login
```

Unit file: `/etc/systemd/system/clientoutreach-web.service` (runs `node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000` in production mode). Do not rebind to `0.0.0.0` without a reviewed access plan.

## Configuration

`/data/home/ClientOutreach-web/.env.local` (mode 600, git-ignored) holds:

| Variable | Purpose |
|---|---|
| `CONNECTION_STRING` | Postgres DSN — Supabase 5432, or the local container with `...?sslmode=disable` |
| `SITE_EMAIL`, `SITE_PASSWORD` | dashboard login |
| `API_SECRET` | value the agent sends as `x-api-secret` on `POST /api/leads` |

Read a value with `grep -E '^SITE_PASSWORD=' .env.local` rather than `cat`-ing the file.
The leads table and its indexes are created automatically on the first API request (`ensureLeadsTable`).

`API_SECRET` contains `%`, `#`, `*` and `@`, so it is stored single-quoted in `.env.local`; keep the quotes
when editing or the value can be truncated at `#`.

Switching back to the local database: `cp .env.local.bak.localdb.* .env.local` and restart the service.

## After changing code

```bash
cd /data/home/ClientOutreach-web
npx tsc --noEmit
npx next build
sudo systemctl restart clientoutreach-web
```

## Deployment (Vercel)

Production: `https://client-outreach-woad.vercel.app` (also `client-outreach-imawais.vercel.app`).
Project `client-outreach` (`prj_aUTp1YvXqw05wcUZB6FLr6OzsInB`, team `imawais`), deploy from GitHub
`imawais-engineer/ClientOutreach` branch `main` — a push to `main` builds and promotes automatically.

Vercel env vars are **sensitive** type (write-only, cannot be read back): `CONNECTION_STRING`,
`SITE_EMAIL`, `SITE_PASSWORD`, `API_SECRET`, all targeted at production/preview/development.
`CONNECTION_STRING` in Vercel is the **transaction pooler**, not the direct host:

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

Changing an env var does not affect an existing deployment; push a commit or redeploy.

## Fixes applied (pushed in 61b209b)

1. `package.json`: `@radix-ui/react-label` was `^1.1.0`, which has no published version — `npm install` failed and every Vercel deploy errored (`invalid_version_value`). Now `^2.1.17`.
2. `app/api/leads/route.ts`: GET filter clauses used `$?` placeholders while the helper already prefixes `$`, producing `$$1` and 500s on every filter. Clauses now use `?`; the days filter casts `(?::text || ' days')::interval`.
3. `DELETE /api/leads?id=<uuid>` (what the dashboard calls) had no handler and returned 405. Added to `app/api/leads/route.ts`; `app/api/leads/[id]/route.ts` now also accepts the id from the path.
4. `contact.website` is accepted by the API and rendered as a Website button on each lead card.

## Known issues

- `next@13.5.1` is flagged by npm as having a security vulnerability; upgrading is still pending.
- No `package-lock.json` is committed (the repo removed it for Vercel), so installs are not reproducible.
- `POST /api/login` has no rate limiting or lockout; it is a single static credential pair via env.
- Commits must use the GitHub noreply address `193931846+imawais-engineer@users.noreply.github.com`; GitHub rejects pushes that expose the private account email (GH007). Repo-local `user.name`/`user.email` are set accordingly.
