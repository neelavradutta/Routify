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
    <main className="flex h-dvh overflow-hidden bg-ground">
      <div className="relative z-20 w-[400px] shrink-0">
        <RouteRail />
      </div>
      <div className="relative min-w-0 flex-1 p-3">
        <div className="relative h-full overflow-hidden rounded-2xl shadow-lift">
          <MapView />
        </div>
      </div>
    </main>
  );
}
