'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Polyline, Circle, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Crosshair, Maximize2, Moon, MousePointerClick, Sun } from 'lucide-react';
import { useApp } from '@/store/useApp';
import { api, type Route } from '@/lib/api';
import Basemap from '@/components/Basemap';
import MapRouteDock from '@/components/MapRouteDock';

const ROUTE_RED = '#DC2626';
const ROUTE_RED_GHOST = '#F87171';

const CENTER: [number, number] = [28.6139, 77.2295];
const BBOX = { south: 28.55, west: 77.15, north: 28.68, east: 77.28 };
const FLY = { padding: [88, 88] as [number, number], duration: 1.2, easeLinearity: 0.22 };

function pinIcon(kind: 'from' | 'to') {
  const start = kind === 'from';
        const fill = start ? '#5B21B6' : '#DC2626';
  const letter = start ? 'A' : 'B';
  return L.divIcon({
    className: 'map-pin',
    iconSize: [36, 46],
    iconAnchor: [18, 44],
    popupAnchor: [0, -40],
    html: `<div class="map-pin-inner">
      <svg width="36" height="46" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 1.5C9.44 1.5 2.5 8.3 2.5 16.7c0 10.4 13.4 26.3 14.9 28a1.2 1.2 0 0 0 1.2 0c1.5-1.7 14.9-17.6 14.9-28C33.5 8.3 26.56 1.5 18 1.5Z" fill="${fill}" stroke="white" stroke-width="2"/>
        <circle cx="18" cy="16.5" r="8.2" fill="white"/>
        <text x="18" y="20.4" text-anchor="middle" font-size="11" font-weight="700" font-family="IBM Plex Sans, system-ui, sans-serif" fill="${fill}">${letter}</text>
      </svg>
    </div>`,
  });
}

const ZONE_LABEL: Record<string, string> = {
  darkness: 'Poorly lit',
  isolation: 'Isolated',
  crime: 'Higher reported risk',
};

function SizeFixer() {
  const map = useMap();

  useEffect(() => {
    const fix = () => map.invalidateSize({ animate: false });
    const id = window.setTimeout(fix, 80);
    window.addEventListener('resize', fix);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', fix);
    };
  }, [map]);

  return null;
}

function ClickToPick() {
  const { token, pick, setPlace } = useApp();

  useMapEvents({
    async click(event) {
      if (!token) return;
      const { lat, lng } = event.latlng;
      try {
        const { result } = await api.reverse(token, +lat.toFixed(5), +lng.toFixed(5));
        setPlace(pick, result);
      } catch {
        toast.error('That point is outside the covered area');
      }
    },
  });

  return null;
}

function Controls({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  const { mapDark, toggleMap } = useApp();

  useEffect(() => {
    if (!bounds) return;
    map.flyToBounds(bounds, FLY);
  }, [bounds, map]);

  function locate() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (latitude < BBOX.south || latitude > BBOX.north || longitude < BBOX.west || longitude > BBOX.east) {
          toast.error('You are outside the covered area of central Delhi');
          return;
        }
        map.flyTo([latitude, longitude], 16, { duration: 1.05, easeLinearity: 0.22 });
      },
      () => toast.error('Location permission denied'),
    );
  }

  return (
    <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-2">
      <button type="button" onClick={toggleMap} className="btn-icon" title={mapDark ? 'Light map' : 'Dark map'}>
        {mapDark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
      </button>
      <button type="button" onClick={locate} className="btn-icon" title="Find my location">
        <Crosshair size={16} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => map.flyToBounds(bounds ?? [[BBOX.south, BBOX.west], [BBOX.north, BBOX.east]], FLY)}
        className="btn-icon"
        title="Fit route"
      >
        <Maximize2 size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function routePoints(route: Route) {
  const out: [number, number][] = [];
  for (const segment of route.segments) {
    for (const point of segment.coords) {
      const last = out[out.length - 1];
      if (!last || last[0] !== point[0] || last[1] !== point[1]) out.push(point);
    }
  }
  return out;
}

function FadePolyline({
  positions,
  pathOptions,
}: {
  positions: [number, number][];
  pathOptions: L.PathOptions;
}) {
  const ref = useRef<L.Polyline | null>(null);

  useEffect(() => {
    const line = ref.current;
    if (!line) return;
    const el = line.getElement() as SVGElement | undefined;
    if (!el) return;

    el.style.opacity = '0';
    el.style.transition = 'none';
    const frame = window.requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.95s cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.opacity = String(pathOptions.opacity ?? 1);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [positions, pathOptions.opacity]);

  return <Polyline ref={ref} positions={positions} pathOptions={pathOptions} className="route-fade" />;
}

export default function MapView() {
  const { from, to, plan, selected, hover, showZones, pick, setPick, mapDark } = useApp();

  const active = plan?.routes.find((r) => r.id === selected) ?? null;
  const others = plan?.routes.filter((r) => r.id !== selected) ?? [];
  const selectedRoute = plan?.routes.find((r) => r.id === selected);

  const bounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    if (active) return routePoints(active) as L.LatLngBoundsExpression;
    if (from && to) {
      return [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ];
    }
    return null;
  }, [active, from, to]);

  const activeLine = useMemo(() => (active ? routePoints(active) : []), [active]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer
        center={CENTER}
        zoom={13}
        minZoom={11}
        zoomControl={false}
        zoomAnimation
        fadeAnimation
        markerZoomAnimation
        easeLinearity={0.22}
        className={`absolute inset-0 h-full w-full ${mapDark ? 'map-night' : 'map-day'}`}

        maxBounds={[
          [BBOX.south - 0.05, BBOX.west - 0.05],
          [BBOX.north + 0.05, BBOX.east + 0.05],
        ]}
      >
        <Basemap dark={mapDark} />

        <SizeFixer />
        <ClickToPick />
        <Controls bounds={bounds} />

        {showZones &&
          plan?.zones.slice(0, 18).map((zone, i) => (
            <Circle
              key={`zone-${i}`}
              center={[zone.lat, zone.lng]}
              radius={zone.radius}
              pathOptions={{ color: '#FB7185', weight: 1, opacity: 0.28, fillColor: '#FB7185', fillOpacity: 0.07 }}
            >
              <Tooltip direction="top" opacity={1}>
                <span className="font-medium">{ZONE_LABEL[zone.reason]}</span>
                {zone.name ? ` · ${zone.name}` : ''} · {zone.score}/100
              </Tooltip>
            </Circle>
          ))}

        {others.map((route) => (
          <Polyline
            key={`ghost-${route.id}`}
            positions={routePoints(route)}
            pathOptions={{ color: ROUTE_RED_GHOST, weight: 5, opacity: 0.22, lineCap: 'round', lineJoin: 'round' }}
          />
        ))}

        {active && activeLine.length > 1 && (
          <>
            <FadePolyline
              key={`halo-${active.id}`}
              positions={activeLine}
              pathOptions={{ color: '#7F1D1D', weight: 12, opacity: 0.16, lineCap: 'round', lineJoin: 'round' }}
            />
            <FadePolyline
              key={`draw-${active.id}-${activeLine.length}`}
              positions={activeLine}
              pathOptions={{
                color: ROUTE_RED,
                weight: 6,
                opacity: 1,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {active.segments.map((segment, i) => (
              <Polyline
                key={`hit-${active.id}-${i}`}
                positions={segment.coords}
                pathOptions={{ color: ROUTE_RED, weight: 18, opacity: 0, lineCap: 'round' }}
                eventHandlers={{
                  mouseover: () => hover(i),
                  mouseout: () => hover(null),
                }}
              >
                <Tooltip sticky opacity={1}>
                  <span className="font-medium">{segment.name ?? `Unnamed ${segment.kind ?? 'path'}`}</span>
                  <br />
                  {segment.score}/100 · {segment.length} m
                </Tooltip>
              </Polyline>
            ))}
          </>
        )}

        {from && <Marker position={[from.lat, from.lng]} icon={pinIcon('from')} zIndexOffset={600} />}
        {to && <Marker position={[to.lat, to.lng]} icon={pinIcon('to')} zIndexOffset={700} />}
      </MapContainer>

      <MapRouteDock />

      <div className="pointer-events-none absolute inset-x-4 top-4 z-[1100] flex items-start justify-between gap-3">
        <AnimatePresence>
          <motion.div
            key={pick}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] shadow-panel backdrop-blur-sm ${
              mapDark ? 'border-white/10 bg-zinc-900/85 text-white' : 'border-slate-200 bg-white/95 text-ink'
            }`}
          >
            <MousePointerClick size={13} strokeWidth={1.75} className="text-violet-700" />
            Click map to set {pick === 'from' ? 'start' : 'destination'}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[1100] flex items-end justify-between gap-3">
        <div className="pointer-events-auto flex max-w-[70%] flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPick('from')}
            className={`chip ${pick === 'from' ? 'border-violet-400 bg-violet-50 text-violet-900' : mapDark ? '!border-white/15 !bg-zinc-900/80 !text-white' : ''}`}
          >
            <span className="h-2 w-2 rounded-full bg-violet-600" />
            {from?.label ?? 'Start unset'}
          </button>
          <button
            type="button"
            onClick={() => setPick('to')}
            className={`chip ${pick === 'to' ? 'border-rose-300 bg-rose-50 text-rose-800' : mapDark ? '!border-white/15 !bg-zinc-900/80 !text-white' : ''}`}
          >
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            {to?.label ?? 'Destination unset'}
          </button>
        </div>

        {selectedRoute && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`pointer-events-none rounded-xl border px-3 py-2 shadow-panel backdrop-blur-sm ${
              mapDark ? 'border-white/10 bg-zinc-900/85' : 'border-slate-200 bg-white/95'
            }`}
          >
            <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${mapDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              {selectedRoute.label}
            </p>
            <p className={`mt-0.5 text-sm font-semibold tabular-nums ${mapDark ? 'text-white' : 'text-violet-800'}`}>
              {selectedRoute.safety}/100
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
