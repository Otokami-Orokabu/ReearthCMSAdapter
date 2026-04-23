import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Landmark } from '../types.ts';

interface Props {
  landmarks: Landmark[];
}

/** List of landmarks that have been marked visited. Grouped by
 *  prefecture for a scrollable digest. */
export function VisitedPage({ landmarks }: Props): React.ReactElement {
  const grouped = useMemo(() => {
    const visited = landmarks.filter((l) => l.visited === true);
    const map = new Map<string, Landmark[]>();
    for (const l of visited) {
      const list = map.get(l.prefecture) ?? [];
      list.push(l);
      map.set(l.prefecture, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ja'));
  }, [landmarks]);

  const total = useMemo(() => landmarks.filter((l) => l.visited === true).length, [landmarks]);

  return (
    <div style={containerStyle}>
      <h1 style={h1Style}>行った名所</h1>
      <div style={mutedStyle}>{total} 件</div>
      {grouped.length === 0 ? (
        <p style={emptyStyle}>
          まだ「行った」にマークされた名所がありません。地図から名所を開いて「行った」にしましょう。
        </p>
      ) : (
        grouped.map(([pref, list]) => (
          <section key={pref} style={sectionStyle}>
            <h2 style={h2Style}>{pref} ({list.length})</h2>
            <ul style={listStyle}>
              {list.map((l) => (
                <li key={l.id}>
                  <Link to={`/landmark/${l.id}`} style={linkStyle}>
                    <span>{l.title}</span>
                    <span style={catStyle}>{l.category}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  flex: 1, minHeight: 0, overflowY: 'auto',
  padding: '1.5rem 2rem', background: '#fafafa',
};
const h1Style: React.CSSProperties = { fontSize: '1.3rem', margin: '0 0 0.3rem' };
const h2Style: React.CSSProperties = { fontSize: '1rem', margin: '1.2rem 0 0.5rem', color: '#333' };
const mutedStyle: React.CSSProperties = { color: '#888', fontSize: '0.85rem' };
const emptyStyle: React.CSSProperties = { color: '#888', marginTop: '2rem' };
const sectionStyle: React.CSSProperties = { marginBottom: '0.5rem' };
const listStyle: React.CSSProperties = {
  listStyle: 'none', padding: 0, margin: 0,
  background: '#e3f2fd', border: '1px solid #bbdefb', borderRadius: '6px',
};
const linkStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '0.55rem 0.8rem', textDecoration: 'none', color: '#0d47a1',
  borderBottom: '1px solid #bbdefb', fontSize: '0.9rem', fontWeight: 500,
};
const catStyle: React.CSSProperties = { color: '#1565c0', fontSize: '0.8rem' };
