'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PLATFORMS, type Lead, type PlatformFilter, type RecencyFilter, OUTREACH_TEMPLATE } from '@/lib/leads';
import {
  Search,
  RefreshCw,
  LogOut,
  Radio,
  Globe,
  Instagram,
  MessageSquare,
  Facebook,
  Briefcase,
  ExternalLink,
  Mail,
  Phone,
  Copy,
  Check,
  Trash2,
  Inbox,
  AlertTriangle,
  Layers,
  MapPin,
  Send,
  FileText,
  Link2,
  Rocket,
} from 'lucide-react';

const PLATFORM_ICON: Record<string, React.ReactNode> = {
  'Google Maps': <Globe className="h-3 w-3" />,
  Instagram: <Instagram className="h-3 w-3" />,
  Threads: <MessageSquare className="h-3 w-3" />,
  Facebook: <Facebook className="h-3 w-3" />,
  'Job Boards': <Briefcase className="h-3 w-3" />,
  Other: <Layers className="h-3 w-3" />,
};

function recencyMeta(recency: string): { label: string; cls: string; days: number } {
  const ageDays = (Date.now() - new Date(recency).getTime()) / 86400000;
  const label = ageDays < 1 ? 'Today' : `${Math.max(1, Math.round(ageDays))}d ago`;
  if (ageDays < 2) return { label, cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', days: ageDays };
  if (ageDays < 7) return { label, cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', days: ageDays };
  return { label, cls: 'bg-red-500/15 text-red-400 border-red-500/30', days: ageDays };
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function ContactButton({
  href,
  icon,
  label,
  onClick,
}: {
  href?: string | null;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={onClick}
        className="h-8 border-zinc-700 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800 hover:text-white"
      >
        {icon}
        {label}
      </Button>
    );
  }
  if (!href) return null;
  return (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
      <Button
        size="sm"
        variant="outline"
        className="h-8 border-zinc-700 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800 hover:text-white"
      >
        {icon}
        {label}
      </Button>
    </a>
  );
}

function LeadCard({ lead, onDelete }: { lead: Lead; onDelete: (id: string) => void }) {
  const [copied, setCopied] = useState<'template' | 'dm' | null>(null);
  const rec = recencyMeta(lead.recency);

  const copy = useCallback(async (text: string, kind: 'template' | 'dm') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  const dmTemplate = OUTREACH_TEMPLATE(lead);
  const validations = lead.validation_passed ?? {};

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:border-zinc-700">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-zinc-50">{lead.business}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge className="border-sky-500/30 bg-sky-500/15 text-sky-400 hover:bg-sky-500/15">{lead.need}</Badge>
            <Badge className={`${rec.cls} hover:${rec.cls}`}>{rec.label}</Badge>
            {PLATFORM_ICON[lead.platform] && (
              <Badge className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-800">
                {PLATFORM_ICON[lead.platform]}
                <span className="ml-1">{lead.platform}</span>
              </Badge>
            )}
            {lead.remote_eligible_pak && (
              <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15">
                <MapPin className="mr-1 h-3 w-3" />
                Remote Pak
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5">
          <span className="text-lg font-bold leading-none text-white tabular-nums">{lead.score}</span>
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">score</span>
        </div>
      </div>

      {lead.why_suits && <p className="line-clamp-2 text-sm leading-relaxed text-zinc-400">{lead.why_suits}</p>}

      {Object.keys(validations).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(validations).map(([k, v]) => (
            <span
              key={k}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                v
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-500'
              }`}
            >
              <Check className="h-3 w-3" />
              {k}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {lead.contact.profile_url && (
          <ContactButton href={lead.contact.profile_url} icon={<Send className="h-3 w-3" />} label="DM Profile" />
        )}
        {lead.contact.post_url && (
          <ContactButton href={lead.contact.post_url} icon={<FileText className="h-3 w-3" />} label="Post URL" />
        )}
        {lead.contact.dm_link && (
          <ContactButton href={lead.contact.dm_link} icon={<Link2 className="h-3 w-3" />} label="DM Link" />
        )}
        {lead.contact.email && (
          <ContactButton href={`mailto:${lead.contact.email}`} icon={<Mail className="h-3 w-3" />} label="Email" />
        )}
        {lead.contact.phone && (
          <ContactButton href={`tel:${lead.contact.phone}`} icon={<Phone className="h-3 w-3" />} label="Call" />
        )}
        {lead.contact.application_url && (
          <ContactButton href={lead.contact.application_url} icon={<ExternalLink className="h-3 w-3" />} label="Apply" />
        )}
        <ContactButton
          icon={copied === 'template' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          label={copied === 'template' ? 'Copied' : 'Copy DM Template'}
          onClick={() => copy(dmTemplate, 'template')}
        />
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
        <button
          onClick={() => copy(dmTemplate, 'template')}
          className="truncate text-left text-xs text-zinc-500 hover:text-zinc-300"
          title={dmTemplate}
        >
          {dmTemplate}
        </button>
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
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (platform !== 'All') params.set('platform', platform);
      if (remoteOnly) params.set('remote', 'true');
      if (recency !== 'all') params.set('days', recency);
      if (search.trim()) params.set('search', search.trim());
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
  }, [platform, remoteOnly, recency, search]);

  useEffect(() => {
    const t = setTimeout(fetchLeads, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchLeads, search]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/leads?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch {
      /* refresh will show true state */
    } finally {
      setDeleting(null);
    }
  }, []);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return {
      total: leads.filter((l) => new Date(l.recency).getTime() >= weekAgo).length,
      remote: leads.filter((l) => l.remote_eligible_pak).length,
      maps: leads.filter((l) => l.platform === 'Google Maps').length,
      social: leads.filter((l) => ['Instagram', 'Threads', 'Facebook'].includes(l.platform)).length,
      jobs: leads.filter((l) => l.platform === 'Job Boards').length,
    };
  }, [leads]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/25">
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total Leads (7d)" value={stats.total} accent="text-white" />
          <StatCard label="Remote Eligible" value={stats.remote} accent="text-emerald-400" />
          <StatCard label="Maps" value={stats.maps} accent="text-sky-400" />
          <StatCard label="Social" value={stats.social} accent="text-violet-400" />
          <StatCard label="Job Boards" value={stats.jobs} accent="text-amber-400" />
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 lg:flex-row lg:items-center">
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
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'border border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              Remote Only
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
                placeholder="Search business or need..."
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
              <Skeleton key={i} className="h-56 rounded-xl bg-zinc-900" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 py-16 text-center">
            <Inbox className="h-10 w-10 text-zinc-700" />
            <p className="text-sm font-medium text-zinc-400">No leads yet</p>
            <p className="text-xs text-zinc-600">Waiting for backend agent POST to /api/leads</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
