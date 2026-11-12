import { NextResponse } from 'next/server';
import { query, ensureLeadsTableOnce } from '@/lib/db';
import { requireAuthOrSecret } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!requireAuthOrSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureLeadsTableOnce();
    const rows = await query<Record<string, string>>(
      `SELECT
         count(*) FILTER (WHERE hidden = false AND status IN ('discovered','researching','nurture'))::text AS active,
         count(*) FILTER (WHERE hidden = false AND status IN ('qualified','ready_for_outreach'))::text AS qualified,
         count(*) FILTER (WHERE hidden = false AND status = 'contacted')::text AS contacted,
         count(*) FILTER (WHERE hidden = false AND status IN ('replied','discovery_discussion','proposal_or_pilot'))::text AS replied,
         count(*) FILTER (WHERE hidden = false AND status = 'won')::text AS won,
         count(*) FILTER (WHERE hidden = true)::text AS archived
       FROM leads`
    );
    const row = rows[0] ?? {};
    const counts: Record<string, number> = {};
    for (const key of ['active', 'qualified', 'contacted', 'replied', 'won', 'archived']) {
      counts[key] = parseInt(row[key] ?? '0', 10) || 0;
    }
    return NextResponse.json({ counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
