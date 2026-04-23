import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isQueued, loadLandmark, patchLandmark } from '../api.ts';
import type { Landmark } from '../types.ts';
import { MapView } from '../components/MapView.tsx';

interface Props {
  onChange: () => void;
}

/** Detail page for a single landmark. Shows map + hero + body, and lets
 *  the user toggle "visited" (persisted locally + sent to CMS when
 *  online, otherwise queued). */
export function LandmarkPage({ onChange }: Props): React.ReactElement {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const navigate = useNavigate();
  const [landmark, setLandmark] = useState<Landmark | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const l = await loadLandmark(id);
      if (cancelled) return;
      if (l === null) {
        setNotFound(true);
      } else {
        setLandmark(l);
        setPending(await isQueued(id));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const focus = useMemo((): [number, number] | null => {
    const loc = landmark?.location;
    if (loc === null || loc === undefined) return null;
    if (loc.type !== 'Point') return null;
    return loc.coordinates;
  }, [landmark]);

  const onToggleVisited = async (): Promise<void> => {
    if (landmark === null) return;
    setBusy(true);
    const next = !(landmark.visited === true);
    const res = await patchLandmark(
      id,
      { visited: next },
      { visited: { type: 'bool', value: next } },
    );
    setBusy(false);
    if (res.ok) {
      setLandmark({ ...landmark, visited: next });
      setPending(!res.sent);
      onChange();
    }
  };

  if (notFound) {
    return (
      <div style={padStyle}>
        <p>名所が見つかりません (id: {id})</p>
        <button onClick={() => navigate('/')} style={buttonStyle}>地図へ戻る</button>
      </div>
    );
  }
  if (landmark === null) {
    return <div style={padStyle}>読み込み中…</div>;
  }

  const heroUrl = pickImageUrl(landmark.hero_image);

  return (
    <>
      <aside style={asideStyle}>
        <Link to="/" style={backLinkStyle}>← 地図へ</Link>
        <h1 style={titleStyle}>{landmark.title}</h1>
        <div style={metaStyle}>{landmark.prefecture} · {landmark.category}</div>

        <button
          onClick={() => { void onToggleVisited(); }}
          disabled={busy}
          style={{
            ...visitedBtnStyle,
            background: landmark.visited === true ? '#1e88e5' : '#fff',
            color: landmark.visited === true ? '#fff' : '#333',
            borderColor: landmark.visited === true ? '#0d47a1' : '#ccc',
          }}
        >
          {landmark.visited === true ? '✓ 行った' : '行ったにする'}
        </button>
        {pending && <div style={pendingNoteStyle}>※ オフライン中: 次回接続時に送信</div>}

        {heroUrl !== null && (
          <img src={heroUrl} alt={landmark.title} style={heroStyle} loading="lazy" />
        )}
        <p style={descStyle}>{landmark.description}</p>
        {typeof landmark.story === 'string' && landmark.story.length > 0 && (
          <div style={markdownStyle}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{landmark.story}</ReactMarkdown>
          </div>
        )}
      </aside>
      <MapView landmarks={[landmark]} focus={focus} />
    </>
  );
}

function pickImageUrl(hero: Landmark['hero_image']): string | null {
  if (hero === null || hero === undefined) return null;
  if (!Array.isArray(hero) || hero.length === 0) return null;
  const first = hero[0];
  return typeof first === 'string' ? first : null;
}

const padStyle: React.CSSProperties = { padding: '2rem', color: '#555' };
const asideStyle: React.CSSProperties = {
  width: '420px', minWidth: '420px', height: '100%', overflowY: 'auto',
  padding: '1rem 1.25rem', boxSizing: 'border-box',
  background: '#fff', borderRight: '1px solid #e2e2e2',
};
const backLinkStyle: React.CSSProperties = { fontSize: '0.85rem', textDecoration: 'none', color: '#555' };
const titleStyle: React.CSSProperties = { fontSize: '1.4rem', margin: '0.6rem 0 0.2rem' };
const metaStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#888', marginBottom: '0.8rem' };
const visitedBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: '6px',
  cursor: 'pointer', fontWeight: 600,
};
const pendingNoteStyle: React.CSSProperties = { marginTop: '0.4rem', fontSize: '0.75rem', color: '#b00020' };
const heroStyle: React.CSSProperties = { width: '100%', marginTop: '1rem', borderRadius: '6px' };
const descStyle: React.CSSProperties = { fontSize: '0.95rem', lineHeight: 1.6, marginTop: '1rem' };
const markdownStyle: React.CSSProperties = { fontSize: '0.9rem', lineHeight: 1.7, marginTop: '1rem' };
const buttonStyle: React.CSSProperties = { padding: '0.35rem 0.8rem', border: '1px solid #333', borderRadius: '4px', background: '#fff', cursor: 'pointer' };
