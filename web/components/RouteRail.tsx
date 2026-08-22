'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpDown,
  Loader2,
  LogOut,
  MapPin,
  Moon,
  Search,
  Sun,
  Flag,
  Lightbulb,
  Trees,
} from 'lucide-react';
import { useApp } from '@/store/useApp';
import { api, type Place } from '@/lib/api';
import Logo from '@/components/Logo';

const EASE = [0.22, 1, 0.36, 1] as const;

function FilterButton({
  pressed,
  onClick,
  label,
  hint,
  icon,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      className="relative flex w-full items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left"
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-amber-100"
        initial={false}
        animate={{ x: pressed ? '0%' : '-100%' }}
        transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.65 }}
      />
      <span className={`relative z-10 mt-0.5 ${pressed ? 'text-amber-800' : 'text-muted'}`}>{icon}</span>
      <span className="relative z-10 min-w-0 flex-1">
        <span className={`block text-[13px] font-medium ${pressed ? 'text-amber-950' : 'text-ink'}`}>{label}</span>
        <span className={`mt-0.5 block text-[11px] ${pressed ? 'text-amber-800' : 'text-muted'}`}>{hint}</span>
      </span>
    </motion.button>
  );
}

function PlaceField({ which }: { which: 'from' | 'to' }) {
  const { token, pick, setPick, setPlace } = useApp();
  const place = useApp((s) => s[which]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(place ? place.label : '');
  }, [place]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!token || query.trim().length < 3 || query === place?.label) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { results: next } = await api.search(token, query.trim());
        setResults(next);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [query, token, place?.label]);

  const active = pick === which;
  const isStart = which === 'from';

  return (
    <div ref={box} className="relative">
      <div className="mb-1.5">
        <label className="label" htmlFor={`place-${which}`}>
          {isStart ? 'Start' : 'Destination'}
        </label>
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          {isStart ? <MapPin size={15} strokeWidth={1.75} /> : <Flag size={15} strokeWidth={1.75} />}
        </span>
        <span className="pointer-events-none absolute left-9 top-1/2 h-4 w-px -translate-y-1/2 bg-zinc-300" />
        <input
          id={`place-${which}`}
          value={query}
          onFocus={() => {
            setPick(which);
            if (results.length) setOpen(true);
          }}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isStart ? 'Connaught Place' : 'Khan Market'}
          className={`field pl-12 pr-9 ${active ? 'border-slate-400' : ''}`}
          autoComplete="off"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} strokeWidth={1.75} />}
        </span>
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: EASE }}
            className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-panel shadow-lift"
          >
            {results.map((result, i) => (
              <li key={`${result.lat}-${result.lng}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    setPlace(which, result);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2.5 text-left transition-all duration-150 hover:translate-x-0.5 hover:bg-lime-50"
                >
                  <span className="block truncate text-sm text-ink">{result.label}</span>
                  <span className="block truncate text-xs text-muted">{result.context}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RouteRail() {
  const router = useRouter();
  const {
    email,
    from,
    to,
    night,
    avoidUnlit,
    avoidIsolated,
    plan,
    planning,
    toggle,
    swap,
    reset,
    run,
    signOut,
  } = useApp();

  const canRoute = Boolean(from && to) && !planning;
  const [spin, setSpin] = useState(0);

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-panel">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <Logo size={36} />
        <motion.button
          type="button"
          aria-label={email ? `Sign out ${email}` : 'Sign out'}
          title={email ? `Sign out ${email}` : 'Sign out'}
          onClick={() => {
            signOut();
            router.replace('/login');
          }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 transition-colors duration-200 hover:border-red-300 hover:bg-red-100 hover:text-red-800"
        >
          <LogOut size={15} strokeWidth={2.25} />
        </motion.button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto px-5 py-5">
        <section>
          <div className="relative">
            <PlaceField which="from" />

            <div className="relative z-10 mt-3 mb-0 flex items-center justify-center py-1">
              <span className="absolute inset-x-8 top-1/2 h-px bg-gradient-to-r from-lime-500 via-slate-200 to-rose-400" />
              <motion.button
                type="button"
                onClick={() => {
                  swap();
                  setSpin((n) => n + 180);
                }}
                disabled={!from && !to}
                animate={{ rotate: spin }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 380, damping: 16 }}
                className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-lime-500 bg-white text-zinc-700 shadow-panel hover:bg-lime-50 disabled:border-slate-200 disabled:text-slate-300"
                title="Swap start and destination"
              >
                <ArrowUpDown size={16} strokeWidth={2} />
              </motion.button>
            </div>

            <PlaceField which="to" />
          </div>
        </section>

        <section className="space-y-2">
          <p className="label">Time of day</p>
          <div className="relative grid h-10 grid-cols-2 rounded-xl border border-slate-200 bg-white p-1">
            <motion.span
              aria-hidden
              className="pointer-events-none absolute top-1 bottom-1 w-[calc(50%-6px)] rounded-lg bg-sky-100"
              initial={false}
              animate={{ left: night ? 'calc(50% + 2px)' : '4px' }}
              transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.65 }}
            />
            {[
              { on: false, label: 'Day', icon: <Sun size={14} strokeWidth={1.75} /> },
              { on: true, label: 'Night', icon: <Moon size={14} strokeWidth={1.75} /> },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  if (night !== option.on) toggle('night');
                }}
                className={`relative z-10 flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-medium transition-colors duration-200 ${
                  night === option.on ? 'text-sky-950' : 'text-muted hover:text-ink'
                }`}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <p className="label">Avoid</p>
          <FilterButton
            pressed={avoidUnlit}
            onClick={() => toggle('avoidUnlit')}
            label="Poorly lit streets"
            hint="Raises cost on dark stretches"
            icon={<Lightbulb size={15} strokeWidth={1.75} />}
          />
          <FilterButton
            pressed={avoidIsolated}
            onClick={() => toggle('avoidIsolated')}
            label="Isolated areas"
            hint="Prefers shops and footfall"
            icon={<Trees size={15} strokeWidth={1.75} />}
          />
        </section>

        <section>
          <div className={`grid gap-2 ${plan ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <motion.button
              type="button"
              className="btn-primary disabled:bg-lime-500 disabled:text-zinc-950 disabled:shadow-press"
              onClick={() => void run()}
              disabled={!canRoute}
              whileHover={canRoute ? { y: -2 } : undefined}
              whileTap={canRoute ? { scale: 0.985 } : undefined}
            >
              {planning ? <Loader2 size={15} className="animate-spin" /> : null}
              {planning ? 'Comparing three walks' : 'Get safer routes'}
              {planning && (
                <span className="pointer-events-none absolute inset-0 overflow-hidden">
                  <span className="absolute inset-y-0 w-1/3 bg-white/15 animate-shimmer" />
                </span>
              )}
            </motion.button>
            <AnimatePresence initial={false}>
              {plan ? (
                <motion.button
                  key="clear"
                  type="button"
                  className="btn-ghost w-full py-3"
                  onClick={reset}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Clear
                </motion.button>
              ) : null}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </aside>
  );
}
