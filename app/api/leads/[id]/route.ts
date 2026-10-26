import { NextResponse } from 'next/server';
import { query, ensureLeadsTableOnce } from '@/lib/db';
import { requireAuthOrSecret } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!requireAuthOrSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = params?.id;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Valid id required' }, { status: 400 });
  }

  try {
    await ensureLeadsTableOnce();
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM leads WHERE id = $1::uuid LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    const row = rows[0];
    return NextResponse.json({
      lead: {
        ...row,
        contact: (row.contact ?? {}) as Record<string, unknown>,
        details: (row.details ?? {}) as Record<string, unknown>,
        recency: new Date(row.recency as string).toISOString(),
        created_at: new Date(row.created_at as string).toISOString(),
        updated_at: new Date(row.updated_at as string).toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!requireAuthOrSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = params?.id || new URL(req.url).searchParams.get('id');
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Valid id required' }, { status: 400 });
  }

  try {
    await ensureLeadsTableOnce();
    await query(`DELETE FROM leads WHERE id = $1::uuid`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
