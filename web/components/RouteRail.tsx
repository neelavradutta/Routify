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
  Sparkles,
  Sun,
  Flag,
  Lightbulb,
  Trees,
} from 'lucide-react';
import { useApp } from '@/store/useApp';
import { api, SCORE_COLORS, type Place } from '@/lib/api';
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
      className="relative flex w-full items-start gap-3 overflow-hidden rounded-xl border border-zinc-900 bg-white px-3 py-2.5 text-left"
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#8B5E3C]"
        initial={false}
        animate={{ x: pressed ? '0%' : '-100%' }}
        transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.65 }}
      />
      <span className="relative z-10 mt-0.5 text-muted">{icon}</span>
      <span className="relative z-10 min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>
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
      <div className="mb-1.5 flex items-center justify-between">
        <label className="label" htmlFor={`place-${which}`}>
          {isStart ? 'Start' : 'Destination'}
        </label>
        {active && <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-900">Map click</span>}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          {isStart ? <MapPin size={15} strokeWidth={1.75} /> : <Flag size={15} strokeWidth={1.75} />}
        </span>
        <input
          id={`place-${which}`}
          value={query}
          onFocus={() => {
            setPick(which);
            if (results.length) setOpen(true);
          }}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isStart ? 'Connaught Place' : 'Khan Market'}
          className={`field pl-10 pr-9 ${active ? 'border-zinc-900' : ''}`}
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

function WhyPoints({ text }: { text?: string }) {
  const points = (text ?? 'Pick a route to see why we chose it.')
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);

  return (
    <ul className="space-y-2 text-[13px] leading-snug text-ink">
      {points.map((line, i) => (
        <motion.li
          key={`${i}-${line}`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.34, delay: 0.04 + i * 0.09, ease: EASE }}
          className="flex gap-2"
        >
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-600" />
          <span>{line}</span>
        </motion.li>
      ))}
    </ul>
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
    explanation,
    explaining,
    showZones,
    toggle,
    swap,
    reset,
    run,
    signOut,
  } = useApp();

  const canRoute = Boolean(from && to) && !planning;
  const [spin, setSpin] = useState(0);

  return (
    <aside className="flex h-full w-full flex-col border-r border-zinc-900 bg-panel">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <Logo size={36} />
        <motion.button
          type="button"
          initial="rest"
          whileHover="on"
          whileTap="on"
          className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-zinc-900 bg-white text-ink"
          title={email ? `Sign out ${email}` : 'Sign out'}
          onClick={() => {
            signOut();
            router.replace('/login');
          }}
        >
          <motion.span
            aria-hidden
            variants={{ rest: { x: '-100%' }, on: { x: '0%' } }}
            transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.65 }}
            className="pointer-events-none absolute inset-0 bg-[#8B5E3C]"
          />
          <motion.span
            className="relative z-10 inline-flex"
            variants={{ rest: { x: 0, rotate: 0 }, on: { x: 4, rotate: -12 } }}
            transition={{ type: 'spring', stiffness: 480, damping: 18 }}
          >
            <LogOut size={15} strokeWidth={1.75} />
          </motion.span>
        </motion.button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section>
          <div className="relative">
            <PlaceField which="from" />

            <div className="relative z-10 my-1 flex items-center justify-center py-1">
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
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Central Delhi only. Drop pins on streets, not lawns or building interiors.
          </p>
        </section>

        <section className="space-y-2">
          <p className="label">Time of day</p>
          <div className="relative grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-1">
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-sky-100"
              animate={{ x: night ? '100%' : '0%' }}
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

        <section className="space-y-2">
          <motion.button
            type="button"
            className="btn-primary"
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
          {(from || to || plan) && (
            <motion.button type="button" className="btn-ghost w-full" onClick={reset} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
              Clear
            </motion.button>
          )}
        </section>

        <AnimatePresence initial={false}>
          {plan && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="space-y-4 border-t border-line pt-5"
            >
              <div className="card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="label">Why this route</p>
                  <span className="chip !py-0.5">
                    <Sparkles size={11} strokeWidth={1.75} />
                    {explanation?.source === 'ai' ? 'AI summary' : 'From route data'}
                  </span>
                </div>
                {explaining && !explanation ? (
                  <div className="space-y-2 py-1">
                    <div className="h-2.5 w-full animate-pulse rounded bg-line" />
                    <div className="h-2.5 w-11/12 animate-pulse rounded bg-line" />
                    <div className="h-2.5 w-9/12 animate-pulse rounded bg-line" />
                  </div>
                ) : (
                  <WhyPoints key={explanation?.text ?? 'empty'} text={explanation?.text} />
                )}
              </div>

              <div className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="label">Map legend</p>
                  <button
                    type="button"
                    onClick={() => toggle('showZones')}
                    className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-ink transition-all duration-200 hover:-translate-y-px hover:border-lime-400 hover:bg-lime-50 hover:shadow-panel"
                  >
                    {showZones ? 'Hide zones' : 'Show zones'}
                  </button>
                </div>
                <ul className="space-y-2 text-xs text-muted">
                  <li className="flex items-center gap-2 text-[12px] font-medium text-ink">
                    <span className="h-3 w-3 rounded-full border border-rose-400 bg-rose-400/35" />
                    Flagged unsafe zones
                  </li>
                  {[
                    { color: SCORE_COLORS.good, text: '72 and above' },
                    { color: SCORE_COLORS.fair, text: '55 to 71' },
                    { color: SCORE_COLORS.poor, text: 'Below 55' },
                  ].map((item) => (
                    <li key={item.text} className="flex items-center gap-2">
                      <span className="h-1.5 w-7 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[11px] leading-relaxed text-muted">
                Scores are estimates from OpenStreetMap lighting, camera and activity data plus area-level crime
                priors. They describe streets, not people.
              </p>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
