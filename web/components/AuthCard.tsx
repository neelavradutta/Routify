'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/store/useApp';
import { ApiError } from '@/lib/api';
import Logo from '@/components/Logo';
import { useAuthFlow } from '@/components/AuthFlow';

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
  const prepareSession = useApp((s) => s.prepareSession);
  const commitSession = useApp((s) => s.commitSession);
  const { leave } = useAuthFlow();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const session = await prepareSession(mode, email, password, mode === 'register' ? fullName : undefined);
      await leave();
      commitSession(session);
      router.replace('/');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not sign you in');
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[380px]">
      <div className="mb-8 lg:hidden">
        <Logo size={36} wordClass="font-serif text-lg leading-none text-ink" />
      </div>

      <p className="label">Account</p>
      <h2 className="mt-2 font-serif text-[28px] leading-tight text-ink">{copy.title}</h2>
      <p className="mt-2 text-sm text-muted">{copy.subtitle}</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === 'register' ? (
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="label">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="field"
              placeholder="Your full name"
            />
          </div>
        ) : null}
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
          className="btn-primary mt-2 !bg-blue-600 !text-white !shadow-press hover:!bg-blue-500 hover:!text-white disabled:!bg-blue-600/40 disabled:!text-white"
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
        <Link href={copy.switchLink} className="font-medium text-blue-700 underline underline-offset-4 transition-colors hover:text-blue-800">
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  );
}
