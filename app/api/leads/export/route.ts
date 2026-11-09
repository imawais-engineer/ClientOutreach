import { NextResponse } from 'next/server';
import { query, ensureLeadsTableOnce } from '@/lib/db';
import { requireAuthOrSecret } from '@/lib/auth';
import {
  LIFECYCLE,
  STATUS_LABELS,
  composeMessage,
  whatsappLink,
  type LeadStatus,
} from '@/lib/leads';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

const FORMATS = ['csv', 'json', 'md'] as const;
type Format = (typeof FORMATS)[number];

const CSV_COLUMNS: { header: string; get: (r: Row) => unknown }[] = [
  { header: 'business', get: (r) => r.business },
  { header: 'business_key', get: (r) => r.business_key },
  { header: 'status', get: (r) => r.status },
  { header: 'category', get: (r) => r.category },
  { header: 'platform', get: (r) => r.platform },
  { header: 'source', get: (r) => r.source },
  { header: 'country', get: (r) => r.country },
  { header: 'city', get: (r) => r.city },
  { header: 'need', get: (r) => r.need },
  { header: 'relevant_service', get: (r) => r.relevant_service },
  { header: 'weighted_score', get: (r) => r.weighted_score },
  { header: 'score', get: (r) => r.score },
  { header: 'classification', get: (r) => r.classification },
  { header: 'evidence_level', get: (r) => r.evidence_level },
  { header: 'outcome', get: (r) => r.outcome },
  { header: 'email', get: (r) => contact(r).email },
  { header: 'phone', get: (r) => contact(r).phone },
  { header: 'whatsapp', get: (r) => whatsapp(r) },
  { header: 'website', get: (r) => contact(r).website },
  { header: 'post_url', get: (r) => contact(r).post_url },
  { header: 'profile_url', get: (r) => contact(r).profile_url },
  { header: 'dm_link', get: (r) => contact(r).dm_link },
  { header: 'application_url', get: (r) => contact(r).application_url },
  { header: 'why_suits', get: (r) => r.why_suits },
  { header: 'pitch_angle', get: (r) => r.pitch_angle },
  { header: 'case_study', get: (r) => r.case_study },
  { header: 'outreach_message', get: (r) => composeMessage(asLead(r)) },
  { header: 'last_contact_at', get: (r) => r.last_contact_at },
  { header: 'next_follow_up_at', get: (r) => r.next_follow_up_at },
  { header: 'human_review_required', get: (r) => r.human_review_required },
  { header: 'opt_out', get: (r) => r.opt_out },
  { header: 'hidden', get: (r) => r.hidden },
  { header: 'created_at', get: (r) => r.created_at },
  { header: 'updated_at', get: (r) => r.updated_at },
  { header: 'details_json', get: (r) => r.details },
];

function contact(r: Row): Record<string, string | null> {
  return (r.contact ?? {}) as Record<string, string | null>;
}

function whatsapp(r: Row): string | null {
  return whatsappLink(
    contact(r).phone,
    typeof r.country === 'string' ? r.country : null,
    null
  );
}

function asLead(r: Row) {
  return {
    need: String(r.need ?? ''),
    pitch_angle: (r.pitch_angle as string | null) ?? null,
    why_suits: (r.why_suits as string | null) ?? null,
    case_study: (r.case_study as string | null) ?? null,
  };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Row[]): string {
  const header = CSV_COLUMNS.map((c) => c.header).join(',');
  const lines = rows.map((r) => CSV_COLUMNS.map((c) => csvCell(c.get(r))).join(','));
  return [header, ...lines].join('\r\n') + '\r\n';
}

function toJson(rows: Row[], meta: Record<string, unknown>): string {
  return JSON.stringify(
    {
      format: 'clientoutreach.leads.v1',
      exported_at: new Date().toISOString(),
      ...meta,
      count: rows.length,
      leads: rows,
    },
    null,
    2
  );
}

function mdCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function toMarkdown(rows: Row[], meta: Record<string, unknown>): string {
  const out: string[] = [];
  out.push('# ClientOutreach leads');
  out.push('');
  out.push(`Exported: ${new Date().toISOString()}`);
  out.push(`Count: ${rows.length}`);
  for (const [key, value] of Object.entries(meta)) {
    if (value === null || value === undefined) continue;
    out.push(`${key}: ${String(value)}`);
  }
  out.push('');

  const byStatus = new Map<string, number>();
  for (const r of rows) {
    const key = String(r.status ?? 'unknown');
    byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
  }
  out.push('## Summary');
  out.push('');
  for (const [status, n] of Array.from(byStatus.entries()).sort((a, b) => b[1] - a[1])) {
    out.push(`- ${STATUS_LABELS[status as LeadStatus] ?? status}: ${n}`);
  }
  out.push('');

  out.push('## All leads');
  out.push('');
  out.push('| Business | Status | Service | Score | Country | Phone | WhatsApp | Evidence |');
  out.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    out.push(
      `| ${mdCell(r.business)} | ${mdCell(r.status)} | ${mdCell(r.relevant_service)} | ` +
        `${mdCell(r.weighted_score)} | ${mdCell(r.country)} | ${mdCell(contact(r).phone)} | ` +
        `${mdCell(whatsapp(r))} | ${mdCell(r.evidence_level)} |`
    );
  }
  out.push('');

  out.push('## Detail');
  out.push('');
  for (const r of rows) {
    out.push(`### ${String(r.business ?? 'Unknown')}`);
    out.push('');
    out.push(`- Status: ${mdCell(r.status)}`);
    out.push(`- Source: ${mdCell(r.source)} · ${mdCell(r.platform)}`);
    out.push(`- Location: ${mdCell([r.city, r.country].filter(Boolean).join(', '))}`);
    out.push(`- Need: ${mdCell(r.need)}`);
    out.push(`- Service: ${mdCell(r.relevant_service)}`);
    out.push(`- Score: ${mdCell(r.weighted_score)} (${mdCell(r.classification)}), evidence ${mdCell(r.evidence_level)}`);
    if (contact(r).email) out.push(`- Email: ${contact(r).email}`);
    if (contact(r).phone) out.push(`- Phone: ${contact(r).phone}`);
    const wa = whatsapp(r);
    if (wa) out.push(`- WhatsApp: ${wa}`);
    if (contact(r).website) out.push(`- Website: ${contact(r).website}`);
    const details = (r.details ?? {}) as { evidence?: { url?: string | null; summary?: string | null }[] };
    const evidence = Array.isArray(details.evidence) ? details.evidence : [];
    if (evidence.length) {
      out.push('- Evidence:');
      for (const e of evidence.slice(0, 5)) {
        if (e?.url) out.push(`  - ${e.url}`);
      }
    }
    out.push('');
    out.push('```');
    out.push(composeMessage(asLead(r)));
    out.push('```');
    out.push('');
  }
  return out.join('\n');
}

const stamp = (): string => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);

export async function GET(req: Request) {
  if (!requireAuthOrSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawFormat = (url.searchParams.get('format') ?? 'csv').toLowerCase();
  const format = (rawFormat === 'markdown' ? 'md' : rawFormat) as Format;
  if (!FORMATS.includes(format)) {
    return NextResponse.json(
      { error: `format must be one of ${FORMATS.join(', ')}` },
      { status: 400 }
    );
  }

  const status = url.searchParams.get('status');
  const include = url.searchParams.get('include');

  try {
    await ensureLeadsTableOnce();

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (status === 'archived') {
      conditions.push('hidden = true');
    } else if (include === 'all') {
      // no visibility filter
    } else {
      conditions.push('hidden = false');
    }

    if (status && status !== 'all' && status !== 'archived') {
      if (!(LIFECYCLE as readonly string[]).includes(status)) {
        return NextResponse.json({ error: 'invalid status filter' }, { status: 400 });
      }
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query<Row>(
      `SELECT * FROM leads ${where}
       ORDER BY weighted_score DESC NULLS LAST, recency DESC, created_at DESC`,
      values
    );

    const meta = { status_filter: status ?? 'all', includes_archived: status === 'archived' || include === 'all' };

    let body: string;
    let contentType: string;

    if (format === 'csv') {
      body = toCsv(rows);
      contentType = 'text/csv; charset=utf-8';
    } else if (format === 'json') {
      body = toJson(rows, meta);
      contentType = 'application/json; charset=utf-8';
    } else {
      body = toMarkdown(rows, meta);
      contentType = 'text/markdown; charset=utf-8';
    }

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="clientoutreach-leads-${stamp()}.${format}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
