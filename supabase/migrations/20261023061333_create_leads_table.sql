/*
# Create leads table (single-tenant, password-gated dashboard)

1. New Tables
- `leads`: outreach leads pushed by an external backend agent.
  - `id` (uuid, primary key, default gen_random_uuid())
  - `business` (text, not null) - company or person name
  - `need` (text, not null) - what they need, shown as badge
  - `why_suits` (text, nullable) - short pitch on why this lead suits the owner
  - `contact` (jsonb, not null, default '{}') - { profile_url, dm_link, email, phone, post_url, application_url }
  - `recency` (timestamptz, not null, default now()) - when the signal was seen; drives badges + sort order
  - `platform` (text, not null, default 'Other') - Google Maps | Instagram | Threads | Facebook | Job Boards
  - `remote_eligible_pak` (boolean, not null, default false)
  - `validation_passed` (jsonb, nullable) - { remote, recency, relevance, contact } booleans
  - `score` (integer, not null, default 5) - 0-10 lead score
  - `pitch_angle` (text, nullable)
  - `case_study` (text, nullable) - used in the copyable outreach template
  - `created_at`, `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on `leads`.
- The frontend never talks to this table directly; all access goes through Next.js API routes using the service role key. No policies target anon/authenticated - deny by default.
- Grant full CRUD to `service_role` only.

3. Notes
- Unique index on (business, post_url) powers the agent-side dedupe (upsert with ignoreDuplicates).
- Indexes on recency, platform, remote_eligible_pak for the dashboard filters.
*/

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business text NOT NULL,
  need text NOT NULL,
  why_suits text,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  recency timestamptz NOT NULL DEFAULT now(),
  platform text NOT NULL DEFAULT 'Other',
  remote_eligible_pak boolean NOT NULL DEFAULT false,
  validation_passed jsonb,
  score integer NOT NULL DEFAULT 5,
  pitch_angle text,
  case_study text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO service_role;

DROP POLICY IF EXISTS "select_own_leads" ON leads;
DROP POLICY IF EXISTS "insert_own_leads" ON leads;
DROP POLICY IF EXISTS "update_own_leads" ON leads;
DROP POLICY IF EXISTS "delete_own_leads" ON leads;

CREATE UNIQUE INDEX IF NOT EXISTS leads_business_post_url_dedupe_idx
  ON leads (business, (contact->>'post_url'))
  WHERE contact->>'post_url' IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_recency_idx ON leads (recency DESC);
CREATE INDEX IF NOT EXISTS leads_platform_idx ON leads (platform);
CREATE INDEX IF NOT EXISTS leads_remote_idx ON leads (remote_eligible_pak);
