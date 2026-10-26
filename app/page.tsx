'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PLATFORMS,
  STATUS_LABELS,
  type Lead,
  type LeadStatus,
  type PlatformFilter,
  type RecencyFilter,
} from '@/lib/leads';
import {
  Search,
  RefreshCw,
  LogOut,
  Globe,
  Instagram,
  MessageSquare,
  Facebook,
  Briefcase,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Inbox,
  AlertTriangle,
  Layers,
  MapPin,
  Rocket,
  EyeOff,
  UserCheck,
  Target,
  Building2,
  Users,
  ChevronRight,
} from 'lucide-react';

const PLATFORM_ICON: Record<string, React.ReactNode> = {
  'Google Maps': <Globe className="h-3 w-3" />,
  'Job Boards': <Briefcase className="h-3 w-3" />,
  Instagram: <Instagram className="h-3 w-3" />,
  Threads: <MessageSquare className="h-3 w-3" />,
  Facebook: <Facebook className="h-3 w-3" />,
  LinkedIn: <Users className="h-3 w-3" />,
  Directory: <Layers className="h-3 w-3" />,
  'Freelance Platform': <Briefcase className="h-3 w-3" />,
  Community: <Users className="h-3 w-3" />,
  Referral: <Users className="h-3 w-3" />,
  Partnership: <Building2 className="h-3 w-3" />,
  'Startup Network': <Rocket className="h-3 w-3" />,
  'Competitor Signal': <Target className="h-3 w-3" />,
  'Agency Partner': <Building2 className="h-3 w-3" />,
  Other: <Layers className="h-3 w-3" />,
};

const STATUS_TABS = [
  ['active', 'Active'],
  ['qualified', 'Qualified'],
  ['contacted', 'Contacted'],
  ['replied', 'Replied'],
  ['won', 'Won'],
] as const;

function recencyMeta(recency: string): { label: string; cls: string } {
  const ageDays = (Date.now() - new Date(recency).getTime()) / 86400000;
  const label = ageDays < 1 ? 'Today' : `${Math.max(1, Math.round(ageDays))}d ago`;
  if (ageDays < 2) return { label, cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  if (ageDays < 7) return { label, cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  return { label, cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function LeadCard({
  lead,
  onDelete,
  onStatus,
  onCopy,
  copied,
}: {
  lead: Lead;
  onDelete: (id: string) => void;
  onStatus: (id: string, status: LeadStatus) => void;
  onCopy: (lead: Lead) => void;
  copied: boolean;
}) {
  const router = useRouter();
  const rec = recencyMeta(lead.recency);
  const score = lead.weighted_score ?? null;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/leads/${lead.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') router.push(`/leads/${lead.id}`);
      }}
      className="flex cursor-pointer flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:border-zinc-600"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-zinc-50">{lead.business}</h3>
            {lead.status !== 'discovered' && (
              <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
                {STATUS_LABELS[lead.status] ?? lead.status}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge className="border-sky-500/30 bg-sky-500/15 text-sky-400 hover:bg-sky-500/15">
              {lead.category}
            </Badge>
            {lead.city && (
              <Badge className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-800">
                <MapPin className="mr-1 h-3 w-3" />
                {lead.city}
              </Badge>
            )}
            <Badge className={`${rec.cls} hover:${rec.cls}`}>{rec.label}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5">
          <span className="text-lg font-bold leading-none text-white tabular-nums">
            {score ?? '–'}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">score</span>
        </div>
      </div>

      <p className="line-clamp-2 text-sm leading-relaxed text-zinc-400">{lead.need}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        {PLATFORM_ICON[lead.platform] && (
          <Badge className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-800">
            {PLATFORM_ICON[lead.platform]}
            <span className="ml-1">{lead.platform}</span>
          </Badge>
        )}
        {lead.classification === 'priority' && (
          <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15">
            Priority
          </Badge>
        )}
        {lead.opt_out && (
          <Badge className="border-red-500/30 bg-red-500/15 text-red-400 hover:bg-red-500/15">
            Opted out
          </Badge>
        )}
        {lead.evidence_level && (
          <Badge className="border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-900">
            Evidence: {lead.evidence_level}
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
        <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
          {lead.status !== 'qualified' && (
            <button
              onClick={() => onStatus(lead.id, 'qualified')}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
            >
              <Target className="h-3 w-3" />
              Qualified
            </button>
          )}
          {lead.status !== 'contacted' && !lead.opt_out && (
            <button
              onClick={() => onStatus(lead.id, 'contacted')}
              className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-400 transition-colors hover:bg-sky-500/20"
            >
              <UserCheck className="h-3 w-3" />
              Contacted
            </button>
          )}
          <button
            onClick={() => onCopy(lead)}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy angle'}
          </button>
          <button
            onClick={() => onStatus(lead.id, 'do_not_contact')}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
          >
            <EyeOff className="h-3 w-3" />
            Hide
          </button>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Link href={`/leads/${lead.id}`} className="text-zinc-500 hover:text-zinc-200">
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(lead.id)}
            className="h-8 shrink-0 px-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PlatformFilter>('All');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [recency, setRecency] = useState<RecencyFilter>('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number][0]>('active');
  const [category, setCategory] = useState<string>('All');
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (platform !== 'All') params.set('platform', platform);
      if (remoteOnly) params.set('remote', 'true');
      if (recency !== 'all') params.set('days', recency);
      if (search.trim()) params.set('search', search.trim());
      if (category !== 'All') params.set('category', category);
      params.set('status', status === 'active' ? 'all' : status);
      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load leads (${res.status})`);
      const body = await res.json();
      if (!Array.isArray(body.leads)) throw new Error('Unexpected response');
      setLeads(body.leads);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [platform, remoteOnly, recency, search, status, category]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/leads/categories');
      if (!res.ok) return;
      const body = await res.json();
      if (Array.isArray(body.categories)) setCategories(body.categories);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchLeads, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchLeads, search]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories, leads.length]);

  const handleDelete = useCallback(async (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    try {
      const res = await fetch(`/api/leads?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    } catch {
      fetchLeads();
    }
  }, [fetchLeads]);

  const patchLead = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      try {
        const res = await fetch('/api/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...body }),
        });
        if (res.status === 409) {
          const problem = await res.json().catch(() => ({}));
          setError(problem.error ?? 'That status needs a contact date first');
          return;
        }
        if (!res.ok) throw new Error();
        fetchCategories();
      } catch {
        fetchLeads();
      }
    },
    [fetchLeads, fetchCategories]
  );

  const handleStatus = useCallback(
    async (id: string, nextStatus: LeadStatus) => {
      if (nextStatus === 'do_not_contact') {
        setLeads((prev) => prev.filter((l) => l.id !== id));
        await patchLead(id, { status: nextStatus, hidden: true, opt_out: true });
        return;
      }
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: nextStatus } : l)));
      await patchLead(id, { status: nextStatus });
    },
    [patchLead]
  );

  const handleCopy = useCallback(async (lead: Lead) => {
    const text = `${lead.pitch_angle ?? lead.why_suits ?? lead.need}${
      lead.case_study ? `\n\nProof: ${lead.case_study}` : ''
    }`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(lead.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  const stats = useMemo(
    () => ({
      total: leads.length,
      priority: leads.filter((l) => l.classification === 'priority').length,
      qualified: leads.filter((l) => ['qualified', 'ready_for_outreach'].includes(l.status)).length,
      contacted: leads.filter((l) =>
        ['contacted', 'replied', 'discovery_discussion', 'proposal_or_pilot'].includes(l.status)
      ).length,
      won: leads.filter((l) => l.status === 'won').length,
    }),
    [leads]
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/15">
              <Rocket className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-zinc-50">ClientOutreach</p>
              <p className="text-xs leading-tight text-zinc-500">imawais.engineer</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await fetch('/api/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                status === value
                  ? 'bg-white text-zinc-950'
                  : 'border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Leads" value={stats.total} accent="text-white" />
          <StatCard label="Priority" value={stats.priority} accent="text-emerald-400" />
          <StatCard label="Qualified" value={stats.qualified} accent="text-sky-400" />
          <StatCard label="In conversation" value={stats.contacted} accent="text-violet-400" />
          <StatCard label="Won" value={stats.won} accent="text-amber-400" />
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-1.5">
            {(['All', ...categories.map((c) => c.name)] as string[]).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === c
                    ? 'bg-amber-500 text-zinc-950'
                    : 'border border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  platform === p
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'border border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-3 lg:justify-end">
            <button
              onClick={() => setRemoteOnly(!remoteOnly)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                remoteOnly
                  ? 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                  : 'border border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              Remote only
            </button>
            <div className="flex gap-1.5">
              {(['all', '3', '7'] as RecencyFilter[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRecency(r)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    recency === r
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'border border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  {r === 'all' ? 'All time' : `Last ${r}d`}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search business or opportunity..."
                className="h-9 border-zinc-800 bg-zinc-950 pl-9 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <Button size="sm" variant="ghost" onClick={fetchLeads} className="text-zinc-400 hover:text-white">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {loading && leads.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl bg-zinc-900" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 py-16 text-center">
            <Inbox className="h-10 w-10 text-zinc-700" />
            <p className="text-sm font-medium text-zinc-400">No leads yet</p>
            <p className="text-xs text-zinc-600">
              Run the pipeline, or POST a validated lead to /api/leads
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onDelete={handleDelete}
                onStatus={handleStatus}
                onCopy={handleCopy}
                copied={copiedId === lead.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
