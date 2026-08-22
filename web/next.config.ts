import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  transpilePackages: ['maplibre-gl', '@maplibre/maplibre-gl-leaflet'],
};

export default config;
