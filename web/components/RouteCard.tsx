'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Footprints } from 'lucide-react';
import { SCORE_COLORS, scoreTone, formatDistance, type Route } from '@/lib/api';

type Props = {
  route: Route;
  fastest: Route;
  selected: boolean;
  onSelect: () => void;
  index: number;
};

const EASE = [0.22, 1, 0.36, 1] as const;

const FACTORS = [
  { key: 'light', label: 'Lit', invert: false },
  { key: 'camera', label: 'Cameras', invert: false },
  { key: 'isolation', label: 'Isolation', invert: true },
  { key: 'crime', label: 'Crime', invert: true },
] as const;

export default function RouteCard({ route, fastest, selected, onSelect, index }: Props) {
  const tone = scoreTone(route.safety);
  const color = SCORE_COLORS[tone];
  const extraMinutes = route.duration - fastest.duration;
  const extraMetres = route.distance - fastest.distance;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.05, ease: EASE }}
      whileHover={{ y: selected ? 0 : -1 }}
      whileTap={{ scale: 0.985 }}
      aria-pressed={selected}
      className={`w-full rounded-xl border px-3.5 py-3.5 text-left transition-shadow duration-200 ease-calm ${
        selected
          ? 'border-teal-300 bg-teal-50 shadow-panel'
          : 'border-slate-200 bg-white hover:border-teal-300 hover:shadow-panel'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[15px] font-semibold tabular-nums text-panel shadow-press"
              style={{ backgroundColor: color }}
            >
              {route.safety}
            </span>
            <span className="absolute -left-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[9px] font-semibold text-white">
              {index + 1}
            </span>
          </span>
          <div>
            <p className="text-[13px] font-semibold leading-tight text-ink">{route.label}</p>
            <p className="mt-1 text-[11px] text-muted">
              {extraMinutes === 0 && extraMetres === 0
                ? 'Quickest option'
                : `+${extraMinutes} min · +${formatDistance(Math.max(0, extraMetres))}`}
            </p>
          </div>
        </div>

        <div className="text-right text-[11px] text-muted">
          <p className="flex items-center justify-end gap-1 font-medium text-ink">
            <Clock size={12} strokeWidth={1.75} />
            {route.duration} min
          </p>
          <p className="mt-1 flex items-center justify-end gap-1">
            <Footprints size={12} strokeWidth={1.75} />
            {formatDistance(route.distance)}
          </p>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line/80 pt-3.5">
              {FACTORS.map((factor) => {
                const value = route.factors[factor.key];
                const good = factor.invert ? 1 - value : value;
                return (
                  <div key={factor.key}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] text-muted">{factor.label}</span>
                      <span className="text-[11px] tabular-nums text-ink">{Math.round(value * 100)}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/80">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(good * 100)}%` }}
                        transition={{ duration: 0.45, ease: EASE }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {route.weakest.length > 0 && (
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                Weakest stretch: <span className="font-medium text-ink">{route.weakest[0].name}</span> at{' '}
                {route.weakest[0].score}/100 over {formatDistance(route.weakest[0].length)}.
              </p>
            )}
            {route.duplicateOf && (
              <p className="mt-2 text-[11px] text-muted">Same streets as another option — no safer detour on this pair.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
