'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Archive,
  Inbox,
  LogOut,
  Reply,
  Rocket,
  Send,
  Target,
  Trophy,
} from 'lucide-react';
import type { StatusGroup } from '@/lib/leads';

const NAV: Array<{ key: StatusGroup; label: string; icon: React.ElementType }> = [
  { key: 'active', label: 'Active Leads', icon: Inbox },
  { key: 'qualified', label: 'Qualified Leads', icon: Target },
  { key: 'contacted', label: 'Contacted Leads', icon: Send },
  { key: 'replied', label: 'Replied', icon: Reply },
  { key: 'won', label: 'Won', icon: Trophy },
  { key: 'archived', label: 'Archived', icon: Archive },
];

type Counts = Partial<Record<StatusGroup, number>>;

export function AppShell({
  active,
  children,
}: {
  active: StatusGroup;
  children: React.ReactNode;
}) {
  const [counts, setCounts] = useState<Counts>({});

  useEffect(() => {
    let live = true;
    fetch('/api/leads/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (live && body?.counts) setCounts(body.counts as Counts);
      })
      .catch(() => {
        /* counts are decorative; never block the page */
      });
    return () => {
      live = false;
    };
  }, [active]);

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const navLink = (key: StatusGroup, label: string, dense = false) => (
    <Link
      href={key === 'active' ? '/' : `/?view=${key}`}
      className={`flex items-center gap-2.5 rounded-lg px-3 text-sm transition-colors ${
        dense ? 'py-2' : 'py-2.5'
      } ${
        active === key
          ? 'bg-zinc-800/80 font-medium text-zinc-50'
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
      }`}
    >
      <span className="truncate">{label}</span>
      {typeof counts[key] === 'number' && (
        <span className="ml-auto text-xs tabular-nums text-zinc-500">{counts[key]}</span>
      )}
    </Link>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-800/70 px-3 py-5 lg:flex">
        <Link href="/" className="mb-7 flex items-center gap-2.5 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/15">
            <Rocket className="h-4 w-4 text-emerald-400" />
          </span>
          <span>
            <span className="block text-sm font-semibold leading-tight text-zinc-50">
              ClientOutreach
            </span>
            <span className="block text-xs leading-tight text-zinc-500">imawais.engineer</span>
          </span>
        </Link>

        <nav className="space-y-1">
          {NAV.map(({ key, label }) => navLink(key, label))}
        </nav>

        <button
          onClick={logout}
          className="mt-auto flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-zinc-800/70 bg-zinc-950/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/15">
                <Rocket className="h-3.5 w-3.5 text-emerald-400" />
              </span>
              <span className="text-sm font-semibold text-zinc-50">ClientOutreach</span>
            </Link>
            <button
              onClick={logout}
              className="rounded-md p-2 text-zinc-500 hover:text-zinc-200"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map(({ key, label }) => (
              <Link
                key={key}
                href={key === 'active' ? '/' : `/?view=${key}`}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors ${
                  active === key
                    ? 'bg-zinc-100 font-medium text-zinc-900'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {label}
                {typeof counts[key] === 'number' ? ` (${counts[key]})` : ''}
              </Link>
            ))}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
