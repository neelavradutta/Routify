'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpDown,
  Compass,
  Loader2,
  LogOut,
  MapPin,
  Moon,
  Search,
  Sparkles,
  Sun,
  Route as RouteIcon,
} from 'lucide-react';
import { useApp } from '@/store/useApp';
import { api, SCORE_COLORS, scoreTone, formatDistance, type Place } from '@/lib/api';
import RouteCard from '@/components/RouteCard';

const EASE = [0.2, 0.8, 0.2, 1] as const;

function Switch({
  checked,
  onChange,
  label,
  hint,
  icon,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-150 ease-calm hover:bg-white/60"
    >
      <span className={`shrink-0 ${checked ? 'text-sage' : 'text-muted'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ease-calm ${
          checked ? 'bg-sage' : 'bg-line'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-panel shadow-panel transition-[left] duration-150 ease-calm ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
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
        const { results } = await api.search(token, query.trim());
        setResults(results);
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

  return (
    <div ref={box} className="relative">
      <label className="label" htmlFor={`place-${which}`}>
        {which === 'from' ? 'Start' : 'Destination'}
      </label>
      <div className="relative mt-1.5">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          {which === 'from' ? <MapPin size={14} strokeWidth={1.75} /> : <RouteIcon size={14} strokeWidth={1.75} />}
        </span>
        <input
          id={`place-${which}`}
          value={query}
          onFocus={() => {
            setPick(which);
            if (results.length) setOpen(true);
          }}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={which === 'from' ? 'Connaught Place' : 'Khan Market'}
          className={`field pl-9 pr-8 ${active ? 'border-sage/50' : ''}`}
          autoComplete="off"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} strokeWidth={1.75} />}
        </span>
      </div>

      {active && !place && (
        <p className="mt-1 text-[11px] text-muted">Or click the map to drop this point.</p>
      )}

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: EASE }}
            className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-md border border-line bg-panel shadow-lift"
          >
            {results.map((result, i) => (
              <li key={`${result.lat}-${result.lng}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    setPlace(which, result);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left transition-colors duration-150 ease-calm hover:bg-sage-soft/60"
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

function Comparison({ routes }: { routes: { id: string; label: string; safety: number; duration: number; distance: number }[] }) {
  const data = routes.map((r) => ({
    name: r.label,
    safety: r.safety,
    minutes: r.duration,
    distance: r.distance,
  }));

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="#D9D0C3" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B6157' }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="score"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#6B6157' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis yAxisId="time" orientation="right" hide />
          <ChartTooltip
            cursor={{ fill: 'rgba(31,26,22,0.04)' }}
            contentStyle={{
              background: '#F7F1E8',
              border: '1px solid #D9D0C3',
              borderRadius: 8,
              fontSize: 12,
              color: '#1F1A16',
            }}
            formatter={(value, name) =>
              name === 'Safety score' ? [`${value}/100`, name] : [`${value} min`, name]
            }
            labelFormatter={(label) => {
              const row = data.find((d) => d.name === label);
              return row ? `${row.name} · ${formatDistance(row.distance)}` : label;
            }}
          />
          <Legend
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 11, color: '#6B6157', paddingTop: 4 }}
          />
          <Bar yAxisId="score" dataKey="safety" name="Safety score" radius={[3, 3, 0, 0]} maxBarSize={26}>
            {data.map((row) => (
              <Cell key={row.name} fill={SCORE_COLORS[scoreTone(row.safety)]} />
            ))}
          </Bar>
          <Bar
            yAxisId="time"
            dataKey="minutes"
            name="Minutes"
            fill="#C7BCAC"
            radius={[3, 3, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
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
    selected,
    planning,
    explanation,
    explaining,
    showZones,
    toggle,
    swap,
    reset,
    select,
    run,
    explain,
    signOut,
  } = useApp();

  const fastest = plan ? plan.routes.reduce((a, b) => (a.duration <= b.duration ? a : b)) : null;

  return (
    <aside className="flex h-full w-full flex-col border-r border-line bg-panel">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sage text-panel">
            <Compass size={16} strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-serif text-[15px] leading-none text-ink">Safe Routes</p>
            <p className="mt-1 text-[11px] text-muted">Central Delhi, on foot</p>
          </div>
        </div>
        <button
          type="button"
          className="btn-icon"
          title={email ? `Sign out ${email}` : 'Sign out'}
          onClick={() => {
            signOut();
            router.replace('/login');
          }}
        >
          <LogOut size={15} strokeWidth={1.75} />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <section className="space-y-3">
          <PlaceField which="from" />
          <div className="flex justify-end">
            <button type="button" onClick={swap} className="btn-ghost !py-1.5 text-xs" disabled={!from && !to}>
              <ArrowUpDown size={13} strokeWidth={1.75} />
              Swap
            </button>
          </div>
          <PlaceField which="to" />
        </section>

        <section className="space-y-0.5 border-t border-line pt-4">
          <Switch
            checked={night}
            onChange={() => toggle('night')}
            label={night ? 'Night walking' : 'Daytime walking'}
            hint={night ? 'Lighting and isolation weigh more' : 'Crime exposure weighs more'}
            icon={night ? <Moon size={15} strokeWidth={1.75} /> : <Sun size={15} strokeWidth={1.75} />}
          />
          <Switch
            checked={avoidUnlit}
            onChange={() => toggle('avoidUnlit')}
            label="Avoid poorly lit streets"
            hint="Adds a heavy cost to dark stretches"
            icon={<Sun size={15} strokeWidth={1.75} />}
          />
          <Switch
            checked={avoidIsolated}
            onChange={() => toggle('avoidIsolated')}
            label="Avoid isolated areas"
            hint="Prefers streets with shops and footfall"
            icon={<MapPin size={15} strokeWidth={1.75} />}
          />
        </section>

        <section className="space-y-2">
          <button type="button" className="btn-primary" onClick={() => void run()} disabled={!from || !to || planning}>
            {planning ? <Loader2 size={15} className="animate-spin" /> : null}
            {planning ? 'Comparing routes' : 'Get safer routes'}
          </button>
          {(from || to || plan) && (
            <button type="button" className="btn-ghost w-full" onClick={reset}>
              Clear
            </button>
          )}
        </section>

        <AnimatePresence initial={false}>
          {plan && fastest && (
            <motion.section
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="space-y-4 border-t border-line pt-5"
            >
              <div className="space-y-2">
                {plan.routes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    fastest={fastest}
                    selected={route.id === selected}
                    onSelect={() => {
                      select(route.id);
                      void explain();
                    }}
                  />
                ))}
              </div>

              <div className="card p-3">
                <p className="label mb-2">Safety against time</p>
                <Comparison routes={plan.routes} />
              </div>

              <div className="card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="label">Why this route</p>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
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
                  <p className="font-serif text-[13.5px] leading-relaxed text-ink">
                    {explanation?.text ?? 'Select a route to see the reasoning behind its score.'}
                  </p>
                )}
              </div>

              <div className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="label">Map legend</p>
                  <button
                    type="button"
                    onClick={() => toggle('showZones')}
                    className="text-[11px] text-sage underline underline-offset-4 hover:text-sage-dark"
                  >
                    {showZones ? 'Hide unsafe zones' : 'Show unsafe zones'}
                  </button>
                </div>
                <ul className="space-y-2 text-xs text-muted">
                  {[
                    { color: SCORE_COLORS.good, text: 'Segment scores 72 and above' },
                    { color: SCORE_COLORS.fair, text: 'Segment scores 55 to 71' },
                    { color: SCORE_COLORS.poor, text: 'Segment scores below 55' },
                  ].map((item) => (
                    <li key={item.text} className="flex items-center gap-2">
                      <span className="h-1 w-6 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.text}
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full border border-clay/50 bg-clay/15" />
                    {plan.zones.length} flagged zone{plan.zones.length === 1 ? '' : 's'} near this walk
                  </li>
                </ul>
              </div>

              <p className="text-[11px] leading-relaxed text-muted">
                Scores are estimates built from OpenStreetMap lighting, camera and activity data plus area-level
                crime priors. They describe streets, not people, and are not a guarantee of safety.
              </p>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
