/*
# Replace expression dedupe index with generated post_url column

1. Modified Tables
- `leads`: add `post_url` as a stored generated column mirroring `contact->>'post_url'`,
  so the dedupe upsert can target a plain column instead of a JSONB expression.

2. Index changes
- Drop the partial expression unique index (ON CONFLICT cannot infer it).
- Create a plain unique index on (business, post_url). NULL post_url values never
  collide (Postgres treats NULLs as distinct), so no partial predicate is needed.
*/

ALTER TABLE leads ADD COLUMN IF NOT EXISTS post_url text
  GENERATED ALWAYS AS (contact->>'post_url') STORED;

DROP INDEX IF EXISTS leads_business_post_url_dedupe_idx;

CREATE UNIQUE INDEX IF NOT EXISTS leads_business_post_url_dedupe_idx
  ON leads (business, post_url);
