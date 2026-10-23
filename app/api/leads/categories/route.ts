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
    const rows = await query<{ category: string; count: string }>(
      `SELECT category, count(*)::text AS count
       FROM leads
       WHERE status <> 'hidden'
       GROUP BY category
       ORDER BY count(*) DESC, category ASC`
    );
    const categories = rows.map((r) => ({
      name: r.category || 'Other',
      count: parseInt(r.count, 10),
    }));
    return NextResponse.json({ categories });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
