import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { query, ensureLeadsTableOnce } from '@/lib/db';
import { isAuthed } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { LeadActions } from '@/components/lead-actions';
import { OutreachCards } from '@/components/outreach-cards';
import {
  STATUS_GROUPS,
  STATUS_LABELS,
  businessDescription,
  composeMessage,
  skillsForLead,
  type Lead,
  type LeadDetails,
  type StatusGroup,
} from '@/lib/leads';
import { ArrowLeft, ExternalLink, Globe, MapPin, Quote } from 'lucide-react';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const groupFor = (status: string): StatusGroup => {
  for (const [group, statuses] of Object.entries(STATUS_GROUPS)) {
    if ((statuses as readonly string[]).includes(status)) return group as StatusGroup;
  }
  return 'active';
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-zinc-200">{children}</dd>
    </div>
  );
}

export default async function LeadDetail({ params }: { params: { id: string } }) {
  if (!isAuthed()) redirect('/login');
  if (!UUID_RE.test(params.id)) notFound();

  await ensureLeadsTableOnce();
  const rows = await query<Record<string, unknown>>(`SELECT * FROM leads WHERE id = $1::uuid LIMIT 1`, [
    params.id,
  ]);
  if (rows.length === 0) notFound();

  const lead = {
    ...rows[0],
    contact: (rows[0].contact ?? {}) as Record<string, string | null>,
    details: (rows[0].details ?? {}) as LeadDetails,
  } as unknown as Lead;

  const details = lead.details ?? {};
  const evidence = (details.evidence ?? []).filter((e) => e.summary || e.url).slice(0, 3);
  const skills = skillsForLead(lead);
  const description = businessDescription(lead);
  const location = [lead.city, lead.country].filter(Boolean).join(', ');
  const portfolio = lead.case_study?.trim() || null;
  const draft = composeMessage(lead);

  return (
    <AppShell active={groupFor(lead.status)}>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to leads
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold leading-tight text-zinc-50">{lead.business}</h1>
          <span className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
            {STATUS_LABELS[lead.status] ?? lead.status}
          </span>
        </div>

        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">{description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {lead.contact?.website && (
            <a
              href={lead.contact.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sky-400 hover:underline"
            >
              <Globe className="h-3.5 w-3.5" />
              {lead.contact.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          )}
          {location && (
            <span className="inline-flex items-center gap-1.5 text-zinc-400">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </span>
          )}
          <span className="text-zinc-500">{lead.category}</span>
        </div>
      </header>

      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-semibold text-zinc-100">Why this lead matches</h2>

        <dl className="mt-4 space-y-5">
          <Row label="Why it matches">{lead.why_suits?.trim() || lead.need}</Row>

          {skills.length > 0 && (
            <Row label="Skills I can offer">
              <span className="flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300"
                  >
                    {skill}
                  </span>
                ))}
              </span>
            </Row>
          )}

          <Row label="Supporting proof">
            {evidence.length === 0 ? (
              <span className="text-zinc-500">No proof recorded for this lead.</span>
            ) : (
              <span className="block space-y-2.5">
                {evidence.map((entry, i) => (
                  <span
                    key={`${entry.url ?? i}`}
                    className="block rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5"
                  >
                    <span className="flex gap-2 text-zinc-300">
                      <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
                      <span className="line-clamp-3">{entry.summary}</span>
                    </span>
                    {entry.url && (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {entry.source ?? 'source'}
                      </a>
                    )}
                  </span>
                ))}
              </span>
            )}
          </Row>

          <Row label="Opportunity">{lead.pitch_angle?.trim() || lead.need}</Row>

          {portfolio && (
            <Row label="Relevant project">
              <a
                href={portfolio}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sky-400 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {portfolio.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </Row>
          )}
        </dl>
      </section>

      <div className="mt-4">
        <OutreachCards
          initialMessage={draft}
          email={lead.contact?.email}
          phone={lead.contact?.phone}
          country={lead.country}
          website={lead.contact?.website}
          profileUrl={lead.contact?.profile_url ?? lead.contact?.dm_link}
        />
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
        <LeadActions
          id={lead.id}
          status={lead.status}
          hidden={lead.hidden}
          optOut={lead.opt_out}
          hasContactDate={Boolean(lead.last_contact_at)}
        />
      </div>
    </AppShell>
  );
}
