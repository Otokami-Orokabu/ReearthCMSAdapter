import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createLandmark } from '../api.ts';
import type { Landmark } from '../types.ts';
import { MapPicker } from '../components/MapPicker.tsx';
import { ImeSafeInput } from '../components/ImeSafeInput.tsx';

/** JIS X 0401 都道府県コード順 (北 → 南)。 */
const PREFECTURE_ORDER: readonly string[] = [
  '北海道',
  '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

interface Props {
  landmarks: Landmark[];
  onCreated: () => void;
}

/** Form to register a new landmark. Map tap / 現在地 button fills the
 *  location; title + category + prefecture + location are required.
 *  Submit goes through `createLandmark` (optimistic + offline queue);
 *  on success we navigate to the detail page of the new id (which may
 *  still be a local-<uuid> if the create was queued). */
export function AddPage({ landmarks, onCreated }: Props): React.ReactElement {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [prefecture, setPrefecture] = useState('');
  const [picked, setPicked] = useState<[number, number] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Dropdown choices come from the landmarks already loaded so users
  // stick to the existing taxonomy.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const l of landmarks) if (l.category.length > 0) set.add(l.category);
    return [...set].sort((a, b) => a.localeCompare(b, 'ja'));
  }, [landmarks]);

  const prefectures = useMemo(() => {
    const set = new Set<string>();
    for (const l of landmarks) if (l.prefecture.length > 0) set.add(l.prefecture);
    const order = (p: string): number => {
      const i = PREFECTURE_ORDER.indexOf(p);
      return i === -1 ? Number.POSITIVE_INFINITY : i;
    };
    return [...set].sort((a, b) => order(a) - order(b));
  }, [landmarks]);

  const canSubmit =
    title.trim().length > 0 &&
    category.length > 0 &&
    prefecture.length > 0 &&
    picked !== null &&
    !submitting;

  const onSubmit = async (): Promise<void> => {
    if (!canSubmit || picked === null) return;
    setSubmitting(true);

    const t = title.trim();
    const d = description.trim();
    const seed: Omit<Landmark, 'id'> = {
      title: t,
      description: d,
      category,
      prefecture,
      location: { type: 'Point', coordinates: picked },
      visited: false,
    };

    const res = await createLandmark(seed, {
      title: { type: 'text', value: t },
      description: { type: 'textArea', value: d },
      category: { type: 'select', value: category },
      prefecture: { type: 'select', value: prefecture },
      location: {
        type: 'text',
        value: JSON.stringify({ type: 'Point', coordinates: picked }),
      },
      visited: { type: 'bool', value: false },
    });

    setSubmitting(false);
    onCreated();
    navigate(`/landmark/${res.landmark.id}`);
  };

  return (
    <>
      <aside style={asideStyle}>
        <Link to="/" style={backLinkStyle}>← 地図へ</Link>
        <h1 style={titleStyle}>名所を追加</h1>

        <label style={labelStyle}>名称 *</label>
        <ImeSafeInput value={title} onChange={setTitle} placeholder="例: 姫路城" style={inputStyle} />

        <label style={labelStyle}>カテゴリ *</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
          <option value="">選択してください</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <label style={labelStyle}>都道府県 *</label>
        <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)} style={selectStyle}>
          <option value="">選択してください</option>
          {prefectures.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <label style={labelStyle}>説明</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="任意"
          style={textareaStyle}
          rows={4}
        />

        <label style={labelStyle}>位置 *</label>
        <div style={locationBoxStyle}>
          {picked === null ? (
            <span style={mutedStyle}>地図をクリックまたは「現在地」で指定</span>
          ) : (
            <span style={coordStyle}>
              経度 {picked[0].toFixed(6)} / 緯度 {picked[1].toFixed(6)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => { void onSubmit(); }}
          disabled={!canSubmit}
          style={{ ...submitStyle, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
        >
          {submitting ? '送信中…' : '送信する'}
        </button>
        <div style={hintStyle}>
          オフライン時はローカル保存され、次回接続時に送信されます。
        </div>
      </aside>
      <MapPicker picked={picked} onPick={setPicked} landmarks={landmarks} />
    </>
  );
}

const asideStyle: React.CSSProperties = {
  width: '360px', minWidth: '360px', height: '100%', overflowY: 'auto',
  padding: '1rem 1.25rem', boxSizing: 'border-box',
  background: '#fff', borderRight: '1px solid #e2e2e2',
};
const backLinkStyle: React.CSSProperties = { fontSize: '0.85rem', textDecoration: 'none', color: '#555' };
const titleStyle: React.CSSProperties = { fontSize: '1.25rem', margin: '0.6rem 0 1rem' };
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', color: '#666', margin: '0.8rem 0 0.25rem',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #ccc',
  borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '0.4rem 0.5rem', border: '1px solid #ccc',
  borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box',
};
const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #ccc',
  borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical',
  fontFamily: 'inherit',
};
const locationBoxStyle: React.CSSProperties = {
  padding: '0.5rem 0.6rem', border: '1px dashed #ccc', borderRadius: '4px',
  background: '#fafafa', fontSize: '12px',
};
const mutedStyle: React.CSSProperties = { color: '#999' };
const coordStyle: React.CSSProperties = { fontFamily: 'monospace', color: '#333' };
const submitStyle: React.CSSProperties = {
  marginTop: '1.2rem', width: '100%', padding: '0.6rem',
  border: '1px solid #b00020', borderRadius: '6px',
  background: '#b00020', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
};
const hintStyle: React.CSSProperties = {
  marginTop: '0.5rem', fontSize: '0.75rem', color: '#888', lineHeight: 1.5,
};
