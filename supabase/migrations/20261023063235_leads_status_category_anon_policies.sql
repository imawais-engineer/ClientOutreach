/*
# Add lead status + category columns, and anon CRUD policies

1. Modified Tables
- `leads`
  - `status` (text, not null, default 'new'): pipeline state shown on the dashboard.
    Allowed values: 'new', 'contacted', 'applied', 'hidden'.
    - 'contacted' = you sent a DM / called / emailed
    - 'applied' = you applied via a job board or application link
    - 'hidden' = archived: removed from the dashboard so new jobs get visibility
  - `category` (text, not null, default 'Other'): lead category for grouping
    (e.g. 'AI Automation', 'Web Development', 'Chatbot', 'Job Application').
    Free-form text; the backend agent can set it.

2. Security
- The app's server code talks to the database with keys that run as the `anon`
  role, so the table needs explicit policies for anon access.
- Enable RLS remains on. Access is still gated by the app itself: the Next.js
  API routes require the auth cookie or x-api-secret before any query runs.
- Grant full CRUD to anon + authenticated (matching what the API layer uses).
- Add 4 separate policies (SELECT / INSERT / UPDATE / DELETE) TO anon, authenticated.
  USING (true) is acceptable: this is a single-tenant, password-gated dashboard -
  there is no per-user data, and unauthenticated traffic can never reach the
  query layer because the middleware and route guards block it first.

3. Index
- `leads_status_idx` for filtering archived rows out of the default dashboard view.
*/

ALTER TABLE leads ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Other';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_status_check'
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_status_check
      CHECK (status IN ('new', 'contacted', 'applied', 'hidden'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO anon, authenticated;

DROP POLICY IF EXISTS "select_leads" ON leads;
CREATE POLICY "select_leads" ON leads FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_leads" ON leads;
CREATE POLICY "insert_leads" ON leads FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_leads" ON leads;
CREATE POLICY "update_leads" ON leads FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_leads" ON leads;
CREATE POLICY "delete_leads" ON leads FOR DELETE
TO anon, authenticated USING (true);
