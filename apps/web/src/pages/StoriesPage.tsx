import { Link } from 'react-router-dom';
import type { Story } from '../types.ts';

interface Props {
  stories: Story[];
}

export function StoriesPage({ stories }: Props): React.ReactElement {
  return (
    <div style={containerStyle}>
      <h1 style={h1Style}>特集</h1>
      {stories.length === 0 ? (
        <p style={emptyStyle}>
          特集はまだありません。CMS の <code>stories</code> モデルに記事を追加してください。
        </p>
      ) : (
        <ul style={listStyle}>
          {stories.map((s) => (
            <li key={s.id} style={itemStyle}>
              <Link to={`/story/${s.id}`} style={linkStyle}>
                <div style={titleStyle}>{s.title}</div>
                <div style={leadStyle}>{s.lead}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  flex: 1, minHeight: 0, overflowY: 'auto',
  padding: '1.5rem 2rem', background: '#fafafa',
};
const h1Style: React.CSSProperties = { fontSize: '1.3rem', margin: '0 0 1rem' };
const emptyStyle: React.CSSProperties = { color: '#888', marginTop: '2rem' };
const listStyle: React.CSSProperties = { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.8rem' };
const itemStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e8e8e8', borderRadius: '6px' };
const linkStyle: React.CSSProperties = { display: 'block', padding: '1rem 1.2rem', textDecoration: 'none', color: 'inherit' };
const titleStyle: React.CSSProperties = { fontWeight: 600, fontSize: '1rem' };
const leadStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#666', marginTop: '0.3rem' };
