import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { checkApiSecret, requireAuthOrSecret } from '@/lib/auth';
import type { Lead, LeadContact } from '@/lib/leads';

export const dynamic = 'force-dynamic';

type LeadPayload = {
  business?: unknown;
  need?: unknown;
  why_suits?: unknown;
  contact?: Partial<LeadContact>;
  recency?: unknown;
  platform?: unknown;
  remote_eligible_pak?: unknown;
  validation_passed?: unknown;
  score?: unknown;
  pitch_angle?: unknown;
  case_study?: unknown;
};

const asStr = (v: unknown, max = 2000): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
};

const asBool = (v: unknown): boolean => v === true || v === 'true';

const asScore = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 5;
  return Math.min(10, Math.max(0, Math.round(n)));
};

const PLATFORM_VALUES = ['Google Maps', 'Instagram', 'Threads', 'Facebook', 'Job Boards'];

export async function POST(req: Request) {
  if (!checkApiSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: LeadPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const business = asStr(body.business, 200);
  const need = asStr(body.need, 300);
  if (!business || !need) {
    return NextResponse.json(
      { error: 'business and need are required strings' },
      { status: 400 }
    );
  }

  const contact = (body.contact && typeof body.contact === 'object' ? body.contact : {}) as Partial<LeadContact>;
  const cleanContact: LeadContact = {
    profile_url: asStr(contact.profile_url, 500),
    dm_link: asStr(contact.dm_link, 500),
    email: asStr(contact.email, 200),
    phone: asStr(contact.phone, 50),
    post_url: asStr(contact.post_url, 500),
    application_url: asStr(contact.application_url, 500),
  };

  const recencyRaw = asStr(body.recency, 40) ?? new Date().toISOString();
  const recency = new Date(recencyRaw);
  const recencyIso = isNaN(recency.getTime()) ? new Date().toISOString() : recency.toISOString();

  const platformRaw = asStr(body.platform, 50) ?? 'Other';
  const platform = PLATFORM_VALUES.includes(platformRaw) ? platformRaw : platformRaw;

  const validationPassed =
    body.validation_passed && typeof body.validation_passed === 'object' && !Array.isArray(body.validation_passed)
      ? Object.fromEntries(
          Object.entries(body.validation_passed as Record<string, unknown>)
            .slice(0, 12)
            .map(([k, v]) => [k.slice(0, 40), asBool(v)])
        )
      : null;

  const row = {
    business,
    need,
    why_suits: asStr(body.why_suits, 1000),
    contact: cleanContact,
    recency: recencyIso,
    platform,
    remote_eligible_pak: asBool(body.remote_eligible_pak),
    validation_passed: validationPassed,
    score: asScore(body.score),
    pitch_angle: asStr(body.pitch_angle, 1000),
    case_study: asStr(body.case_study, 500),
  };

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('leads')
      .upsert(row, { onConflict: 'business,post_url', ignoreDuplicates: true })
      .select('id')
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, duplicate: !data, id: data?.id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Insert failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!requireAuthOrSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const platform = url.searchParams.get('platform');
  const remote = url.searchParams.get('remote');
  const days = url.searchParams.get('days');
  const search = url.searchParams.get('search');

  const supabase = getSupabaseAdmin();
  let query = supabase.from('leads').select('*').order('recency', { ascending: false });

  if (platform && platform !== 'All') {
    query = query.eq('platform', platform);
  }
  if (remote === 'true') {
    query = query.eq('remote_eligible_pak', true);
  }
  if (days) {
    const n = parseInt(days, 10);
    if (Number.isFinite(n) && n > 0) {
      const cutoff = new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('recency', cutoff);
      query = query.order('recency', { ascending: false });
    }
  }
  if (search) {
    const q = search.replace(/[%,()]/g, '').trim();
    if (q) {
      query = query.or(`business.ilike.%${q}%,need.ilike.%${q}%`);
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ leads: (data ?? []) as Lead[] });
}
