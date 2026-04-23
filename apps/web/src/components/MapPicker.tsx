import { useCallback, useEffect, useRef } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Landmark } from '../types.ts';

interface Props {
  /** Currently-picked coordinate, shown as a red marker. */
  picked: [number, number] | null;
  /** Called when the user clicks the map (not an existing marker). */
  onPick: (lngLat: [number, number]) => void;
  /** Existing landmarks rendered as small grey dots for spatial context. */
  landmarks: Landmark[];
}

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

/** Map used on the /add page. Clicking empty map drops / moves a red
 *  pin and notifies the parent; existing landmarks are drawn as small
 *  grey dots for orientation but are not interactive. A 現在地 button
 *  in the corner calls geolocation and flies to the fix. */
export function MapPicker({ picked, onPick, landmarks }: Props): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pickedMarkerRef = useRef<maplibregl.Marker | null>(null);
  const refMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Keep the click handler's identity stable but always see the latest
  // onPick — otherwise map.on('click', ...) captures a stale closure.
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  const locate = useCallback((): void => {
    const map = mapRef.current;
    if (map === null) return;
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 13), duration: 800 });
        onPickRef.current(lngLat);
      },
      () => {
        // Silent failure — the button click just has no visible effect.
      },
    );
  }, []);

  // Initialise the map once.
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
    map.on('click', (e) => {
      onPickRef.current([e.lngLat.lng, e.lngLat.lat]);
    });
    mapRef.current = map;

    return () => {
      pickedMarkerRef.current?.remove();
      pickedMarkerRef.current = null;
      for (const m of refMarkersRef.current) m.remove();
      refMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync the picked marker.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;
    if (picked === null) {
      pickedMarkerRef.current?.remove();
      pickedMarkerRef.current = null;
      return;
    }
    if (pickedMarkerRef.current === null) {
      const el = document.createElement('div');
      Object.assign(el.style, {
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: '#b00020',
        border: '3px solid #fff',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      } satisfies Partial<CSSStyleDeclaration>);
      pickedMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(picked).addTo(map);
    } else {
      pickedMarkerRef.current.setLngLat(picked);
    }
  }, [picked]);

  // Sync reference-landmark dots.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;
    for (const m of refMarkersRef.current) m.remove();
    refMarkersRef.current = [];

    for (const l of landmarks) {
      const loc = l.location;
      if (loc === null || loc === undefined) continue;
      if (loc.type !== 'Point') continue;
      const [lng, lat] = loc.coordinates;
      if (typeof lng !== 'number' || typeof lat !== 'number') continue;

      const el = document.createElement('div');
      Object.assign(el.style, {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#888',
        border: '1px solid #fff',
        opacity: '0.7',
      } satisfies Partial<CSSStyleDeclaration>);
      el.title = l.title;
      const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
      refMarkersRef.current.push(marker);
    }
  }, [landmarks]);

  return (
    <div style={containerStyle}>
      <div ref={containerRef} style={mapStyle} />
      <button type="button" onClick={locate} style={locateBtnStyle} title="現在地へ">
        📍 現在地
      </button>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  height: '100%',
  minWidth: 0,
};

const mapStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const locateBtnStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '1rem',
  right: '1rem',
  padding: '0.5rem 0.8rem',
  background: '#fff',
  border: '1px solid #ccc',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 600,
  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
};
