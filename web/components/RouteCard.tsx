'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Footprints } from 'lucide-react';
import { SCORE_COLORS, scoreTone, formatDistance, type Route } from '@/lib/api';

type Props = {
  route: Route;
  fastest: Route;
  selected: boolean;
  onSelect: () => void;
};

const EASE = [0.2, 0.8, 0.2, 1] as const;

const FACTORS = [
  { key: 'light', label: 'Lit', invert: false },
  { key: 'camera', label: 'Cameras', invert: false },
  { key: 'isolation', label: 'Isolation', invert: true },
  { key: 'crime', label: 'Crime exposure', invert: true },
] as const;

export default function RouteCard({ route, fastest, selected, onSelect }: Props) {
  const tone = scoreTone(route.safety);
  const color = SCORE_COLORS[tone];
  const extraMinutes = route.duration - fastest.duration;
  const extraMetres = route.distance - fastest.distance;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      layout
      transition={{ duration: 0.2, ease: EASE }}
      aria-pressed={selected}
      className={`w-full rounded-lg border px-3.5 py-3 text-left transition-colors duration-150 ease-calm ${
        selected ? 'border-sage/50 bg-sage-soft/60' : 'border-line bg-panel hover:bg-white/60'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[13px] font-semibold text-panel"
            style={{ backgroundColor: color }}
          >
            {route.safety}
          </span>
          <div>
            <p className="text-sm font-medium leading-tight text-ink">{route.label}</p>
            <p className="mt-0.5 text-xs text-muted">
              {extraMinutes === 0 && extraMetres === 0
                ? 'Quickest option'
                : `+${extraMinutes} min · +${formatDistance(Math.max(0, extraMetres))}`}
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-muted">
          <p className="flex items-center justify-end gap-1 text-ink">
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
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3">
              {FACTORS.map((factor) => {
                const value = route.factors[factor.key];
                const good = factor.invert ? 1 - value : value;
                return (
                  <div key={factor.key}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] text-muted">{factor.label}</span>
                      <span className="text-[11px] tabular-nums text-ink">{Math.round(value * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-line">
                      <div
                        className="h-1 rounded-full transition-[width] duration-300 ease-calm"
                        style={{ width: `${Math.round(good * 100)}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {route.weakest.length > 0 && (
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Weakest stretch:{' '}
                <span className="text-ink">{route.weakest[0].name}</span> at {route.weakest[0].score}/100 over{' '}
                {formatDistance(route.weakest[0].length)}.
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
