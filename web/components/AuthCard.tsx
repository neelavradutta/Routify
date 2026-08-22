'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Compass, Loader2 } from 'lucide-react';
import { useApp } from '@/store/useApp';
import { ApiError } from '@/lib/api';

type Props = { mode: 'login' | 'register' };

const COPY = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to compare Fastest, Balanced and Safest walks.',
    action: 'Sign in',
    switchText: 'New here?',
    switchLink: '/register',
    switchLabel: 'Create an account',
  },
  register: {
    title: 'Create an account',
    subtitle: 'Email and password. Then the map.',
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
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden border-r border-slate-200 bg-white px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 16% 18%, rgba(13,148,136,0.22), transparent 40%), radial-gradient(circle at 82% 24%, rgba(59,130,246,0.16), transparent 38%), radial-gradient(circle at 70% 78%, rgba(244,63,94,0.14), transparent 42%)',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-press">
              <Compass size={18} strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-serif text-xl leading-none text-ink">Safe Routes</p>
              <p className="mt-1.5 text-xs tracking-wide text-muted">Central Delhi · on foot</p>
            </div>
          </div>
          <h1 className="mt-16 max-w-md font-serif text-[42px] leading-[1.12] text-ink">
            The shortest walk is not always the one you take at night.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
            Lighting, isolation, cameras and area crime priors sit inside the routing cost — not as a paint layer on
            top of it.
          </p>
        </div>
        <ul className="relative grid max-w-md grid-cols-3 gap-3">
          {[
            ['01', 'Compare', 'Three cost models'],
            ['02', 'Score', 'Per-street 0–100'],
            ['03', 'Filter', 'Unlit and isolated'],
          ].map(([n, t, d]) => (
            <li key={n} className="rounded-xl border border-line/80 bg-panel/70 p-3 backdrop-blur-sm">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-teal-600">{n}</p>
              <p className="mt-2 text-sm font-medium text-ink">{t}</p>
              <p className="mt-1 text-[11px] text-muted">{d}</p>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex items-center justify-center bg-ground px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[380px]"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
              <Compass size={16} strokeWidth={1.75} />
            </span>
            <p className="font-serif text-lg text-ink">Safe Routes</p>
          </div>

          <p className="label">Account</p>
          <h2 className="mt-2 font-serif text-[28px] leading-tight text-ink">{copy.title}</h2>
          <p className="mt-2 text-sm text-muted">{copy.subtitle}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
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

            <motion.button
              type="submit"
              className="btn-primary mt-2"
              disabled={busy}
              whileTap={{ scale: busy ? 1 : 0.985 }}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}
              {copy.action}
            </motion.button>
          </form>

          <p className="mt-6 text-sm text-muted">
            {copy.switchText}{' '}
            <Link href={copy.switchLink} className="font-medium text-teal-700 underline underline-offset-4 hover:text-teal-800">
              {copy.switchLabel}
            </Link>
          </p>
        </motion.div>
      </section>
    </main>
  );
}
