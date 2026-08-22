'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Footprints, ChevronDown } from 'lucide-react';
import { formatDistance, type Route } from '@/lib/api';

type Props = {
  route: Route;
  fastest: Route;
  selected: boolean;
  onSelect: () => void;
  index: number;
};

const EASE = [0.22, 1, 0.36, 1] as const;

const ROUTE_NAME: Record<string, string> = {
  safest: 'Safest',
  balanced: 'Balanced',
  fast: 'Fastest',
};

const ROUTE_PAINT: Record<string, { fill: string; selected: string }> = {
  fast: { fill: '#EA580C', selected: 'border-orange-300 bg-orange-50 shadow-panel' },
  balanced: { fill: '#5B21B6', selected: 'border-violet-300 bg-violet-50 shadow-panel' },
  safest: { fill: '#0F766E', selected: 'border-teal-300 bg-teal-50 shadow-panel' },
};

const FACTORS = [
  { key: 'light', label: 'Lit', color: '#0284C7' },
  { key: 'camera', label: 'Cameras', color: '#4D7C0F' },
  { key: 'isolation', label: 'Isolation', color: '#92400E' },
  { key: 'crime', label: 'Crime', color: '#9F1239' },
] as const;

export default function RouteCard({ route, fastest, selected, onSelect, index }: Props) {
  const paint = ROUTE_PAINT[route.id] ?? ROUTE_PAINT.balanced;
  const name = ROUTE_NAME[route.id] ?? route.label;
  const extraMinutes = route.duration - fastest.duration;
  const extraMetres = route.distance - fastest.distance;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.38, delay: 0.08 + index * 0.07, ease: EASE }}
      whileHover={{ y: selected ? 0 : -1 }}
      whileTap={{ scale: 0.985 }}
      aria-pressed={selected}
      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-shadow duration-200 ease-calm ${
        selected ? paint.selected : 'border-line bg-white hover:border-lime-300 hover:shadow-lift'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold tabular-nums text-white shadow-press"
            style={{ backgroundColor: paint.fill }}
          >
            {route.safety}
          </span>
          <div>
            <p className="text-[14px] font-bold leading-tight tracking-tight text-ink">{name}</p>
            <p className="mt-0.5 text-[11px] text-muted">
              {extraMinutes === 0 && extraMetres === 0
                ? 'Quickest option'
                : `+${extraMinutes} min · +${formatDistance(Math.max(0, extraMetres))}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right text-[11px] text-muted">
            <p className="flex items-center justify-end gap-1 font-medium text-ink">
              <Clock size={12} strokeWidth={1.75} />
              {route.duration} min
            </p>
            <p className="mt-0.5 flex items-center justify-end gap-1">
              <Footprints size={12} strokeWidth={1.75} />
              {formatDistance(route.distance)}
            </p>
          </div>
          <motion.span
            animate={{ rotate: selected ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="flex h-6 w-6 shrink-0 items-center justify-center text-zinc-500"
          >
            <ChevronDown size={16} strokeWidth={2} />
          </motion.span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line/80 pt-2.5">
              {FACTORS.map((factor) => {
                const pct = Math.round(route.factors[factor.key] * 100);
                return (
                  <div key={factor.key}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] text-muted">{factor.label}</span>
                      <span className="text-[11px] tabular-nums text-ink">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/80">
                      <motion.div
                        initial={false}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.45, ease: EASE }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: factor.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
