import { useCallback, useState } from 'react';
import { listItems, type Item } from './api.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { MapView } from './components/MapView.tsx';

/**
 * Top-level shell. Owns the shared state (current model, item list,
 * selected item, loading / error flags) and composes Sidebar and
 * MapView.
 */
export function App(): React.ReactElement {
  const [model, setModel] = useState('hazzrd_reports');
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await listItems(model);
      setItems(result);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [model]);

  return (
    <div style={rootStyle}>
      <Sidebar
        model={model}
        setModel={setModel}
        items={items}
        selected={selected}
        onFetch={handleFetch}
        onSelect={setSelected}
        loading={loading}
        error={error}
      />
      <MapView items={items} selected={selected} onSelect={setSelected} />
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  display: 'flex',
  height: '100%',
  width: '100%',
};
