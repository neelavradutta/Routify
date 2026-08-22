'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useApp } from '@/store/useApp';
import RouteCard from '@/components/RouteCard';
import { formatDistance, SCORE_COLORS, scoreTone } from '@/lib/api';

const CARD_ORDER = ['safest', 'balanced', 'fast'];
const EASE = [0.22, 1, 0.36, 1] as const;

function CompareTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string; payload: { distance: number } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 shadow-[0_10px_28px_rgba(15,23,42,0.12)]">
      <p className="text-[11px] font-semibold tracking-tight text-zinc-900">{label}</p>
      <p className="mt-0.5 text-[10px] text-zinc-500">{formatDistance(payload[0].payload.distance)}</p>
      <div className="mt-2 space-y-1 border-t border-zinc-100 pt-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-5 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="tabular-nums font-medium text-zinc-900">
              {entry.name === 'Safety' ? `${entry.value}/100` : `${entry.value} min`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Comparison({
  routes,
  fill = false,
}: {
  routes: { id: string; label: string; safety: number; duration: number; distance: number }[];
  fill?: boolean;
}) {
  const data = routes.map((r) => ({
    name: r.label,
    safety: r.safety,
    minutes: r.duration,
    distance: r.distance,
  }));

  return (
    <div className={`flex min-h-0 flex-col ${fill ? 'h-full' : ''}`}>
      <div
          className={`w-full select-none ${fill ? 'min-h-0 flex-1' : 'h-[5.5rem]'}`}
        onClick={(event) => event.preventDefault()}
        onMouseDown={(event) => event.preventDefault()}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 4, bottom: 2 }}
            barGap={3}
            barCategoryGap="22%"
            style={{ cursor: 'default' }}
          >
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#71717A', fontFamily: 'inherit' }}
              axisLine={{ stroke: '#D4D4D8', strokeWidth: 1 }}
              tickLine={false}
              interval={0}
              height={20}
              tickMargin={6}
            />
            <YAxis
              yAxisId="score"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fontSize: 10, fill: '#71717A', fontFamily: 'inherit' }}
              axisLine={{ stroke: '#A1A1AA', strokeWidth: 1.25 }}
              tickLine={{ stroke: '#A1A1AA', strokeWidth: 1 }}
              width={36}
              tickMargin={6}
              tickFormatter={(value) => `${value}`}
            />
            <YAxis yAxisId="time" orientation="right" hide />
            <ChartTooltip
              trigger="hover"
              cursor={{ fill: 'rgba(24, 24, 27, 0.045)', radius: 6 }}
              content={<CompareTip />}
              wrapperStyle={{ outline: 'none', pointerEvents: 'none' }}
              animationDuration={180}
            />
            <Bar
              yAxisId="score"
              dataKey="safety"
              name="Safety"
              radius={[3, 3, 0, 0]}
              maxBarSize={fill ? 42 : 18}
              cursor="default"
              isAnimationActive
              animationBegin={80}
              animationDuration={720}
              animationEasing="ease-out"
            >
              {data.map((row) => (
                <Cell key={row.name} fill={SCORE_COLORS[scoreTone(row.safety)]} style={{ outline: 'none' }} />
              ))}
            </Bar>
            <Bar
              yAxisId="time"
              dataKey="minutes"
              name="Minutes"
              fill="#38BDF8"
              radius={[3, 3, 0, 0]}
              maxBarSize={fill ? 42 : 18}
              cursor="default"
              isAnimationActive
              animationBegin={140}
              animationDuration={720}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center justify-center gap-3 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-sm" style={{ backgroundColor: SCORE_COLORS.poor }} />
          Safety
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-sm bg-sky-400" />
          Minutes
        </span>
      </div>
    </div>
  );
}

function WhyPoints({ text, refreshKey }: { text?: string; refreshKey: string }) {
  const points = (text ?? 'Pick a route to see why we chose it.')
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  return (
    <AnimatePresence mode="wait">
      <motion.ul
        key={refreshKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.32, ease: EASE }}
        className="space-y-1.5 text-[12px] leading-snug text-ink"
      >
        {points.map((line, i) => (
          <motion.li
            key={`${refreshKey}-${i}-${line}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, delay: 0.05 + i * 0.07, ease: EASE }}
            className="flex gap-2"
          >
            <ArrowRight size={12} strokeWidth={2.25} className="mt-0.5 shrink-0 text-zinc-700" />
            <span>{line}</span>
          </motion.li>
        ))}
      </motion.ul>
    </AnimatePresence>
  );
}

export default function MapRouteDock() {
  const { plan, selected, planning, select, explain, explanation, explaining, from, to, pick, setPick, mapDark } = useApp();
  const fastest = plan ? plan.routes.reduce((a, b) => (a.duration <= b.duration ? a : b)) : null;
  const stacked = plan
    ? [...plan.routes].sort((a, b) => CARD_ORDER.indexOf(a.id) - CARD_ORDER.indexOf(b.id))
    : [];
  const expandedId = stacked.some((item) => item.id === selected) ? selected : stacked[0]?.id;
  const [whyOpen, setWhyOpen] = useState(true);
  const [compareOpen, setCompareOpen] = useState(false);
  const showRoutes = planning || Boolean(plan);

  useEffect(() => {
    if (plan) {
      setWhyOpen(true);
      setCompareOpen(false);
    }
  }, [plan]);

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 top-14 z-[1100] flex w-[min(22rem,calc(100%-5.5rem))] flex-col">
      <div className="pointer-events-auto min-h-0 shrink-0 space-y-1.5 overflow-y-auto overflow-x-visible pr-0.5">
        <AnimatePresence>
          {showRoutes && (
            <motion.div
              key="route-dock"
              initial={{ x: -56, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.85 }}
              className="space-y-1.5"
            >
              {plan && fastest
                ? stacked.map((route, index) => (
                    <RouteCard
                      key={route.id}
                      route={route}
                      fastest={fastest}
                      selected={route.id === expandedId}
                      index={index}
                      onSelect={() => {
                        if (route.id === expandedId) return;
                        select(route.id);
                        void explain();
                      }}
                    />
                  ))
                : [0, 1, 2].map((index) => (
                    <motion.div
                      key={`sk-${index}`}
                      initial={{ opacity: 0, x: -24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.32, delay: index * 0.07, ease: EASE }}
                      className="h-[4.5rem] rounded-xl border border-line bg-white/90 shadow-panel"
                    >
                      <div className="flex h-full items-center gap-3 px-3.5">
                        <span className="h-11 w-11 animate-pulse rounded-xl bg-line" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-20 animate-pulse rounded bg-line" />
                          <div className="h-2.5 w-32 animate-pulse rounded bg-line" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {plan ? (
        <div className="pointer-events-auto mt-1.5 shrink-0 rounded-xl border border-line bg-white shadow-panel">
          <button
            type="button"
            onClick={() => {
              if (whyOpen) {
                setWhyOpen(false);
              } else {
                setWhyOpen(true);
                setCompareOpen(false);
              }
            }}
            className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
            aria-expanded={whyOpen}
          >
            <p className="font-serif text-[13px] leading-tight text-ink">Why this route</p>
            <motion.span
              animate={{ rotate: whyOpen ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-500"
            >
              <ChevronDown size={16} strokeWidth={2} />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {whyOpen && (
              <motion.div
                key="why-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="border-t border-line px-2.5 py-2">
                  <AnimatePresence mode="wait">
                    {explaining && !explanation ? (
                      <motion.div
                        key={`why-load-${expandedId}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.28, ease: EASE }}
                        className="space-y-2 py-1"
                      >
                        <div className="h-2.5 w-full animate-pulse rounded bg-line" />
                        <div className="h-2.5 w-11/12 animate-pulse rounded bg-line" />
                        <div className="h-2.5 w-9/12 animate-pulse rounded bg-line" />
                      </motion.div>
                    ) : (
                      <WhyPoints
                        key={`why-${expandedId}`}
                        refreshKey={expandedId ?? 'why'}
                        text={explanation?.text}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : null}

      {plan ? (
        <div
          className={`pointer-events-auto mt-1.5 flex min-h-0 flex-col rounded-xl border border-line bg-white shadow-panel ${
            compareOpen ? 'flex-1' : 'shrink-0'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              if (compareOpen) {
                setCompareOpen(false);
              } else {
                setCompareOpen(true);
                setWhyOpen(false);
              }
            }}
            className="flex w-full shrink-0 items-center gap-2 px-2.5 py-2 text-left"
            aria-expanded={compareOpen}
          >
            <p className="min-w-0 flex-1 font-serif text-[13px] leading-tight text-ink">Safety Vs Time</p>
            <p className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
              {plan.zones.length} Flagged Unsafe
            </p>
            <motion.span
              animate={{ rotate: compareOpen ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className="flex h-6 w-6 shrink-0 items-center justify-center text-zinc-500"
            >
              <ChevronDown size={16} strokeWidth={2} />
            </motion.span>
          </button>
          {compareOpen ? (
            <div className="min-h-0 flex-1 overflow-hidden border-t border-line px-2.5 py-2">
              <Comparison key="chart-fill" fill routes={plan.routes} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="pointer-events-auto mt-auto flex shrink-0 gap-2 pt-1.5">
        <button
          type="button"
          onClick={() => setPick('from')}
          aria-label={from ? `Start ${from.label}` : 'Start unset'}
          className={`chip ${pick === 'from' ? 'border-violet-700 bg-violet-50 text-violet-950' : mapDark ? '!border-white/15 !bg-zinc-900/80 !text-white' : ''}`}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#5B21B6' }} />
          Start
        </button>
        <button
          type="button"
          onClick={() => setPick('to')}
          aria-label={to ? `Destination ${to.label}` : 'Destination unset'}
          className={`chip ${pick === 'to' ? 'border-red-600 bg-red-50 text-red-950' : mapDark ? '!border-white/15 !bg-zinc-900/80 !text-white' : ''}`}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#DC2626' }} />
          Destination
        </button>
      </div>
    </div>
  );
}
