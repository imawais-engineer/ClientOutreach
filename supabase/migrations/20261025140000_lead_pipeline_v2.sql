-- ClientOutreach pipeline v2: one business per lead, evidence list, lifecycle.
-- The leads table was empty when this ran, so nothing needed backfilling.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS business_key text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS relevant_service text,
  ADD COLUMN IF NOT EXISTS weighted_score smallint,
  ADD COLUMN IF NOT EXISTS classification text,
  ADD COLUMN IF NOT EXISTS evidence_level text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS outcome_at timestamptz,
  ADD COLUMN IF NOT EXISTS opt_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS human_review_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Legacy lifecycle values -> the 13-state lifecycle.
UPDATE leads SET business_key = trim(both '-' from lower(regexp_replace(business, '[^a-zA-Z0-9]+', '-', 'g')))
  WHERE business_key IS NULL;
UPDATE leads SET status = 'discovered' WHERE status = 'new';
UPDATE leads SET status = 'proposal_or_pilot' WHERE status = 'applied';
UPDATE leads SET hidden = true, status = 'discovered' WHERE status = 'hidden';

ALTER TABLE leads ALTER COLUMN business_key SET NOT NULL;
ALTER TABLE leads ALTER COLUMN status SET DEFAULT 'discovered';

-- One business, one row. Opportunities and source URLs live in details.evidence.
DROP INDEX IF EXISTS leads_business_post_url_dedupe_idx;
CREATE UNIQUE INDEX IF NOT EXISTS leads_business_key_unique_idx ON leads (business_key);

CREATE INDEX IF NOT EXISTS leads_weighted_score_idx ON leads (weighted_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS leads_source_idx ON leads (source);
CREATE INDEX IF NOT EXISTS leads_classification_idx ON leads (classification);
CREATE INDEX IF NOT EXISTS leads_hidden_idx ON leads (hidden);
CREATE INDEX IF NOT EXISTS leads_follow_up_idx ON leads (next_follow_up_at) WHERE opt_out = false;
