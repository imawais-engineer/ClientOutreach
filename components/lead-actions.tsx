'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, EyeOff } from 'lucide-react';

export function LeadActions({
  id,
  status,
  hidden,
  optOut,
  hasContactDate,
}: {
  id: string;
  status: string;
  hidden: boolean;
  optOut: boolean;
  hasContactDate: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>, after: () => void) => {
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
      after();
    } catch {
      setError('Update failed');
    } finally {
      setBusy(false);
    }
  };

  const markContacted = () => {
    const body: Record<string, unknown> = { status: 'contacted' };
    // The API refuses 'contacted' without a contact date, so record it now.
    if (!hasContactDate) body.last_contact_at = new Date().toISOString();
    return patch(body, () => router.push('/?view=contacted'));
  };

  const toggleHidden = () =>
    patch({ hidden: !hidden }, () => router.push(hidden ? '/?view=archived' : '/'));

  const contacted = status === 'contacted';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={markContacted}
        disabled={busy || optOut || contacted}
        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-2 text-xs font-medium text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Check className="h-3.5 w-3.5" />
        {contacted ? 'Contacted' : 'Mark as contacted'}
      </button>
      <button
        onClick={toggleHidden}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-40"
      >
        <EyeOff className="h-3.5 w-3.5" />
        {hidden ? 'Restore' : 'Hide'}
      </button>
      {optOut && (
        <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-400">
          Do not contact
        </span>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
