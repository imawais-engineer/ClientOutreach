import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAuthOrSecret } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!requireAuthOrSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('leads')
    .select('category')
    .neq('status', 'hidden');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const c = row.category || 'Other';
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const categories = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return NextResponse.json({ categories });
}
