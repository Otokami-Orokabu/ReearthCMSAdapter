import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Landmark } from '../types.ts';

interface Props {
  landmarks: Landmark[];
  /** Lat/Lng to fly the map to when given (e.g., detail page). */
  focus?: [number, number] | null;
}

/** Base map: GSI (地理院タイル) standard raster tiles. Free to use with
 *  attribution. */
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

const INITIAL_CENTER: [number, number] = [137.5, 36.5];
const INITIAL_ZOOM = 5;

const CATEGORY_COLORS: Record<string, string> = {
  '城郭': '#b00020',
  '寺社': '#e67e22',
  '庭園': '#2e7d32',
  '自然': '#1565c0',
  '近代建築': '#6a1b9a',
  '町並み': '#5d4037',
};

/** Distinct colour reserved for visited markers so they stand apart
 *  from the category palette. */
const VISITED_COLOR = '#1e88e5';

function colorOf(landmark: Landmark): string {
  if (landmark.visited === true) return VISITED_COLOR;
  return CATEGORY_COLORS[landmark.category] ?? '#555';
}

/**
 * MapLibre view. Clicking a marker opens a floating popup with the
 * landmark summary and a "詳細を見る" link; at most one popup is shown
 * at a time, and the map's closeOnClick behaviour dismisses it when the
 * user taps empty map area.
 */
export function MapView({ landmarks, focus }: Props): React.ReactElement {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const openPopup = useCallback(
    (l: Landmark, coord: [number, number]): void => {
      const map = mapRef.current;
      if (map === null) return;

      // Only one popup visible at a time.
      popupRef.current?.remove();

      const node = buildPopupContent(l, (id) => navigate(`/landmark/${id}`));
      const popup = new maplibregl.Popup({
        closeOnClick: true,
        closeButton: true,
        maxWidth: '280px',
        offset: 16,
      })
        .setLngLat(coord)
        .setDOMContent(node)
        .addTo(map);

      popup.on('close', () => {
        if (popupRef.current === popup) popupRef.current = null;
      });

      popupRef.current = popup;
    },
    [navigate],
  );

  // Initialize the map once.
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
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    for (const l of landmarks) {
      const coord = coordOf(l);
      if (coord === null) continue;

      const visited = l.visited === true;
      const el = document.createElement('div');
      Object.assign(el.style, {
        width: visited ? '16px' : '14px',
        height: visited ? '16px' : '14px',
        borderRadius: '50%',
        background: colorOf(l),
        border: visited ? '2px solid #0d47a1' : '2px solid #fff',
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '10px',
        fontWeight: '700',
      } satisfies Partial<CSSStyleDeclaration>);
      if (visited) el.textContent = '✓';
      el.title = visited ? `${l.title} (行った)` : l.title;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openPopup(l, coord);
      });

      const marker = new maplibregl.Marker({ element: el }).setLngLat(coord).addTo(map);
      markersRef.current.push(marker);
    }
  }, [landmarks, openPopup]);

  // Fly to focus when requested.
  useEffect(() => {
    if (focus === null || focus === undefined) return;
    const map = mapRef.current;
    if (map === null) return;
    map.flyTo({ center: focus, zoom: Math.max(map.getZoom(), 11), duration: 800 });
  }, [focus]);

  return <div ref={containerRef} style={{ flex: 1, height: '100%' }} />;
}

function coordOf(l: Landmark): [number, number] | null {
  const loc = l.location;
  if (loc === null || loc === undefined) return null;
  if (loc.type !== 'Point') return null;
  const [lng, lat] = loc.coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  return [lng, lat];
}

/** Build the popup DOM imperatively; MapLibre's Popup accepts an
 *  HTMLElement. Using textContent throughout avoids any HTML-injection
 *  surface on landmark-supplied strings. */
function buildPopupContent(l: Landmark, onDetail: (id: string) => void): HTMLElement {
  const root = document.createElement('div');
  Object.assign(root.style, {
    minWidth: '200px',
    fontFamily: 'system-ui, sans-serif',
    lineHeight: '1.4',
  } satisfies Partial<CSSStyleDeclaration>);

  if (l.visited === true) {
    const badge = document.createElement('div');
    Object.assign(badge.style, {
      color: '#0d47a1',
      fontSize: '0.75rem',
      fontWeight: '700',
      marginBottom: '0.2rem',
    } satisfies Partial<CSSStyleDeclaration>);
    badge.textContent = '✓ 行った';
    root.appendChild(badge);
  }

  const title = document.createElement('div');
  Object.assign(title.style, {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#222',
  } satisfies Partial<CSSStyleDeclaration>);
  title.textContent = l.title;
  root.appendChild(title);

  const meta = document.createElement('div');
  Object.assign(meta.style, {
    fontSize: '0.75rem',
    color: '#888',
    margin: '0.2rem 0 0.5rem',
  } satisfies Partial<CSSStyleDeclaration>);
  meta.textContent = `${l.prefecture} · ${l.category}`;
  root.appendChild(meta);

  if (l.description.length > 0) {
    const desc = document.createElement('p');
    Object.assign(desc.style, {
      fontSize: '0.85rem',
      color: '#333',
      margin: '0 0 0.6rem',
    } satisfies Partial<CSSStyleDeclaration>);
    desc.textContent = truncate(l.description, 90);
    root.appendChild(desc);
  }

  const link = document.createElement('a');
  link.href = `/landmark/${l.id}`;
  Object.assign(link.style, {
    color: '#b00020',
    fontSize: '0.85rem',
    fontWeight: '600',
    textDecoration: 'none',
  } satisfies Partial<CSSStyleDeclaration>);
  link.textContent = '詳細を見る →';
  link.addEventListener('click', (e) => {
    e.preventDefault();
    onDetail(l.id);
  });
  root.appendChild(link);

  return root;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
}
