import { NextResponse } from 'next/server';
import { query, ensureLeadsTableOnce } from '@/lib/db';
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
  category?: unknown;
  status?: unknown;
};

const LEAD_STATUS_VALUES = ['new', 'contacted', 'applied', 'hidden'];

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

const mapRow = (r: Record<string, unknown>): Lead =>
  ({
    ...r,
    contact: (r.contact ?? {}) as LeadContact,
    recency: new Date(r.recency as string).toISOString(),
    created_at: new Date(r.created_at as string).toISOString(),
    updated_at: new Date(r.updated_at as string).toISOString(),
  }) as unknown as Lead;

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

  const platform = asStr(body.platform, 50) ?? 'Other';
  const category = asStr(body.category, 80) ?? 'Other';
  const statusRaw = asStr(body.status, 20);
  const status = (statusRaw && LEAD_STATUS_VALUES.includes(statusRaw) ? statusRaw : 'new') as Lead['status'];

  const validationPassed =
    body.validation_passed && typeof body.validation_passed === 'object' && !Array.isArray(body.validation_passed)
      ? Object.fromEntries(
          Object.entries(body.validation_passed as Record<string, unknown>)
            .slice(0, 12)
            .map(([k, v]) => [k.slice(0, 40), asBool(v)])
        )
      : null;

  try {
    await ensureLeadsTableOnce();

    const existing = await query<{ id: string }>(
      `SELECT id FROM leads WHERE business = $1 AND post_url IS NOT DISTINCT FROM $2 LIMIT 1`,
      [business, cleanContact.post_url]
    );
    if (existing.length > 0) {
      return NextResponse.json({ ok: true, duplicate: true, id: existing[0].id });
    }

    const rows = await query<{ id: string }>(
      `INSERT INTO leads (business, need, why_suits, contact, recency, platform, remote_eligible_pak, validation_passed, score, pitch_angle, case_study, category, status)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        business,
        need,
        asStr(body.why_suits, 1000),
        JSON.stringify(cleanContact),
        recencyIso,
        platform,
        asBool(body.remote_eligible_pak),
        validationPassed ? JSON.stringify(validationPassed) : null,
        asScore(body.score),
        asStr(body.pitch_angle, 1000),
        asStr(body.case_study, 500),
        category,
        status,
      ]
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, duplicate: true, id: null });
    }
    return NextResponse.json({ ok: true, duplicate: false, id: rows[0].id });
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
  const category = url.searchParams.get('category');
  const statusParam = url.searchParams.get('status');

  try {
    await ensureLeadsTableOnce();

    const conditions: string[] = [];
    const values: unknown[] = [];
    const add = (clause: string, ...vals: unknown[]) => {
      for (const v of vals) values.push(v);
      let idx = values.length - vals.length;
      conditions.push(clause.replace(/\?/g, () => `$${++idx}`));
    };

    if (statusParam === 'all' || !statusParam) {
      conditions.push("status <> 'hidden'");
    } else if (LEAD_STATUS_VALUES.includes(statusParam)) {
      add('status = $?', statusParam);
    }
    if (category && category !== 'All') {
      add('category = $?', category);
    }
    if (remote === 'true') {
      add('remote_eligible_pak = true');
    }
    if (platform && platform !== 'All') {
      add('platform = $?', platform);
    }
    if (days) {
      const n = parseInt(days, 10);
      if (Number.isFinite(n) && n > 0) {
        add('recency >= now() - ($? || \' days\')::interval', String(n));
      }
    }
    if (search) {
      const q = search.trim().slice(0, 100);
      if (q) {
        add('(business ILIKE $? OR need ILIKE $?)', `%${q}%`, `%${q}%`);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const leads = await query<Record<string, unknown>>(
      `SELECT * FROM leads ${where} ORDER BY recency DESC, created_at DESC LIMIT 500`,
      values
    );
    return NextResponse.json({ leads: leads.map(mapRow) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!requireAuthOrSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = body && typeof body.id === 'string' ? body.id : null;
  const status = body && typeof body.status === 'string' ? body.status : null;

  if (!id || !status || !LEAD_STATUS_VALUES.includes(status)) {
    return NextResponse.json(
      { error: 'id and a valid status (new | contacted | applied | hidden) are required' },
      { status: 400 }
    );
  }

  try {
    await ensureLeadsTableOnce();
    await query(
      `UPDATE leads SET status = $1, updated_at = now() WHERE id = $2::uuid`,
      [status, id]
    );
    return NextResponse.json({ ok: true, id, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
