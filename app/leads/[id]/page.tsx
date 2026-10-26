import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { query, ensureLeadsTableOnce } from '@/lib/db';
import { isAuthed } from '@/lib/auth';
import { LeadActions } from '@/components/lead-actions';
import { STATUS_LABELS, type Lead, type LeadDetails } from '@/lib/leads';
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Mail,
  Phone,
  FileText,
  MapPin,
  ShieldAlert,
  CheckCircle2,
  CircleDashed,
  History,
  Sparkles,
  ClipboardList,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fmtDate = (value?: string | null): string => {
  if (!value) return 'Unknown';
  const d = new Date(value);
  if (isNaN(d.getTime())) return 'Unknown';
  return d.toISOString().slice(0, 10);
};

const show = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'Unknown';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : 'Unknown';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-zinc-200">{children}</dd>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-100">
        <span className="text-zinc-500">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function LeadDetail({ params }: { params: { id: string } }) {
  if (!isAuthed()) redirect('/login');
  if (!UUID_RE.test(params.id)) notFound();

  await ensureLeadsTableOnce();
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM leads WHERE id = $1::uuid LIMIT 1`,
    [params.id]
  );
  if (rows.length === 0) notFound();

  const lead = {
    ...rows[0],
    contact: (rows[0].contact ?? {}) as Record<string, string | null>,
    details: (rows[0].details ?? {}) as LeadDetails,
    recency: new Date(rows[0].recency as string).toISOString(),
  } as unknown as Lead;
  const d: LeadDetails = lead.details ?? {};
  const scores = d.scores ?? {};
  const evidence = d.evidence ?? [];
  const contacts = d.contacts ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            All leads
          </Link>
          <span className="text-xs uppercase tracking-wider text-zinc-500">Lead detail</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-zinc-50">{lead.business}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-zinc-300">{lead.category}</span>
              <span className="rounded-full border border-zinc-800 px-2.5 py-1 text-zinc-400">
                {lead.platform}
              </span>
              {lead.city && (
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 px-2.5 py-1 text-zinc-400">
                  <MapPin className="h-3 w-3" />
                  {lead.city}
                  {lead.country ? `, ${lead.country}` : ''}
                </span>
              )}
              <span className="rounded-full border border-zinc-800 px-2.5 py-1 text-zinc-400">
                {STATUS_LABELS[lead.status] ?? lead.status}
              </span>
              {lead.opt_out && (
                <span className="rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-1 font-semibold text-red-400">
                  Do not contact
                </span>
              )}
              {lead.human_review_required && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-amber-400">
                  Needs human review
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-center">
              <p className="text-2xl font-bold tabular-nums text-white">{lead.weighted_score ?? '–'}</p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">score /100</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-center">
              <p className="text-sm font-semibold capitalize text-zinc-200">
                {lead.classification ?? 'unscored'}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">priority</p>
            </div>
          </div>
        </div>

        <LeadActions
          id={lead.id}
          status={lead.status}
          optOut={lead.opt_out}
          hasContactDate={Boolean(lead.last_contact_at)}
        />

        <Section title="Overview" icon={<ClipboardList className="h-4 w-4" />}>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Website">
              {lead.contact.website ? (
                <a
                  href={lead.contact.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {lead.contact.website.replace(/^https?:\/\//, '').slice(0, 40)}
                </a>
              ) : (
                'Unknown'
              )}
            </Field>
            <Field label="Source URL">
              {lead.contact.post_url ? (
                <a
                  href={lead.contact.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Open listing
                </a>
              ) : (
                'Unknown'
              )}
            </Field>
            <Field label="Posted">{fmtDate(lead.recency)}</Field>
            <Field label="Source">{show(lead.source)}</Field>
            <Field label="Opportunity type">{show(d.opportunity_type)}</Field>
            <Field label="Engagement type">{show(d.engagement_type)}</Field>
            <Field label="Job title">{show(d.job_title)}</Field>
            <Field label="Listing status">{show(d.listing_status)}</Field>
            <Field label="Advertised services">{show(d.advertised_services)}</Field>
          </dl>
        </Section>

        <Section title="Evidence" icon={<ShieldAlert className="h-4 w-4" />}>
          <div className="space-y-3">
            {evidence.length === 0 ? (
              <p className="text-sm text-zinc-500">No evidence recorded.</p>
            ) : (
              evidence.map((e, i) => (
                <div key={`${e.url ?? i}`} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
                    <span>{e.source ?? 'source'}</span>
                    {e.tier && <span>· {e.tier}</span>}
                    {e.observed_at && <span>· {fmtDate(e.observed_at)}</span>}
                    <span className={e.verification === 'verified' ? 'text-emerald-400' : 'text-amber-400'}>
                      · {e.verification ?? 'unverified'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-zinc-200">{e.summary ?? 'No summary'}</p>
                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {e.url.slice(0, 70)}
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Observed evidence">{show(d.observed_evidence)}</Field>
            <Field label="Confirmed requirement">{show(d.confirmed_requirement)}</Field>
            <Field label="Confirmed pain">{show(d.confirmed_pain)}</Field>
            <Field label="Confirmed buying intent">{show(d.confirmed_buying_intent)}</Field>
            <Field label="Missing information">{show(d.missing_information)}</Field>
            <Field label="Evidence level">{show(lead.evidence_level)}</Field>
          </dl>
        </Section>

        <Section title="The opportunity" icon={<Sparkles className="h-4 w-4" />}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Opportunity">{lead.need}</Field>
            <Field label="Why it fits">{show(lead.why_suits)}</Field>
            <Field label="Service to pitch">{show(lead.relevant_service)}</Field>
            <Field label="Outreach angle">{show(lead.pitch_angle)}</Field>
            <Field label="Portfolio proof">
              {lead.case_study ? (
                <a
                  href={lead.case_study}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open project
                </a>
              ) : (
                'Unknown'
              )}
            </Field>
            <Field label="Deliverables">{show(d.deliverables)}</Field>
            <Field label="Technologies">{show(d.technologies)}</Field>
            <Field label="Commercial terms">{show(d.commercial_terms)}</Field>
            <Field label="Proposed approach">{show(d.proposed_approach)}</Field>
          </dl>
        </Section>

        <Section title="Qualification" icon={<CheckCircle2 className="h-4 w-4" />}>
          <div className="space-y-2">
            {Object.keys(scores).length === 0 ? (
              <p className="text-sm text-zinc-500">No dimension scores recorded.</p>
            ) : (
              Object.entries(scores).map(([dimension, entry]) => {
                const value = typeof entry === 'object' && entry ? entry.score : 0;
                const pct = Math.max(0, Math.min(100, (Number(value) / 5) * 100));
                return (
                  <div key={dimension}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-zinc-300">
                        {dimension.replace(/_/g, ' ')}
                      </span>
                      <span className="tabular-nums text-zinc-500">
                        {value}/5
                        {typeof entry === 'object' && entry?.weight
                          ? ` · ${Math.round(entry.weight * 100)}%`
                          : ''}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    {typeof entry === 'object' && entry?.why && (
                      <p className="mt-1 text-[11px] text-zinc-500">{entry.why}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Verification">{show(d.verification_status)}</Field>
            <Field label="Commercial suitability">{show(d.commercial_suitability)}</Field>
            <Field label="Skill fit">{show(d.skill_fit)}</Field>
            <Field label="Recommendation">{show(d.recommendation)}</Field>
            <Field label="Reason">{show(d.recommendation_reason)}</Field>
            <Field label="Contact eligibility">{show(d.contact_eligibility)}</Field>
          </dl>
        </Section>

        <Section title="Next step" icon={<CircleDashed className="h-4 w-4" />}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Next research step">{show(d.next_research_step)}</Field>
            <Field label="Next action">{show(d.next_action)}</Field>
            <Field label="Contact">{contacts[0] ? show(contacts[0].name) : 'Unknown'}</Field>
            <Field label="Role">{contacts[0] ? show(contacts[0].role) : 'Unknown'}</Field>
            <Field label="Outcome">{show(lead.outcome?.replace(/_/g, ' '))}</Field>
            <Field label="Channel">
              <span className="flex flex-wrap gap-2">
                {lead.contact.email && (
                  <a href={`mailto:${lead.contact.email}`} className="inline-flex items-center gap-1 text-sky-400">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </a>
                )}
                {lead.contact.phone && (
                  <a href={`tel:${lead.contact.phone}`} className="inline-flex items-center gap-1 text-sky-400">
                    <Phone className="h-3.5 w-3.5" />
                    Call
                  </a>
                )}
                {lead.contact.profile_url && (
                  <a href={lead.contact.profile_url} target="_blank" rel="noopener noreferrer" className="text-sky-400">
                    Profile
                  </a>
                )}
                {!lead.contact.email && !lead.contact.phone && !lead.contact.profile_url && 'Unknown'}
              </span>
            </Field>
          </dl>
        </Section>

        <Section title="History" icon={<History className="h-4 w-4" />}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Last contact">{lead.last_contact_at ? fmtDate(lead.last_contact_at) : 'None recorded'}</Field>
            <Field label="Next follow-up">{lead.next_follow_up_at ? fmtDate(lead.next_follow_up_at) : 'Not scheduled'}</Field>
            <Field label="Reply classification">{show(d.reply_classification)}</Field>
            <Field label="Last message">{show(d.last_message_summary)}</Field>
          </dl>
          {d.suggested_follow_up_message && (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Suggested follow-up (needs approval)</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{d.suggested_follow_up_message}</p>
            </div>
          )}
          {Array.isArray(d.change_log) && d.change_log.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-zinc-400">
              {(d.change_log as Record<string, unknown>[]).slice(-10).map((entry, i) => (
                <li key={i} className="border-l border-zinc-700 pl-2">
                  {show(entry.at)} · {show(entry.field)} → {show(entry.to)}
                  {entry.reason ? ` (${show(entry.reason)})` : ''}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </main>
    </div>
  );
}
