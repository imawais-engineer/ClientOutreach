'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LIFECYCLE, STATUS_LABELS, type LeadStatus } from '@/lib/leads';

const NEXT_ACTIONS: LeadStatus[] = [
  'qualified',
  'ready_for_outreach',
  'contacted',
  'replied',
  'discovery_discussion',
  'proposal_or_pilot',
  'won',
  'lost',
  'nurture',
  'disqualified',
  'do_not_contact',
];

export function LeadActions({
  id,
  status,
  optOut,
  hasContactDate,
}: {
  id: string;
  status: LeadStatus;
  optOut: boolean;
  hasContactDate: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        setError(problem.error ?? `Update failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (next: LeadStatus) => {
    const body: Record<string, unknown> = { status: next };
    if (next === 'do_not_contact') {
      body.opt_out = true;
      body.hidden = true;
    }
    if (next === 'contacted' && !hasContactDate) {
      body.last_contact_at = new Date().toISOString();
    }
    return patch(body);
  };

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Update lead</p>
        {optOut && (
          <span className="rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
            Do not contact
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {NEXT_ACTIONS.filter((s) => s !== status && LIFECYCLE.includes(s)).map((s) => (
          <button
            key={s}
            disabled={busy || optOut}
            onClick={() => setStatus(s)}
            className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => patch({ opt_out: !optOut })}
          className="h-8 border-zinc-700 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          {optOut ? 'Clear opt-out' : 'Mark opted out'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => patch({ hidden: true })}
          className="h-8 border-zinc-700 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          Hide from list
        </Button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
