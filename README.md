# ClientOutreach Dashboard

Password-protected lead dashboard for **Muhammad Awais — imawais.engineer (AI Automation Engineer)**.

- Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Leads stored in Supabase (serverless-safe — works on Vercel out of the box)
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
| `NEXT_PUBLIC_SUPABASE_URL` | From your Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From your Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | From your Supabase project settings (server-side only) |

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

Duplicates are ignored: the same `business` + `post_url` combination returns `{"ok":true,"duplicate":true}` instead of creating a second row.

**Note on dedupe:** if your backend sends a lead without `post_url`, dedupe won't apply — include `post_url` when available so the same lead isn't pushed twice.

## Other endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/leads?platform=Instagram&remote=true&days=7&search=chatbot` | auth cookie or `x-api-secret` | Filtered leads, sorted by recency (newest first) |
| `DELETE /api/leads?id=<uuid>` | auth cookie or `x-api-secret` | Delete a lead |
| `POST /api/login` | public | `{ "email": "...", "password": "..." }` → sets auth cookie |
| `POST /api/logout` | public | Clears auth cookie |

## Security notes

- All `/api` routes except `POST /api/leads` require the auth cookie or the `x-api-secret` header.
- The dashboard email and password are compared server-side; the cookie is httpOnly and secure in production.
- The service-role key is only used in API route handlers, never shipped to the browser.
- If you ever rotate `API_SECRET`, redeploy so the new value takes effect.
