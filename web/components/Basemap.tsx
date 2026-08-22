'use client';

import { TileLayer } from 'react-leaflet';

/**
 * Raster Voyager tiles — no MapLibre vector fetch (those 404/CORS as TypeError: Failed to fetch).
 */
export default function Basemap({ dark: _dark }: { dark: boolean }) {
  return (
    <TileLayer
      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      subdomains="abcd"
      maxZoom={20}
      attribution=""
    />
  );
}
