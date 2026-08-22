'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import type { StyleSpecification } from 'maplibre-gl';
import toast from 'react-hot-toast';
import { LIBERTY_STYLE, toAppleNight } from '@/lib/appleNight';
import 'maplibre-gl/dist/maplibre-gl.css';

let cached: StyleSpecification | null = null;

async function liberty(): Promise<StyleSpecification> {
  if (cached) return cached;
  const res = await fetch(LIBERTY_STYLE);
  if (!res.ok) throw new Error('Basemap style failed to load');
  cached = (await res.json()) as StyleSpecification;
  return cached;
}

export default function Basemap({ dark }: { dark: boolean }) {
  const map = useMap();
  const layerRef = useRef<ReturnType<typeof maplibreGL> | null>(null);

  useEffect(() => {
    let dead = false;

    void (async () => {
      try {
        const base = await liberty();
        if (dead) return;
        const style = dark ? toAppleNight(base) : base;
        if (!layerRef.current) {
          const layer = maplibreGL({
            style,
            interactive: false,
            attributionControl: false,
          });
          layer.addTo(map);
          layerRef.current = layer;
          return;
        }
        layerRef.current.getMaplibreMap().setStyle(style, { diff: false });
      } catch {
        if (!dead) toast.error('Basemap failed to load');
      }
    })();

    return () => {
      dead = true;
    };
  }, [dark, map]);

  useEffect(
    () => () => {
      layerRef.current?.remove();
      layerRef.current = null;
    },
    [map],
  );

  return null;
}
