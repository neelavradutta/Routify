'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useApp } from '@/store/useApp';
import RouteRail from '@/components/RouteRail';
import Logo from '@/components/Logo';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#0b0b12]" />,
});

export default function HomePage() {
  const router = useRouter();
  const { token, ready, restore } = useApp();

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    if (ready && !token) router.replace('/login');
  }, [ready, token, router]);

  if (!ready || !token) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ground">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 text-sm text-muted"
        >
          <Logo size={36} withWord={false} />
          Opening the map
        </motion.span>
      </main>
    );
  }

  return (
    <motion.main
      className="flex h-dvh overflow-hidden bg-ground"
      initial={{ opacity: 0, y: 14, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative z-20 w-[400px] shrink-0 py-5 pl-5">
        <RouteRail />
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col px-5 pt-5 pb-0">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-white">
          <MapView />
        </div>
        <p className="flex h-5 shrink-0 items-center justify-center text-center text-[10px] leading-none text-muted">
          Scores are estimates from OpenStreetMap lighting, camera and activity data plus area-level crime priors. They describe streets, not people.
        </p>
      </div>
    </motion.main>
  );
}
