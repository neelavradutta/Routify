import type { StyleSpecification } from 'maplibre-gl';

export const LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

type AnyLayer = {
  id: string;
  type: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};

function fillColor(id: string) {
  if (id.includes('water')) return '#0F172A';
  if (id.includes('park') || id.includes('wood') || id.includes('grass') || id.includes('cemetery') || id.includes('wetland')) {
    return '#1C2A1D';
  }
  if (id.includes('pitch') || id.includes('track')) return '#24301F';
  if (id.includes('hospital')) return '#2A1C20';
  if (id.includes('school')) return '#1E2420';
  if (id.includes('sand')) return '#2A261C';
  if (id.includes('ice')) return '#1A2228';
  if (id.includes('building')) return '#2C2C2E';
  if (id.includes('aeroway') || id.includes('road_area')) return '#323236';
  return '#1C1C1E';
}

function lineColor(id: string) {
  const casing = id.includes('casing');
  if (id.includes('waterway')) return '#152033';
  if (id.includes('rail')) return casing ? '#1A1A1A' : '#3D3D42';
  if (id.includes('motorway')) return casing ? '#6B5420' : '#C6A24A';
  if (id.includes('trunk_primary')) return casing ? '#5A4A24' : '#B49654';
  if (id.includes('secondary') || id.includes('tertiary')) return casing ? '#2A2A2C' : '#505054';
  if (id.includes('street') || id.includes('minor') || id.includes('_link')) return casing ? '#242426' : '#3C3C40';
  if (id.includes('service') || id.includes('path') || id.includes('pedestrian') || id.includes('track')) {
    return casing ? '#1E1E20' : '#343438';
  }
  if (id.includes('boundary')) return '#3A3A42';
  if (id.includes('aeroway')) return '#3A3A3C';
  if (id.includes('park')) return '#1C2A1D';
  return '#3A3A3C';
}

function textColor(id: string) {
  if (id.startsWith('poi') || id === 'airport' || id === 'poi_transit') return '#5AC8C8';
  if (id.startsWith('water')) return '#8BA3BF';
  if (id.startsWith('label_city') || id === 'label_town' || id === 'label_city_capital') return '#F2F2F7';
  if (id.startsWith('label_')) return '#D1D1D6';
  if (id.startsWith('highway-name-major')) return '#E4E4E8';
  return '#C7C7CC';
}

function restyle(layer: AnyLayer) {
  const { id } = layer;
  const paint = { ...layer.paint };
  const layout = { ...layer.layout };

  if (id === 'natural_earth' || id === 'building-3d') {
    layout.visibility = 'none';
    layer.paint = paint;
    layer.layout = layout;
    return;
  }

  if (layer.type === 'background') paint['background-color'] = '#1A1A1A';
  if (layer.type === 'fill') {
    paint['fill-color'] = fillColor(id);
    if ('fill-outline-color' in paint) paint['fill-outline-color'] = fillColor(id);
  }
  if (layer.type === 'line') paint['line-color'] = lineColor(id);
  if (layer.type === 'fill-extrusion') layout.visibility = 'none';
  if (layer.type === 'symbol') {
    paint['text-color'] = textColor(id);
    paint['text-halo-color'] = '#1A1A1A';
    paint['text-halo-width'] = 1.25;
    if (id.startsWith('label_city') || id === 'label_town' || id === 'label_village') {
      layout['text-transform'] = 'uppercase';
    }
  }

  layer.paint = paint;
  layer.layout = layout;
}

export function toAppleNight(style: StyleSpecification): StyleSpecification {
  const next = structuredClone(style) as StyleSpecification;
  for (const layer of next.layers) restyle(layer as AnyLayer);
  return next;
}
