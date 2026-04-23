import { useState } from 'react';
import { createItem, type Item, type CmsPayload } from '../api.ts';

interface Props {
  model: string;
  setModel: (m: string) => void;
  items: Item[];
  selected: Item | null;
  onFetch: () => Promise<void>;
  onSelect: (item: Item) => void;
  loading: boolean;
  error: string | null;
}

/**
 * Left-hand info panel: model switcher, fetch / create controls, item
 * list, and the selected item's detail view. State is owned by App;
 * this component keeps only the local form state.
 */
export function Sidebar(props: Props): React.ReactElement {
  const { model, setModel, items, selected, onFetch, onSelect, loading, error } = props;
  const [title, setTitle] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(): Promise<void> {
    if (title.trim().length === 0) return;
    setCreateError(null);
    try {
      const payload: CmsPayload = { title: { type: 'text', value: title } };
      await createItem(model, payload);
      setTitle('');
      await onFetch();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <aside style={asideStyle}>
      <h1 style={h1Style}>Re:Earth CMS Client</h1>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Model</h2>
        <div style={rowStyle}>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={inputStyle}
            placeholder="hazzrd_reports"
          />
          <button onClick={() => void onFetch()} disabled={loading} style={buttonStyle}>
            Fetch
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Create (title)</h2>
        <div style={rowStyle}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
            placeholder="新規タイトル"
          />
          <button
            onClick={() => void handleCreate()}
            disabled={loading || title.trim().length === 0}
            style={buttonStyle}
          >
            Create
          </button>
        </div>
        {createError !== null && <div style={errorStyle}>Error: {createError}</div>}
      </section>

      {loading && <div style={mutedStyle}>Loading...</div>}
      {error !== null && <div style={errorStyle}>Error: {error}</div>}

      <section style={sectionStyle}>
        <h2 style={h2Style}>Items ({items.length})</h2>
        <ul style={listStyle}>
          {items.map((item, idx) => {
            const id = typeof item.id === 'string' ? item.id : `__${idx}`;
            const label =
              typeof item.title === 'string' && item.title.length > 0
                ? item.title
                : '(no title)';
            const selectedId = selected !== null && typeof selected.id === 'string' ? selected.id : null;
            const isActive = selectedId !== null && selectedId === id;
            return (
              <li
                key={id}
                onClick={() => onSelect(item)}
                style={isActive ? listItemActiveStyle : listItemStyle}
              >
                {label}
              </li>
            );
          })}
          {items.length === 0 && !loading && <li style={mutedStyle}>(no items)</li>}
        </ul>
      </section>

      {selected !== null && (
        <section style={sectionStyle}>
          <h2 style={h2Style}>Detail</h2>
          <pre style={preStyle}>{JSON.stringify(selected, null, 2)}</pre>
        </section>
      )}
    </aside>
  );
}

const asideStyle: React.CSSProperties = {
  width: '340px',
  minWidth: '340px',
  height: '100%',
  overflowY: 'auto',
  padding: '1rem',
  boxSizing: 'border-box',
  background: '#fafafa',
  borderRight: '1px solid #e2e2e2',
};

const h1Style: React.CSSProperties = {
  fontSize: '1rem',
  margin: '0 0 1rem',
  color: '#222',
};

const h2Style: React.CSSProperties = {
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  margin: '0 0 0.5rem',
  color: '#666',
};

const sectionStyle: React.CSSProperties = {
  margin: '0.8rem 0',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.35rem 0.55rem',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '13px',
  minWidth: 0,
};

const buttonStyle: React.CSSProperties = {
  padding: '0.35rem 0.85rem',
  border: '1px solid #333',
  borderRadius: '4px',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '13px',
  whiteSpace: 'nowrap',
};

const errorStyle: React.CSSProperties = {
  marginTop: '0.4rem',
  color: '#b00020',
  background: '#fdecef',
  padding: '0.4rem 0.6rem',
  borderRadius: '4px',
  fontSize: '12px',
};

const mutedStyle: React.CSSProperties = {
  color: '#888',
  fontSize: '12px',
};

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  border: '1px solid #e2e2e2',
  borderRadius: '4px',
};

const listItemStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  borderBottom: '1px solid #eee',
  cursor: 'pointer',
  fontSize: '13px',
};

const listItemActiveStyle: React.CSSProperties = {
  ...listItemStyle,
  background: '#e8f1ff',
  fontWeight: 600,
};

const preStyle: React.CSSProperties = {
  background: '#f0f0f0',
  padding: '0.6rem',
  borderRadius: '4px',
  overflow: 'auto',
  maxHeight: '280px',
  fontSize: '11px',
  margin: 0,
};
