'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import {
  GROUP_LABELS,
  STATUS_LABELS,
  businessDescription,
  shortBusiness,
  type Lead,
  type StatusGroup,
} from '@/lib/leads';
import { Search, Download, Inbox, ArrowRight, X } from 'lucide-react';

const VIEWS: StatusGroup[] = ['active', 'qualified', 'contacted', 'replied', 'won', 'archived'];

const asView = (value: string | null): StatusGroup =>
  value && (VIEWS as string[]).includes(value) ? (value as StatusGroup) : 'active';

const PRIORITY: Record<string, { label: string; dot: string; text: string }> = {
  priority: { label: 'Priority', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  potential: { label: 'Potential', dot: 'bg-zinc-500', text: 'text-zinc-400' },
  deprioritize: { label: 'Low priority', dot: 'bg-zinc-600', text: 'text-zinc-500' },
};

function LeadCard({
  lead,
  archived,
  onHide,
}: {
  lead: Lead;
  archived: boolean;
  onHide: (id: string, restore: boolean) => void;
}) {
  const priority = PRIORITY[lead.classification ?? ''] ?? null;
  const place = [lead.city, lead.country].filter(Boolean).join(', ') || 'Location unknown';

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition-colors hover:border-zinc-700">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-zinc-50">
            {shortBusiness(lead.business, 70)}
          </h3>
          <p className="mt-1 truncate text-xs text-zinc-500">
            {place} · {lead.category}
          </p>
        </div>
        {priority && (
          <span className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] ${priority.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
            {priority.label}
          </span>
        )}
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-400">
        {businessDescription(lead)}
      </p>

      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-300">
        <span className="text-zinc-500">Opportunity: </span>
        {lead.need}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-800/70 pt-3">
        <span className="text-xs text-zinc-500">{STATUS_LABELS[lead.status] ?? lead.status}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onHide(lead.id, archived)}
            className="rounded-md px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            {archived ? 'Restore' : 'Hide'}
          </button>
          <Link
            href={`/leads/${lead.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-white"
          >
            Open
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function LeadsView() {
  const params = useSearchParams();
  const view = asView(params.get('view'));
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ group: view, limit: '200' });
      if (query) qs.set('search', query);
      const res = await fetch(`/api/leads?${qs.toString()}`);
      if (!res.ok) throw new Error(`Failed to load leads (${res.status})`);
      const body = await res.json();
      if (!Array.isArray(body.leads)) throw new Error('Unexpected response');
      setLeads(body.leads);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [view, query]);

  useEffect(() => {
    load();
  }, [load]);

  const hide = useCallback(
    async (id: string, restore: boolean) => {
      setLeads((prev) => prev.filter((l) => l.id !== id));
      try {
        const res = await fetch('/api/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, hidden: !restore }),
        });
        if (!res.ok) throw new Error();
      } catch {
        load();
      }
    },
    [load]
  );

  const heading = useMemo(() => GROUP_LABELS[view], [view]);

  return (
    <AppShell active={view}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-50">{heading}</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {loading && leads.length === 0
              ? 'Loading…'
              : `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads"
              className="h-9 w-56 border-zinc-800 bg-zinc-900/60 pl-9 pr-8 text-sm text-zinc-100 placeholder:text-zinc-600 sm:w-64"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:text-zinc-200"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <details className="relative">
            <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200 [&::-webkit-details-marker]:hidden">
              <Download className="h-3.5 w-3.5" />
              Export
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
              {(['csv', 'json', 'md'] as const).map((format) => (
                <a
                  key={format}
                  href={`/api/leads/export?format=${format}&group=${view}`}
                  className="block px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                  {format.toUpperCase()}
                </a>
              ))}
            </div>
          </details>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {loading && leads.length === 0 ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
          ))
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-800 py-16 text-center">
            <Inbox className="h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-400">
              {query ? 'No leads match that search.' : `No leads in ${heading}.`}
            </p>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              archived={view === 'archived'}
              onHide={hide}
            />
          ))
        )}
      </div>
    </AppShell>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <LeadsView />
    </Suspense>
  );
}
