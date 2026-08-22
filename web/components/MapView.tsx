'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Circle, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Crosshair, Maximize2, MousePointerClick } from 'lucide-react';
import { useApp } from '@/store/useApp';
import { api, SCORE_COLORS, scoreTone, type Route } from '@/lib/api';

const CENTER: [number, number] = [28.6139, 77.2295];
const BBOX = { south: 28.55, west: 77.15, north: 28.68, east: 77.28 };

const pin = (kind: 'from' | 'to') =>
  L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html:
      kind === 'from'
        ? `<span style="display:grid;place-items:center;width:28px;height:28px"><span style="position:absolute;width:28px;height:28px;border-radius:9999px;background:rgba(58,104,84,0.18);animation:pulseRing 1.6s ease-out infinite"></span><span style="width:14px;height:14px;border-radius:9999px;background:#3A6854;box-shadow:0 0 0 3px #F4EEE4"></span></span>`
        : `<span style="display:grid;place-items:center;width:28px;height:28px"><span style="width:13px;height:13px;transform:rotate(45deg);background:#1C1713;box-shadow:0 0 0 3px #F4EEE4"></span></span>`,
  });

const ZONE_LABEL: Record<string, string> = {
  darkness: 'Poorly lit',
  isolation: 'Isolated',
  crime: 'Higher reported risk',
};

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

  useEffect(() => {
    if (bounds) map.flyToBounds(bounds, { padding: [80, 80], duration: 0.7 });
  }, [bounds, map]);

  function locate() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (latitude < BBOX.south || latitude > BBOX.north || longitude < BBOX.west || longitude > BBOX.east) {
          toast.error('You are outside the covered area of central Delhi');
          return;
        }
        map.flyTo([latitude, longitude], 16, { duration: 0.7 });
      },
      () => toast.error('Location permission denied'),
    );
  }

  return (
    <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-2">
      <button type="button" onClick={locate} className="btn-icon" title="Find my location">
        <Crosshair size={16} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() =>
          map.flyToBounds(bounds ?? [[BBOX.south, BBOX.west], [BBOX.north, BBOX.east]], { padding: [80, 80] })
        }
        className="btn-icon"
        title="Fit route"
      >
        <Maximize2 size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function routePoints(route: Route) {
  return route.segments.flatMap((s) => s.coords);
}

export default function MapView() {
  const { from, to, plan, selected, hovered, hover, showZones, pick, setPick } = useApp();

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

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={CENTER}
        zoom={13}
        minZoom={11}
        zoomControl={false}
        className="h-full w-full"
        maxBounds={[
          [BBOX.south - 0.05, BBOX.west - 0.05],
          [BBOX.north + 0.05, BBOX.east + 0.05],
        ]}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />

        <ClickToPick />
        <Controls bounds={bounds} />

        {showZones &&
          plan?.zones.map((zone, i) => (
            <Circle
              key={`zone-${i}`}
              center={[zone.lat, zone.lng]}
              radius={zone.radius}
              pathOptions={{ color: '#B54A32', weight: 1, opacity: 0.4, fillColor: '#B54A32', fillOpacity: 0.12 }}
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
            pathOptions={{ color: '#6A5F54', weight: 4, opacity: 0.22, dashArray: '1 8', lineCap: 'round' }}
          />
        ))}

        {active?.segments.map((segment, i) => (
          <Polyline
            key={`seg-${active.id}-${i}`}
            positions={segment.coords}
            pathOptions={{
              color: SCORE_COLORS[scoreTone(segment.score)],
              weight: hovered === i ? 10 : 7,
              opacity: hovered === null || hovered === i ? 0.96 : 0.42,
              lineCap: 'round',
              lineJoin: 'round',
            }}
            eventHandlers={{
              mouseover: () => hover(i),
              mouseout: () => hover(null),
            }}
          >
            <Tooltip sticky opacity={1}>
              <span className="font-medium">{segment.name ?? `Unnamed ${segment.kind ?? 'path'}`}</span>
              <br />
              {segment.score}/100 · {segment.length} m
              <br />
              <span className="text-muted">
                light {Math.round(segment.factors.light * 100)}% · isolation {Math.round(segment.factors.isolation * 100)}%
              </span>
            </Tooltip>
          </Polyline>
        ))}

        {from && <Marker position={[from.lat, from.lng]} icon={pin('from')} />}
        {to && <Marker position={[to.lat, to.lng]} icon={pin('to')} />}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-4 top-4 z-[1100] flex items-start justify-between gap-3">
        <AnimatePresence>
          <motion.div
            key={pick}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-panel/95 px-3 py-1.5 text-[12px] text-ink shadow-panel backdrop-blur-sm"
          >
            <MousePointerClick size={13} strokeWidth={1.75} className="text-sage" />
            Click map to set {pick === 'from' ? 'start' : 'destination'}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[1100] flex items-end justify-between gap-3">
        <div className="pointer-events-auto flex max-w-[70%] flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPick('from')}
            className={`chip transition-all duration-200 ${pick === 'from' ? 'border-sage/50 bg-sage-soft' : ''}`}
          >
            <span className="h-2 w-2 rounded-full bg-sage" />
            {from?.label ?? 'Start unset'}
          </button>
          <button
            type="button"
            onClick={() => setPick('to')}
            className={`chip transition-all duration-200 ${pick === 'to' ? 'border-ink/20 bg-[#EFE8DC]' : ''}`}
          >
            <span className="h-2 w-2 rotate-45 bg-ink" />
            {to?.label ?? 'Destination unset'}
          </button>
        </div>

        {selectedRoute && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none rounded-xl border border-line bg-panel/95 px-3 py-2 shadow-panel backdrop-blur-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{selectedRoute.label}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{selectedRoute.safety}/100</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
