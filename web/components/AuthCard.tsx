'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Compass, Loader2 } from 'lucide-react';
import { useApp } from '@/store/useApp';
import { ApiError } from '@/lib/api';

type Props = { mode: 'login' | 'register' };

const COPY = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to plan a safety-weighted walk.',
    action: 'Sign in',
    switchText: 'New here?',
    switchLink: '/register',
    switchLabel: 'Create an account',
  },
  register: {
    title: 'Create your account',
    subtitle: 'Two fields, then straight to the map.',
    action: 'Create account',
    switchText: 'Already registered?',
    switchLink: '/login',
    switchLabel: 'Sign in',
  },
} as const;

export default function AuthCard({ mode }: Props) {
  const copy = COPY[mode];
  const router = useRouter();
  const signIn = useApp((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await signIn(mode, email, password);
      router.replace('/');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not sign you in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sage text-panel">
            <Compass size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-serif text-lg leading-none text-ink">Safe Routes</p>
            <p className="mt-1 text-xs text-muted">Central Delhi, on foot</p>
          </div>
        </div>

        <div className="card p-6">
          <h1 className="font-serif text-xl text-ink">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder="At least 8 characters"
              />
            </div>

            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}
              {copy.action}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          {copy.switchText}{' '}
          <Link href={copy.switchLink} className="text-sage underline underline-offset-4 hover:text-sage-dark">
            {copy.switchLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}
