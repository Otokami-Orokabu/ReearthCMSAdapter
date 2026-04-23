import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Landmark, Story } from '../types.ts';
import { loadStories } from '../api.ts';

interface Props {
  landmarks: Landmark[];
}

/** Detail view for a single story. Markdown links of the form
 *  `/landmark/<id>` are replaced with an inline preview card so the
 *  reader can see the landmark without navigating away. */
export function StoryPage({ landmarks }: Props): React.ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const [story, setStory] = useState<Story | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all = await loadStories();
      if (cancelled) return;
      setStory(all.find((s) => s.id === id) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const landmarksById = useMemo((): Record<string, Landmark> => {
    const m: Record<string, Landmark> = {};
    for (const l of landmarks) m[l.id] = l;
    return m;
  }, [landmarks]);

  const components: Components = useMemo(() => ({
    a({ href, children, ...rest }) {
      const m = typeof href === 'string' ? /^\/landmark\/([A-Za-z0-9]+)$/.exec(href) : null;
      if (m !== null) {
        const landmark = landmarksById[m[1] ?? ''];
        if (landmark !== undefined) {
          return <LandmarkCard landmark={landmark} />;
        }
      }
      return (
        <a href={href} {...rest}>{children}</a>
      );
    },
  }), [landmarksById]);

  if (story === null) {
    return <div style={padStyle}>読み込み中…</div>;
  }

  return (
    <article style={containerStyle}>
      <Link to="/stories" style={backLinkStyle}>← 特集一覧へ</Link>
      <h1 style={titleStyle}>{story.title}</h1>
      <p style={leadStyle}>{story.lead}</p>
      {typeof story.body === 'string' && story.body.length > 0 && (
        <div style={markdownStyle}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {story.body}
          </ReactMarkdown>
        </div>
      )}
    </article>
  );
}

function LandmarkCard({ landmark }: { landmark: Landmark }): React.ReactElement {
  return (
    <Link to={`/landmark/${landmark.id}`} style={cardStyle}>
      <div style={cardTitleStyle}>{landmark.title}</div>
      <div style={cardMetaStyle}>{landmark.prefecture} · {landmark.category}</div>
      <div style={cardDescStyle}>{landmark.description}</div>
    </Link>
  );
}

const containerStyle: React.CSSProperties = {
  flex: 1, minHeight: 0, overflowY: 'auto',
  padding: '1.5rem 2rem', background: '#fafafa',
  maxWidth: '720px', margin: '0 auto',
};
const padStyle: React.CSSProperties = { padding: '2rem', color: '#555' };
const backLinkStyle: React.CSSProperties = { fontSize: '0.85rem', textDecoration: 'none', color: '#555' };
const titleStyle: React.CSSProperties = { fontSize: '1.6rem', margin: '0.6rem 0 0.3rem' };
const leadStyle: React.CSSProperties = { color: '#555', fontSize: '0.95rem' };
const markdownStyle: React.CSSProperties = { fontSize: '0.95rem', lineHeight: 1.8, marginTop: '1.5rem' };

const cardStyle: React.CSSProperties = {
  display: 'block', textDecoration: 'none', color: 'inherit',
  margin: '1rem 0', padding: '0.8rem 1rem',
  background: '#fff', border: '1px solid #e8e8e8', borderRadius: '6px',
};
const cardTitleStyle: React.CSSProperties = { fontWeight: 600 };
const cardMetaStyle: React.CSSProperties = { fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' };
const cardDescStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#555', marginTop: '0.4rem', lineHeight: 1.5 };
