import { useEffect, useRef } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Item } from '../api.ts';

interface Props {
  items: Item[];
  selected: Item | null;
  onSelect: (item: Item) => void;
}

/**
 * Base map style using GSI (国土地理院) standard raster tiles.
 * Free for commercial/personal use with attribution.
 */
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'gsi-std': {
      type: 'raster',
      tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution:
        '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル</a>',
    },
  },
  layers: [{ id: 'gsi-std', type: 'raster', source: 'gsi-std' }],
};

const INITIAL_CENTER: [number, number] = [136.9, 35.16];
const INITIAL_ZOOM = 8;

/**
 * Minimal MapLibre view that renders CMS items as markers.
 *
 * - Base map: GSI standard raster tiles
 * - Markers: items with `location = {type: 'Point', coordinates: [lng, lat]}`
 * - Interaction: marker click → `onSelect(item)`; external `selected` → flyTo
 *
 * Items without a Point location are ignored on the map (they still appear
 * in the Sidebar list).
 */
export function MapView({ items, selected, onSelect }: Props): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Initialize map once.
  useEffect(() => {
    if (containerRef.current === null) return;
    if (mapRef.current !== null) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers with items.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    for (const item of items) {
      const coord = extractPoint(item);
      if (coord === null) continue;

      const el = document.createElement('div');
      Object.assign(el.style, markerStyle);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(item);
      });

      const marker = new maplibregl.Marker({ element: el }).setLngLat(coord).addTo(map);
      markersRef.current.push(marker);
    }
  }, [items, onSelect]);

  // Fly to selected.
  useEffect(() => {
    if (selected === null) return;
    const map = mapRef.current;
    if (map === null) return;
    const coord = extractPoint(selected);
    if (coord === null) return;
    map.flyTo({ center: coord, zoom: Math.max(map.getZoom(), 13), duration: 800 });
  }, [selected]);

  return <div ref={containerRef} style={{ flex: 1, height: '100%' }} />;
}

/**
 * Extract `[lng, lat]` from an item's `location` field, expecting GeoJSON Point.
 * Returns `null` for items without a valid Point location.
 */
function extractPoint(item: Item): [number, number] | null {
  const loc: unknown = item.location;
  if (typeof loc !== 'object' || loc === null) return null;
  if (!('type' in loc) || !('coordinates' in loc)) return null;
  if (loc.type !== 'Point') return null;
  const coords: unknown = loc.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = coords[0];
  const lat = coords[1];
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  return [lng, lat];
}

const markerStyle: Partial<CSSStyleDeclaration> = {
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  background: '#e74c3c',
  border: '2px solid #fff',
  cursor: 'pointer',
  boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
};
