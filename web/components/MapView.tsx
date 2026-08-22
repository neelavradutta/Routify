'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Circle, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import { Crosshair, Maximize2 } from 'lucide-react';
import { useApp } from '@/store/useApp';
import { api, SCORE_COLORS, scoreTone, type Route } from '@/lib/api';

const CENTER: [number, number] = [28.6139, 77.2295];
const BBOX = { south: 28.55, west: 77.15, north: 28.68, east: 77.28 };

const pin = (kind: 'from' | 'to') =>
  L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html:
      kind === 'from'
        ? `<span style="display:block;width:14px;height:14px;margin:4px;border-radius:9999px;background:#3F6F5B;box-shadow:0 0 0 4px rgba(63,111,91,0.18)"></span>`
        : `<span style="display:block;width:14px;height:14px;margin:4px;border-radius:3px;background:#1F1A16;box-shadow:0 0 0 4px rgba(31,26,22,0.14)"></span>`,
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
    if (bounds) map.flyToBounds(bounds, { padding: [70, 70], duration: 0.6 });
  }, [bounds, map]);

  function locate() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (latitude < BBOX.south || latitude > BBOX.north || longitude < BBOX.west || longitude > BBOX.east) {
          toast.error('You are outside the covered area of central Delhi');
          return;
        }
        map.flyTo([latitude, longitude], 16, { duration: 0.6 });
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
        onClick={() => map.flyToBounds(bounds ?? [[BBOX.south, BBOX.west], [BBOX.north, BBOX.east]], { padding: [70, 70] })}
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
  const { from, to, plan, selected, hovered, hover, showZones } = useApp();

  const active = plan?.routes.find((r) => r.id === selected) ?? null;
  const others = plan?.routes.filter((r) => r.id !== selected) ?? [];

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
            pathOptions={{ color: '#B54A32', weight: 1, opacity: 0.35, fillColor: '#B54A32', fillOpacity: 0.1 }}
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
          pathOptions={{ color: '#6B6157', weight: 3, opacity: 0.28, dashArray: '2 7' }}
        />
      ))}

      {active?.segments.map((segment, i) => (
        <Polyline
          key={`seg-${active.id}-${i}`}
          positions={segment.coords}
          pathOptions={{
            color: SCORE_COLORS[scoreTone(segment.score)],
            weight: hovered === i ? 9 : 6,
            opacity: hovered === null || hovered === i ? 0.95 : 0.5,
            lineCap: 'round',
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
              light {Math.round(segment.factors.light * 100)}% · isolation{' '}
              {Math.round(segment.factors.isolation * 100)}%
            </span>
          </Tooltip>
        </Polyline>
      ))}

      {from && <Marker position={[from.lat, from.lng]} icon={pin('from')} />}
      {to && <Marker position={[to.lat, to.lng]} icon={pin('to')} />}
    </MapContainer>
  );
}
