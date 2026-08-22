'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Compass } from 'lucide-react';
import { useApp } from '@/store/useApp';
import RouteRail from '@/components/RouteRail';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-ground" />,
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
      <main className="flex min-h-dvh items-center justify-center">
        <span className="flex items-center gap-2 text-sm text-muted">
          <Compass size={16} strokeWidth={1.75} className="text-sage" />
          Loading Safe Routes
        </span>
      </main>
    );
  }

  return (
    <main className="flex h-dvh overflow-hidden">
      <div className="w-[360px] shrink-0">
        <RouteRail />
      </div>
      <div className="relative flex-1">
        <MapView />
      </div>
    </main>
  );
}
