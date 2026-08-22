'use client';

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
import { useApp } from '@/store/useApp';
import RouteCard from '@/components/RouteCard';
import { formatDistance, SCORE_COLORS, scoreTone } from '@/lib/api';

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
}: {
  routes: { id: string; label: string; safety: number; duration: number; distance: number }[];
}) {
  const data = routes.map((r) => ({
    name: r.label,
    safety: r.safety,
    minutes: r.duration,
    distance: r.distance,
  }));

  return (
    <div className="flex flex-col">
      <div
        className="h-[7.25rem] w-full select-none"
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
              maxBarSize={18}
              cursor="default"
              isAnimationActive={false}
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
              maxBarSize={18}
              cursor="default"
              isAnimationActive={false}
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

export default function MapRouteDock() {
  const { plan, selected, planning, select, explain } = useApp();
  const fastest = plan ? plan.routes.reduce((a, b) => (a.duration <= b.duration ? a : b)) : null;
  const open = planning || Boolean(plan);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="route-dock"
          initial={{ x: -56, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.85 }}
          className="pointer-events-none absolute bottom-16 left-4 top-14 z-[1100] w-[min(22rem,calc(100%-5.5rem))]"
        >
          <div className="pointer-events-auto max-h-full space-y-1.5 overflow-visible pr-0.5">
            {plan && fastest
              ? plan.routes.map((route, index) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    fastest={fastest}
                    selected={route.id === selected}
                    index={index}
                    onSelect={() => {
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

            {plan && (
              <motion.div
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.38, delay: 0.32, ease: EASE }}
                className="rounded-xl border border-line bg-white px-2.5 py-2 shadow-panel"
              >
                <div className="mb-1 flex items-end justify-between gap-2">
                  <p className="font-serif text-[13px] leading-tight text-ink">Safety against time</p>
                  <p className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                    {plan.zones.length} Flagged Unsafe
                  </p>
                </div>
                <Comparison routes={plan.routes} />
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
