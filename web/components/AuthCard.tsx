'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Footprints, Loader2, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useApp } from '@/store/useApp';
import { ApiError } from '@/lib/api';
import Logo from '@/components/Logo';

type Props = { mode: 'login' | 'register' };

const COPY = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to pick a safer walk.',
    action: 'Sign in',
    switchText: 'New here?',
    switchLink: '/register',
    switchLabel: 'Create an account',
  },
  register: {
    title: 'Create an account',
    subtitle: 'A minute to start. Then the map.',
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
              'radial-gradient(circle at 16% 18%, rgba(91,33,182,0.22), transparent 40%), radial-gradient(circle at 82% 24%, rgba(244,63,94,0.14), transparent 38%), radial-gradient(circle at 70% 78%, rgba(245,158,11,0.16), transparent 42%)',
          }}
        />
        <div className="relative">
          <Logo size={40} wordClass="font-serif text-xl leading-none text-ink" />
          <h1 className="mt-16 max-w-md font-serif text-[42px] leading-[1.12] text-ink">
            The shortest walk is not always the safest one at night.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
            Routify helps you walk through central Delhi with three clear choices — faster, mixed, or safer streets.
          </p>
        </div>
        <ul className="relative grid max-w-lg grid-cols-3 gap-3">
          {[
            { icon: Footprints, title: 'Three walks', body: 'Fast, mixed, or the safest streets.' },
            { icon: ShieldCheck, title: 'Easy score', body: '0 to 100 so you know how it feels.' },
            { icon: SlidersHorizontal, title: 'Your rules', body: 'Skip dark or empty roads if you want.' },
          ].map((item, i) => (
            <motion.li
              key={item.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-800">
                <item.icon size={16} strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-[16px] font-semibold tracking-tight text-ink">{item.title}</p>
              <p className="mt-1.5 text-[12px] leading-snug text-muted">{item.body}</p>
            </motion.li>
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
          <div className="mb-8 lg:hidden">
            <Logo size={36} wordClass="font-serif text-lg leading-none text-ink" />
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
              whileHover={busy ? undefined : { y: -2 }}
              whileTap={{ scale: busy ? 1 : 0.985 }}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}
              {copy.action}
            </motion.button>
          </form>

          <p className="mt-6 text-sm text-muted">
            {copy.switchText}{' '}
            <Link href={copy.switchLink} className="font-medium text-violet-800 underline underline-offset-4 transition-colors hover:text-violet-950">
              {copy.switchLabel}
            </Link>
          </p>
        </motion.div>
      </section>
    </main>
  );
}
