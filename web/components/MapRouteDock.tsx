'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '@/store/useApp';
import RouteCard from '@/components/RouteCard';

const EASE = [0.22, 1, 0.36, 1] as const;

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
          className="pointer-events-none absolute bottom-20 left-4 top-16 z-[1100] w-[min(22rem,calc(100%-5.5rem))]"
        >
          <div className="pointer-events-auto max-h-full space-y-2 overflow-y-auto pr-1">
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
