'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Lock, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Login failed');
      }
      const next = searchParams.get('next') || '/';
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <Lock className="h-5 w-5 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">ClientOutreach</h1>
        <p className="text-sm text-zinc-400">imawais.engineer - AI Automation Engineer</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-zinc-300">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoFocus
          autoComplete="email"
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-zinc-300">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          autoComplete="current-password"
          className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
