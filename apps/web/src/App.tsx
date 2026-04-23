import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { loadLandmarks, syncLandmarks, syncStories } from './api.ts';
import type { Landmark, Story } from './types.ts';
import { HomePage } from './pages/HomePage.tsx';
import { LandmarkPage } from './pages/LandmarkPage.tsx';
import { VisitedPage } from './pages/VisitedPage.tsx';
import { StoriesPage } from './pages/StoriesPage.tsx';
import { StoryPage } from './pages/StoryPage.tsx';
import { AddPage } from './pages/AddPage.tsx';

/**
 * Top-level shell. Holds the shared landmarks / stories state, drives
 * the initial + reconnection sync, and renders the global nav.
 */
export function App(): React.ReactElement {
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [online, setOnline] = useState(true);

  const refreshLocal = useCallback(async (): Promise<void> => {
    // Local-only read: pulls from IndexedDB / bundled fallback. Used
    // after optimistic writes so the /visited list updates instantly,
    // without waiting for a network round-trip.
    const items = await loadLandmarks();
    setLandmarks(items);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const l = await syncLandmarks();
    setLandmarks(l.items);
    setOnline(l.online);
    const s = await syncStories();
    setStories(s.items);
  }, []);

  useEffect(() => {
    void refresh();
    const onOnline = (): void => {
      void refresh();
    };
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
    };
  }, [refresh]);

  return (
    <BrowserRouter>
      <div style={shellStyle}>
        <header style={headerStyle}>
          <Link to="/" style={brandStyle}>Meisho Explorer</Link>
          <nav style={navStyle}>
            <NavLink to="/" end style={navLinkStyle}>地図</NavLink>
            <NavLink to="/visited" style={navLinkStyle}>行った</NavLink>
            <NavLink to="/stories" style={navLinkStyle}>特集</NavLink>
            <NavLink to="/add" style={navLinkStyle}>追加</NavLink>
          </nav>
          {!online && <span style={offlineBadge}>オフライン</span>}
        </header>
        <main style={mainStyle}>
          <Routes>
            <Route path="/" element={<HomePage landmarks={landmarks} />} />
            <Route
              path="/landmark/:id"
              element={<LandmarkPage onChange={() => { void refreshLocal(); }} />}
            />
            <Route path="/visited" element={<VisitedPage landmarks={landmarks} />} />
            <Route path="/stories" element={<StoriesPage stories={stories} />} />
            <Route path="/story/:id" element={<StoryPage landmarks={landmarks} />} />
            <Route
              path="/add"
              element={
                <AddPage
                  landmarks={landmarks}
                  onCreated={() => { void refreshLocal(); }}
                />
              }
            />
            <Route path="*" element={<div style={missStyle}>404 Not Found</div>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

const shellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '0.5rem 1rem',
  borderBottom: '1px solid #e2e2e2',
  background: '#fff',
  flex: '0 0 auto',
};

const brandStyle: React.CSSProperties = {
  fontWeight: 700,
  color: '#b00020',
  textDecoration: 'none',
  fontSize: '1rem',
};

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  marginLeft: '1rem',
};

const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  textDecoration: 'none',
  color: isActive ? '#b00020' : '#555',
  fontWeight: isActive ? 600 : 400,
  fontSize: '0.9rem',
});

const offlineBadge: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '0.15rem 0.55rem',
  borderRadius: '999px',
  background: '#fdecef',
  color: '#b00020',
  fontSize: '0.75rem',
  fontWeight: 600,
};

const mainStyle: React.CSSProperties = {
  flex: '1 1 0',
  minHeight: 0,
  display: 'flex',
};

const missStyle: React.CSSProperties = {
  padding: '2rem',
  color: '#888',
};
