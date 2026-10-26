import { Pool, type PoolClient, type QueryResultRow, type PoolConfig } from 'pg';

let pool: Pool | null = null;

function buildConfig(): PoolConfig {
  const cs = process.env.CONNECTION_STRING || process.env.DATABASE_URL;
  if (!cs) throw new Error('CONNECTION_STRING env var missing');
  const useSsl = !/sslmode=disable/i.test(cs);
  return {
    connectionString: cs,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  };
}

export function getPool(): Pool {
  if (!pool) pool = new Pool(buildConfig());
  return pool;
}

export async function withConn<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<T[]> {
  const res = await getPool().query<T>(text, values as never[]);
  return res.rows;
}

export async function ensureLeadsTable(): Promise<void> {
  await query(`CREATE TABLE IF NOT EXISTS leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business text NOT NULL,
    business_key text NOT NULL,
    need text NOT NULL,
    why_suits text,
    relevant_service text,
    contact jsonb NOT NULL DEFAULT '{}'::jsonb,
    recency timestamptz NOT NULL DEFAULT now(),
    platform text NOT NULL DEFAULT 'Other',
    source text NOT NULL DEFAULT 'manual',
    city text,
    country text,
    remote_eligible_pak boolean NOT NULL DEFAULT false,
    validation_passed jsonb,
    score integer NOT NULL DEFAULT 5,
    weighted_score smallint,
    classification text,
    evidence_level text,
    pitch_angle text,
    case_study text,
    category text NOT NULL DEFAULT 'Other',
    status text NOT NULL DEFAULT 'discovered',
    outcome text,
    outcome_at timestamptz,
    opt_out boolean NOT NULL DEFAULT false,
    hidden boolean NOT NULL DEFAULT false,
    last_contact_at timestamptz,
    next_follow_up_at timestamptz,
    human_review_required boolean NOT NULL DEFAULT false,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    post_url text GENERATED ALWAYS AS (contact->>'post_url') STORED,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS leads_business_key_unique_idx
    ON leads (business_key)`);
  await query(`CREATE INDEX IF NOT EXISTS leads_recency_idx ON leads (recency DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS leads_platform_idx ON leads (platform)`);
  await query(`CREATE INDEX IF NOT EXISTS leads_remote_idx ON leads (remote_eligible_pak)`);
  await query(`CREATE INDEX IF NOT EXISTS leads_weighted_score_idx ON leads (weighted_score DESC NULLS LAST)`);
  await query(`CREATE INDEX IF NOT EXISTS leads_source_idx ON leads (source)`);
}

let tableReady = false;

export async function ensureLeadsTableOnce(): Promise<void> {
  if (tableReady) return;
  try {
    await ensureLeadsTable();
    tableReady = true;
  } catch (err) {
    if (err instanceof Error && /already exists/i.test(err.message)) tableReady = true;
    else throw err;
  }
}
