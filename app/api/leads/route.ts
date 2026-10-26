import { NextResponse } from 'next/server';
import { query, ensureLeadsTableOnce } from '@/lib/db';
import { checkApiSecret, requireAuthOrSecret } from '@/lib/auth';
import { LIFECYCLE, type Lead, type LeadContact, type LeadDetails, type LeadStatus } from '@/lib/leads';

export const dynamic = 'force-dynamic';

const LEAD_STATUS_VALUES: readonly string[] = LIFECYCLE;
const CLASSIFICATIONS = ['priority', 'potential', 'deprioritize'];
const EVIDENCE_LEVELS = ['direct', 'plausible', 'weak'];

const CARD_COLUMNS = `id, business, business_key, need, why_suits, relevant_service, contact,
  recency, platform, source, city, country, category, status, hidden, opt_out,
  weighted_score, classification, evidence_level, score, last_contact_at, next_follow_up_at,
  outcome, human_review_required, case_study, pitch_angle, remote_eligible_pak,
  validation_passed, created_at, updated_at`;

const asStr = (v: unknown, max = 2000): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
};

const asBool = (v: unknown): boolean => v === true || v === 'true';

const asScore = (v: unknown, fallback: number | null): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
};

const businessKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

type Payload = Record<string, unknown>;

const cleanContact = (raw: Partial<LeadContact>): LeadContact => ({
  profile_url: asStr(raw.profile_url, 500),
  dm_link: asStr(raw.dm_link, 500),
  email: asStr(raw.email, 200),
  phone: asStr(raw.phone, 50),
  post_url: asStr(raw.post_url, 500),
  application_url: asStr(raw.application_url, 500),
  website: asStr(raw.website, 500),
});

const cleanDetails = (raw: unknown): LeadDetails => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const d = raw as LeadDetails;
  return {
    ...d,
    evidence: Array.isArray(d.evidence) ? d.evidence.slice(0, 25) : [],
    contacts: Array.isArray(d.contacts) ? d.contacts.slice(0, 10) : [],
    change_log: Array.isArray(d.change_log) ? d.change_log.slice(-50) : [],
    communication: Array.isArray(d.communication) ? d.communication.slice(-100) : [],
  };
};

const evidenceKey = (e: { source?: string | null; url?: string | null }): string =>
  `${e.source ?? ''}|${e.url ?? ''}`.toLowerCase();

const mergeEvidence = (
  existing: LeadDetails['evidence'] = [],
  incoming: LeadDetails['evidence'] = []
): LeadDetails['evidence'] => {
  const seen = new Set(existing.map(evidenceKey));
  const merged = [...existing];
  for (const entry of incoming) {
    const key = evidenceKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }
  return merged;
};

const STATUS_RANK: Record<string, number> = {
  discovered: 0,
  researching: 1,
  qualified: 2,
  ready_for_outreach: 3,
  contacted: 4,
  replied: 5,
  discovery_discussion: 6,
  proposal_or_pilot: 7,
  won: 8,
  nurture: 1,
  lost: 8,
  disqualified: 8,
  do_not_contact: 9,
};

export async function POST(req: Request) {
  if (!checkApiSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Payload;
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

  const key = asStr(body.business_key, 120) ?? businessKey(business);
  if (!key) {
    return NextResponse.json({ error: 'business key could not be derived' }, { status: 400 });
  }

  const contact = cleanContact(
    (body.contact && typeof body.contact === 'object' ? body.contact : {}) as Partial<LeadContact>
  );

  const recencyRaw = asStr(body.posted_at, 40) ?? asStr(body.recency, 40) ?? new Date().toISOString();
  const recency = new Date(recencyRaw);
  const recencyIso = isNaN(recency.getTime()) ? new Date().toISOString() : recency.toISOString();

  const weighted = asScore(body.weighted_score, null);
  const classification = asStr(body.classification, 20);
  const evidenceLevel = asStr(body.evidence_level, 20);
  const details = cleanDetails(body.details);
  const platform = asStr(body.platform, 60) ?? 'Other';
  const sourceId = asStr(body.source, 40) ?? 'manual';
  const category = asStr(body.category, 80) ?? 'Other';
  const statusRaw = asStr(body.status, 30);
  const incomingStatus =
    statusRaw && LEAD_STATUS_VALUES.includes(statusRaw) ? statusRaw : 'discovered';

  if (classification && !CLASSIFICATIONS.includes(classification)) {
    return NextResponse.json({ error: 'invalid classification' }, { status: 400 });
  }
  if (evidenceLevel && !EVIDENCE_LEVELS.includes(evidenceLevel)) {
    return NextResponse.json({ error: 'invalid evidence_level' }, { status: 400 });
  }

  try {
    await ensureLeadsTableOnce();

    const existing = await query<{
      id: string;
      weighted_score: number | null;
      status: string;
      contact: LeadContact;
      details: LeadDetails;
      opt_out: boolean;
      hidden: boolean;
      city: string | null;
      country: string | null;
      relevant_service: string | null;
      why_suits: string | null;
      case_study: string | null;
      pitch_angle: string | null;
      evidence_level: string | null;
      classification: string | null;
    }>(
      `SELECT id, weighted_score, status, contact, details, opt_out, hidden, city, country,
              relevant_service, why_suits, case_study, pitch_angle, evidence_level, classification
       FROM leads WHERE business_key = $1 LIMIT 1`,
      [key]
    );

    if (existing.length === 0) {
      const rows = await query<{ id: string }>(
        `INSERT INTO leads (business, business_key, need, why_suits, relevant_service, contact,
           recency, platform, source, city, country, remote_eligible_pak, validation_passed,
           score, weighted_score, classification, evidence_level, pitch_angle, case_study,
           category, status, details)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb,
                 $14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb)
         RETURNING id`,
        [
          business,
          key,
          need,
          asStr(body.why_suits, 1000),
          asStr(body.relevant_service, 200),
          JSON.stringify(contact),
          recencyIso,
          platform,
          sourceId,
          asStr(body.city, 120),
          asStr(body.country, 120),
          asBool(body.remote_eligible_pak),
          body.validation_passed ? JSON.stringify(body.validation_passed) : null,
          weighted === null ? 5 : Math.round(weighted / 10),
          weighted,
          classification,
          evidenceLevel,
          asStr(body.pitch_angle, 1000),
          asStr(body.case_study, 500),
          category,
          incomingStatus,
          JSON.stringify(details),
        ]
      );
      return NextResponse.json({ ok: true, action: 'created', id: rows[0].id });
    }

    const row = existing[0];
    const existingWeight = row.weighted_score ?? -1;
    const incomingWins = weighted !== null && weighted > existingWeight;

    const mergedContact: LeadContact = { ...row.contact };
    for (const [k, v] of Object.entries(contact)) {
      const field = k as keyof LeadContact;
      if (!mergedContact[field] && v) mergedContact[field] = v;
    }

    const mergedDetails: LeadDetails = {
      ...row.details,
      ...details,
      evidence: mergeEvidence(row.details?.evidence ?? [], details.evidence ?? []),
      contacts: [...(row.details?.contacts ?? []), ...(details.contacts ?? [])].slice(0, 10),
    };

    const nextStatus =
      STATUS_RANK[incomingStatus] > (STATUS_RANK[row.status] ?? 0) ? incomingStatus : row.status;

    await query(
      `UPDATE leads SET
         business = $2,
         need = CASE WHEN $3 THEN $4 ELSE need END,
         why_suits = COALESCE(why_suits, $5),
         relevant_service = COALESCE(relevant_service, $6),
         contact = $7::jsonb,
         recency = GREATEST(recency, $8::timestamptz),
         platform = CASE WHEN $3 THEN $9 ELSE platform END,
         source = CASE WHEN $3 THEN $10 ELSE source END,
         city = COALESCE(city, $11),
         country = COALESCE(country, $12),
         remote_eligible_pak = remote_eligible_pak OR $13,
         weighted_score = GREATEST(COALESCE(weighted_score, -1), COALESCE($14::smallint, -1)),
         classification = CASE WHEN $3 THEN $15 ELSE classification END,
         evidence_level = CASE WHEN $3 THEN $16 ELSE COALESCE(evidence_level, $16) END,
         score = COALESCE($17, score),
         pitch_angle = COALESCE(pitch_angle, $18),
         case_study = COALESCE(case_study, $19),
         category = CASE WHEN $20 IN ('Other', 'Uncategorized', '') THEN category ELSE $20 END,
         status = $21,
         opt_out = opt_out OR $22,
         hidden = hidden OR $23,
         details = $24::jsonb,
         updated_at = now()
       WHERE id = $1::uuid`,
      [
        row.id,
        business,
        incomingWins,
        need,
        asStr(body.why_suits, 1000),
        asStr(body.relevant_service, 200),
        JSON.stringify(mergedContact),
        recencyIso,
        platform,
        sourceId,
        asStr(body.city, 120),
        asStr(body.country, 120),
        asBool(body.remote_eligible_pak),
        weighted,
        classification,
        evidenceLevel,
        weighted === null ? null : Math.round(weighted / 10),
        asStr(body.pitch_angle, 1000),
        asStr(body.case_study, 500),
        category,
        nextStatus,
        asBool(body.opt_out),
        false,
        JSON.stringify(mergedDetails),
      ]
    );

    return NextResponse.json({
      ok: true,
      action: 'merged',
      id: row.id,
      evidence_entries: mergedDetails.evidence?.length ?? 0,
    });
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
  const source = url.searchParams.get('source');
  const remote = url.searchParams.get('remote');
  const days = url.searchParams.get('days');
  const search = url.searchParams.get('search');
  const category = url.searchParams.get('category');
  const statusParam = url.searchParams.get('status');
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') ?? '60', 10) || 60));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);

  try {
    await ensureLeadsTableOnce();

    const conditions: string[] = ['hidden = false'];
    const values: unknown[] = [];
    const add = (clause: string, ...vals: unknown[]) => {
      for (const v of vals) values.push(v);
      let idx = values.length - vals.length;
      conditions.push(clause.replace(/\?/g, () => `$${++idx}`));
    };

    if (statusParam && statusParam !== 'all') {
      if (!LEAD_STATUS_VALUES.includes(statusParam)) {
        return NextResponse.json({ error: 'invalid status filter' }, { status: 400 });
      }
      add('status = ?', statusParam);
    }
    if (category && category !== 'All') add('category = ?', category);
    if (platform && platform !== 'All') add('platform = ?', platform);
    if (source && source !== 'All') add('source = ?', source);
    if (remote === 'true') conditions.push('remote_eligible_pak = true');
    if (days) {
      const n = parseInt(days, 10);
      if (Number.isFinite(n) && n > 0) {
        add("recency >= now() - (?::text || ' days')::interval", String(n));
      }
    }
    if (search) {
      const q = search.trim().slice(0, 100);
      if (q) add('(business ILIKE ? OR need ILIKE ?)', `%${q}%`, `%${q}%`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const leads = await query<Record<string, unknown>>(
      `SELECT ${CARD_COLUMNS} FROM leads ${where}
       ORDER BY weighted_score DESC NULLS LAST, recency DESC, created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values
    );

    const [{ count }] = await query<{ count: string }>(
      `SELECT count(*)::text AS count FROM leads ${where}`,
      values
    );

    return NextResponse.json({
      leads: leads.map((r) => ({
        ...r,
        contact: (r.contact ?? {}) as LeadContact,
        recency: new Date(r.recency as string).toISOString(),
        created_at: new Date(r.created_at as string).toISOString(),
        updated_at: new Date(r.updated_at as string).toISOString(),
      })),
      total: parseInt(count, 10),
      next_offset: offset + leads.length < parseInt(count, 10) ? offset + leads.length : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!requireAuthOrSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id');
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

export async function PATCH(req: Request) {
  if (!requireAuthOrSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const sets: string[] = [];
  const values: unknown[] = [body.id];

  const setColumn = (column: string, value: unknown, cast = '') => {
    values.push(value);
    sets.push(`${column} = $${values.length}${cast}`);
  };

  if (typeof body.status === 'string') {
    if (!LEAD_STATUS_VALUES.includes(body.status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    setColumn('status', body.status);
  }
  if (typeof body.outcome === 'string') {
    setColumn('outcome', body.outcome);
    sets.push('outcome_at = now()');
  }
  if (typeof body.opt_out === 'boolean') setColumn('opt_out', body.opt_out);
  if (typeof body.hidden === 'boolean') setColumn('hidden', body.hidden);
  if (typeof body.human_review_required === 'boolean') {
    setColumn('human_review_required', body.human_review_required);
  }
  if (typeof body.last_contact_at === 'string') {
    setColumn('last_contact_at', body.last_contact_at, '::timestamptz');
  }
  if (typeof body.next_follow_up_at === 'string') {
    setColumn('next_follow_up_at', body.next_follow_up_at, '::timestamptz');
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }
  sets.push('updated_at = now()');

  try {
    await ensureLeadsTableOnce();

    if (body.status === 'contacted' || body.status === 'won') {
      const rows = await query<{ last_contact_at: string | null }>(
        `SELECT last_contact_at FROM leads WHERE id = $1::uuid`,
        [body.id]
      );
      const hasEvidence = rows.length > 0 && (rows[0].last_contact_at || body.last_contact_at);
      if (!hasEvidence) {
        return NextResponse.json(
          { error: `status '${body.status}' needs a verified contact date first` },
          { status: 409 }
        );
      }
    }

    await query(`UPDATE leads SET ${sets.join(', ')} WHERE id = $1::uuid`, values);
    return NextResponse.json({ ok: true, id: body.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
