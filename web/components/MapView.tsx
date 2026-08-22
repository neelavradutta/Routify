'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Polyline, Circle, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import { Crosshair, Maximize2, MousePointerClick } from 'lucide-react';
import { useApp } from '@/store/useApp';
import { api, type Route } from '@/lib/api';
import Basemap from '@/components/Basemap';
import MapRouteDock from '@/components/MapRouteDock';

const ROUTE_RED = '#DC2626';
const ROUTE_RED_GHOST = '#F87171';

const CENTER: [number, number] = [22.9734, 78.6569];
const BBOX = { south: 6.5, west: 68.0, north: 37.1, east: 97.5 };
const DRAW_MS = 3400;

const DOCK_PAD = 16 + 352 + 40;

function fitOptions(map: L.Map, insetLeft: boolean): L.FitBoundsOptions {
  const { x, y } = map.getSize();
  const left = insetLeft ? Math.min(DOCK_PAD, Math.max(120, Math.floor(x * 0.44))) : 56;
  const top = 96;
  const right = 68;
  const bottom = 108;
  return {
    paddingTopLeft: [Math.min(left, Math.max(0, x - 160)), Math.min(top, Math.max(0, y - 160))],
    paddingBottomRight: [Math.min(right, Math.max(0, x - 160)), Math.min(bottom, Math.max(0, y - 160))],
    maxZoom: 15,
    animate: false,
    duration: 0,
  };
}

function fitMap(map: L.Map, bounds: L.LatLngBoundsExpression, insetLeft: boolean) {
  const size = map.getSize();
  if (size.x < 80 || size.y < 80) return;
  const box = bounds instanceof L.LatLngBounds ? bounds : L.latLngBounds(bounds as L.LatLngExpression[]);
  map.fitBounds(box, fitOptions(map, insetLeft));
}

function pinIcon(kind: 'from' | 'to') {
  const start = kind === 'from';
  const fill = start ? '#5B21B6' : '#DC2626';
  const glyph = start
    ? `<circle cx="18" cy="12.6" r="2.05" fill="${fill}"/>
       <path d="M18 15.2v3.8m0 0-2.5 4.4M18 19l2.5 4.4M15.4 17.2h5.2" stroke="${fill}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    : `<path d="M14.2 11.2v11.6" stroke="${fill}" stroke-width="1.8" stroke-linecap="round"/>
       <path d="M14.2 11.2h8.2l-2 3.4 2 3.4H14.2V11.2Z" fill="${fill}"/>`;

  return L.divIcon({
    className: 'map-pin',
    iconSize: [26, 33],
    iconAnchor: [13, 32],
    popupAnchor: [0, -28],
    html: `<div class="map-pin-inner">
      <svg width="26" height="33" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 1.5C9.44 1.5 2.5 8.3 2.5 16.7c0 10.4 13.4 26.3 14.9 28a1.2 1.2 0 0 0 1.2 0c1.5-1.7 14.9-17.6 14.9-28C33.5 8.3 26.56 1.5 18 1.5Z" fill="${fill}" stroke="white" stroke-width="2"/>
        <circle cx="18" cy="16.5" r="8.2" fill="white"/>
        ${glyph}
      </svg>
    </div>`,
  });
}

const ZONE_LABEL: Record<string, string> = {
  darkness: 'Poorly lit',
  isolation: 'Few people (~10 a day)',
  crime: 'Higher reported risk',
};

function FollowPins() {
  const map = useMap();
  const { from, to, plan } = useApp();
  const last = useRef('');
  const skipFirst = useRef(true);

  useEffect(() => {
    const key = `${from?.lat},${from?.lng}|${to?.lat},${to?.lng}`;
    if (skipFirst.current) {
      skipFirst.current = false;
      last.current = key;
      return;
    }
    if (plan) return;
    if (key === last.current) return;
    last.current = key;

    if (from && to) {
      fitMap(map, [[from.lat, from.lng], [to.lat, to.lng]], false);
      return;
    }
    const one = from ?? to;
    if (!one) return;
    map.flyTo([one.lat, one.lng], Math.max(map.getZoom(), 15), { duration: 0.85, easeLinearity: 0.22 });
  }, [from, to, plan, map]);

  return null;
}

function inIndia(lat: number, lng: number) {
  return lat >= BBOX.south && lat <= BBOX.north && lng >= BBOX.west && lng <= BBOX.east;
}

const FAST_GEO: PositionOptions = { enableHighAccuracy: false, timeout: 1800, maximumAge: 120_000 };

let lastHere: [number, number] | null = null;

function rememberHere(lat: number, lng: number) {
  lastHere = [lat, lng];
}

function flyHere(map: L.Map, lat: number, lng: number, duration = 0.45) {
  map.flyTo([lat, lng], 16, { duration, easeLinearity: 0.22 });
}

function youIcon() {
  return L.divIcon({
    className: 'you-mark',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: '<span class="you-ring"></span><span class="you-core"></span>',
  });
}

function LiveYou() {
  const map = useMap();
  const [here, setHere] = useState<[number, number] | null>(null);
  const flew = useRef(false);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const onFix = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (!inIndia(lat, lng)) return;
      rememberHere(lat, lng);
      setHere([lat, lng]);
      if (!flew.current) {
        flew.current = true;
        flyHere(map, lat, lng, 0.55);
      }
    };

    navigator.geolocation.getCurrentPosition(onFix, () => undefined, FAST_GEO);
    const watch = navigator.geolocation.watchPosition(onFix, () => undefined, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 30_000,
    });
    return () => navigator.geolocation.clearWatch(watch);
  }, [map]);

  if (!here) return null;
  return (
    <Marker position={here} icon={youIcon()} zIndexOffset={800} interactive={false}>
      <Tooltip direction="top" opacity={1} permanent={false}>
        You are here
      </Tooltip>
    </Marker>
  );
}

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
        toast.error('That point is outside India');
      }
    },
  });

  return null;
}

function Controls({
  bounds,
  insetLeft,
  fitKey,
}: {
  bounds: L.LatLngBoundsExpression | null;
  insetLeft: boolean;
  fitKey: string;
}) {
  const map = useMap();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  useEffect(() => {
    if (!bounds) return;
    const run = () => fitMap(map, bounds, insetLeft);
    run();
    const later = window.setTimeout(run, 120);
    map.on('resize', run);
    return () => {
      window.clearTimeout(later);
      map.off('resize', run);
    };
  }, [bounds, map, fitKey, insetLeft]);

  function locate() {
    if (lastHere) {
      flyHere(map, lastHere[0], lastHere[1], 0.4);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!inIndia(latitude, longitude)) {
          if (!lastHere) toast.error('You are outside the covered area of India');
          return;
        }
        const already = Boolean(lastHere);
        rememberHere(latitude, longitude);
        flyHere(map, latitude, longitude, already ? 0.35 : 0.5);
      },
      () => {
        if (!lastHere) toast.error('Location permission denied');
      },
      FAST_GEO,
    );
  }

  return (
    <div
      ref={box}
      className="absolute right-4 top-4 z-[1000] flex flex-col gap-2"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" onClick={locate} className="btn-icon" title="Find my location">
        <Crosshair size={16} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => fitMap(map, bounds ?? [[BBOX.south, BBOX.west], [BBOX.north, BBOX.east]], insetLeft)}
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

function traceAt(pts: [number, number][], t: number): [number, number][] {
  if (pts.length < 2) return pts;
  const dist = [0];
  for (let i = 1; i < pts.length; i++) {
    dist.push(dist[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const target = dist[dist.length - 1] * Math.min(1, Math.max(0, t));
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (dist[i] <= target) {
      out.push(pts[i]);
      continue;
    }
    const span = dist[i] - dist[i - 1] || 1;
    const u = (target - dist[i - 1]) / span;
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]);
    break;
  }
  return out;
}

function TraceRoute({
  playKey,
  positions,
  insetLeft,
}: {
  playKey: string;
  positions: [number, number][];
  insetLeft: boolean;
}) {
  const map = useMap();
  const ptsRef = useRef(positions);
  ptsRef.current = positions;

  useEffect(() => {
    const pts = ptsRef.current;
    if (pts.length < 2) return;

    fitMap(map, pts, insetLeft);

    let raf = 0;
    let startRaf = 0;
    let halo: L.Polyline | null = null;
    let line: L.Polyline | null = null;
    let origin = 0;
    let dead = false;

    const style = { lineCap: 'round' as const, lineJoin: 'round' as const, interactive: false };

    const tick = (now: number) => {
      if (dead || !halo || !line) return;
      const t = Math.min(1, (now - origin) / DRAW_MS);
      const drawn = traceAt(pts, 1 - (1 - t) ** 3);
      halo.setLatLngs(drawn);
      line.setLatLngs(drawn);
      if (t < 1) raf = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (dead) return;
      const seed: L.LatLngExpression[] = [pts[0], pts[1]];
      halo = L.polyline(seed, { color: '#7F1D1D', weight: 12, opacity: 0.16, ...style }).addTo(map);
      line = L.polyline(seed, { color: ROUTE_RED, weight: 6, opacity: 1, ...style }).addTo(map);
      origin = performance.now();
      raf = window.requestAnimationFrame(tick);
    };

    startRaf = window.requestAnimationFrame(() => {
      startRaf = window.requestAnimationFrame(start);
    });

    return () => {
      dead = true;
      window.cancelAnimationFrame(startRaf);
      window.cancelAnimationFrame(raf);
      halo?.remove();
      line?.remove();
    };
  }, [playKey, map, insetLeft]);

  return null;
}

export default function MapView() {
  const { from, to, plan, selected, hover, avoidUnlit, avoidIsolated, pick, setPick, mapDark } = useApp();
  const showZones = avoidUnlit || avoidIsolated;

  const active = plan?.routes.find((r) => r.id === selected) ?? null;
  const others = plan?.routes.filter((r) => r.id !== selected) ?? [];

  const bounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    const pts: L.LatLngExpression[] = [];
    if (active) pts.push(...(routePoints(active) as L.LatLngExpression[]));
    else if (from && to) pts.push([from.lat, from.lng], [to.lat, to.lng]);
    if (from) pts.push([from.lat, from.lng]);
    if (to) pts.push([to.lat, to.lng]);
    if (pts.length < 2) return null;
    return L.latLngBounds(pts);
  }, [active, from, to]);

  const activeLine = useMemo(() => (active ? routePoints(active) : []), [active]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer
        center={CENTER}
        zoom={5}
        minZoom={4}
        zoomControl={false}
        attributionControl={false}
        zoomAnimation
        fadeAnimation
        markerZoomAnimation
        easeLinearity={0.22}
        className="absolute inset-0 h-full w-full map-day"

        maxBounds={[
          [BBOX.south - 1, BBOX.west - 1],
          [BBOX.north + 1, BBOX.east + 1],
        ]}
      >
        <Basemap dark={false} />

        <SizeFixer />
        <LiveYou />
        <FollowPins />
        <ClickToPick />
        <Controls bounds={bounds} insetLeft={Boolean(plan)} fitKey={active?.id ?? 'pins'} />

        {showZones &&
          plan?.zones.slice(0, 24).map((zone, i) => (
            <Circle
              key={`zone-${i}`}
              center={[zone.lat, zone.lng]}
              radius={zone.radius}
              pathOptions={{
                color: '#E11D48',
                weight: 0,
                opacity: 0,
                fillColor: '#E11D48',
                fillOpacity: 0.32,
                stroke: false,
                className: 'unsafe-zone',
              }}
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
            <TraceRoute key={active.id} playKey={active.id} positions={activeLine} insetLeft />
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
        <div
          className={`pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] shadow-panel backdrop-blur-sm ${
            mapDark ? 'border-white/10 bg-zinc-900/85 text-white' : 'border-slate-200 bg-white/95 text-ink'
          }`}
        >
          <MousePointerClick size={13} strokeWidth={1.75} className="text-violet-700" />
          Click map to set {pick === 'from' ? 'start' : 'destination'}
        </div>
      </div>
    </div>
  );
}
