# ClientOutreach Dashboard

Password-protected lead dashboard for **Muhammad Awais — imawais.engineer (AI Automation Engineer)**.

- Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Leads stored in Postgres via a single `CONNECTION_STRING` (works with Supabase or any Postgres)
- Backend agent (Python/n8n) pushes leads via `POST /api/leads` with an API secret
- Dark, minimal, mobile-friendly card grid UI

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com), click **Add New → Project** and import the repo (framework auto-detects as Next.js).
3. Before deploying, open **Settings → Environment Variables** and add:

| Name | Value |
|---|---|
| `SITE_EMAIL` | The login email for the dashboard |
| `SITE_PASSWORD` | The login password for the dashboard (used together with `SITE_EMAIL`) |
| `API_SECRET` | A long random string your backend sends as `x-api-secret` |
| `CONNECTION_STRING` | Postgres connection string from Supabase → Project Settings → Database (use the **Transaction pooler** URI on Vercel; append `?sslmode=require` if not already present) |

4. Click **Deploy**. First deploy works with no extra setup.

## Local development

```bash
cp .env.example .env.local   # fill in real values
npm install
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`. Enter the `SITE_EMAIL` and `SITE_PASSWORD` values to sign in. A cookie (`auth=1`) keeps you signed in for 30 days; the Logout button clears it.

---

## How the backend agent sends leads

`POST /api/leads` is protected by the `x-api-secret` header (no cookie needed).

```bash
curl -X POST https://your-vercel-url.vercel.app/api/leads \
  -H "x-api-secret: YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"business":"Needkingdom Community","need":"Chatbot for website","why_suits":"Website chatbot + lead engine - your core","contact":{"profile_url":"https://www.threads.com/@needkingdom","dm_link":"https://www.threads.com/@needkingdom"},"recency":"2026-10-21","platform":"Threads","remote_eligible_pak":true,"validation_passed":{"remote":true,"recency":true,"relevance":true,"contact":true},"score":9,"case_study":"Real estate AI receptionist"}'
```

Response: `{"ok":true,"duplicate":false,"id":"..."}`

**Body fields**

| Field | Required | Notes |
|---|---|---|
| `business` | yes | string |
| `need` | yes | string, shown as badge |
| `why_suits` | optional | 2-line pitch shown on card |
| `contact` | optional | object: `profile_url`, `dm_link`, `email`, `phone`, `post_url`, `application_url` |
| `recency` | optional | ISO date/time; defaults to now |
| `platform` | optional | `Google Maps` \| `Instagram` \| `Threads` \| `Facebook` \| `Job Boards` |
| `remote_eligible_pak` | optional | boolean |
| `validation_passed` | optional | object of `{remote, recency, relevance, contact}` booleans |
| `score` | optional | 0–10 |
| `pitch_angle` | optional | string |
| `case_study` | optional | used in the copyable DM template |
| `category` | optional | free-form grouping (e.g. `AI Automation`, `Chatbot`, `Job Application`); default `Other` |
| `status` | optional | `new` (default), `contacted`, `applied`, or `hidden` |

Duplicates are ignored: the same `business` + `post_url` combination returns `{"ok":true,"duplicate":true}` instead of creating a second row.

**Note on dedupe:** if your backend sends a lead without `post_url`, dedupe won't apply — include `post_url` when available so the same lead isn't pushed twice.

## Other endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/leads?platform=Instagram&remote=true&days=7&search=chatbot&category=AI+Automation&status=new` | auth cookie or `x-api-secret` | Filtered leads, sorted by recency (newest first) |
| `PATCH /api/leads` | auth cookie or `x-api-secret` | Update a lead's pipeline status: `{ "id": "<uuid>", "status": "contacted" \| "applied" \| "hidden" \| "new" }` |
| `GET /api/leads/categories` | auth cookie or `x-api-secret` | Distinct categories with counts (hidden leads excluded) |
| `DELETE /api/leads?id=<uuid>` | auth cookie or `x-api-secret` | Delete a lead |
| `POST /api/login` | public | `{ "email": "...", "password": "..." }` → sets auth cookie |
| `POST /api/logout` | public | Clears auth cookie |

## Security notes

- All `/api` routes except `POST /api/leads` require the auth cookie or the `x-api-secret` header.
- The dashboard email and password are compared server-side; the cookie is httpOnly and secure in production.
- The `CONNECTION_STRING` is only read by API route handlers, never shipped to the browser. All SQL is parameterized.
- The leads table is created automatically on first API request if it doesn't exist (safe self-healing).

## Backend agent API reference (for your Python / n8n agent)

Base URL: `https://your-vercel-url.vercel.app` - every agent request sends `x-api-secret: API_SECRET`.

### 1. Push a lead
`POST /api/leads`

```json
{
  "business": "Needkingdom Community",
  "need": "Chatbot for website",
  "why_suits": "Website chatbot + lead engine - your core",
  "contact": {
    "profile_url": "https://www.threads.com/@needkingdom",
    "dm_link": "https://www.threads.com/@needkingdom",
    "email": null,
    "phone": null,
    "post_url": "https://www.threads.com/@needkingdom/post/example",
    "application_url": null
  },
  "recency": "2026-10-21T00:00:00Z",
  "platform": "Threads",
  "remote_eligible_pak": true,
  "validation_passed": { "remote": true, "recency": true, "relevance": true, "contact": true },
  "score": 9,
  "pitch_angle": "Lead capture bot on their landing page",
  "case_study": "Real estate AI receptionist",
  "category": "AI Automation"
}
```

- `platform` should be one of: `Google Maps`, `Instagram`, `Threads`, `Facebook`, `Job Boards` (anything else is stored as-is under "Other").
- `category` is free-form - use it to group jobs by industry or offer type.
- Responses: `200 {"ok":true,"duplicate":false,"id":"..."}` | `200 {"ok":true,"duplicate":true,"id":null}` | `400` missing fields | `401` wrong secret | `500` server error.

### 2. Pull / check leads (optional, e.g. for dedupe or sync)
`GET /api/leads?status=new&days=7&category=AI%20Automation&search=chatbot`

Query params (all optional, combine freely):
- `platform` - exact match, e.g. `Instagram`
- `category` - exact match, e.g. `AI Automation` (URL-encode spaces as `%20`)
- `remote` - `true` = only `remote_eligible_pak`
- `days` - only leads with `recency` within the last N days
- `search` - matches `business` or `need` (case-insensitive contains)
- `status` - `new` | `contacted` | `applied` | `hidden`, or omit for everything except hidden

Response: `{"leads": [ { ...lead, "status": "new", "category": "AI Automation" } ]}` sorted newest first.

### 3. Change a lead's status (same as the dashboard buttons)
`PATCH /api/leads` with body `{"id": "<lead id>", "status": "contacted"}` - statuses: `new`, `contacted`, `applied`, `hidden`.

### 4. List categories
`GET /api/leads/categories` returns `[{"name":"AI Automation","count":12}, ...]` - useful if your agent wants to know which categories exist before pushing.

### Status flow
```
new --(you DM / email)--> contacted --(you apply)--> applied
 |                                                           
 +--------(Hide button)--------> hidden (archived, out of the way)
```
Hidden leads are archived, never shown on the default dashboard, and excluded from category counts - this keeps room for new jobs at the top.
