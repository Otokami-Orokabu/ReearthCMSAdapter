import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Landmark } from '../types.ts';
import { MapView } from '../components/MapView.tsx';
import { ImeSafeInput } from '../components/ImeSafeInput.tsx';

/** JIS X 0401 都道府県コード順 (北 → 南)。未知の県は末尾に回す。 */
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

function prefectureOrder(name: string): number {
  const i = PREFECTURE_ORDER.indexOf(name);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

interface Props {
  landmarks: Landmark[];
}

/** Home: full-country map + sidebar list with prefecture / category /
 *  visited filters. Clicking a marker or row navigates to the detail. */
export function HomePage({ landmarks }: Props): React.ReactElement {
  // Filter state lives in the URL so "back from detail" restores it
  // and a particular filter combination can be shared by URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const prefFilter = searchParams.get('pref') ?? '';
  const categoryFilter = searchParams.get('cat') ?? '';
  const onlyVisited = searchParams.get('visited') === '1';
  const query = searchParams.get('q') ?? '';

  const updateParam = useCallback(
    (key: string, value: string): void => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === '') next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPrefFilter = useCallback((v: string) => updateParam('pref', v), [updateParam]);
  const setCategoryFilter = useCallback((v: string) => updateParam('cat', v), [updateParam]);
  const setOnlyVisited = useCallback(
    (v: boolean) => updateParam('visited', v ? '1' : ''),
    [updateParam],
  );
  const setQuery = useCallback((v: string) => updateParam('q', v), [updateParam]);

  // 検索語 + 行った フィルタは両プルダウンに共通で効かせる。都道府県プルダウンの
  // 件数は category を含む「他の」フィルタ適用後で数え、category プルダウンの
  // 件数は prefecture を含む他フィルタ適用後で数える (facet 式の絞り込み)。
  const baseFiltered = useMemo(() => {
    const q = query.trim();
    return landmarks.filter((l) => {
      if (onlyVisited && l.visited !== true) return false;
      if (q.length > 0 && !l.title.includes(q) && !l.description.includes(q)) return false;
      return true;
    });
  }, [landmarks, onlyVisited, query]);

  const prefectureCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of baseFiltered) {
      if (categoryFilter !== '' && l.category !== categoryFilter) continue;
      m.set(l.prefecture, (m.get(l.prefecture) ?? 0) + 1);
    }
    return m;
  }, [baseFiltered, categoryFilter]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of baseFiltered) {
      if (prefFilter !== '' && l.prefecture !== prefFilter) continue;
      m.set(l.category, (m.get(l.category) ?? 0) + 1);
    }
    return m;
  }, [baseFiltered, prefFilter]);

  // プルダウンの選択肢は landmarks 全量から作る (count が 0 でも表示して disabled に)
  const prefectures = useMemo(() => {
    const set = new Set<string>();
    for (const l of landmarks) set.add(l.prefecture);
    return [...set].sort((a, b) => prefectureOrder(a) - prefectureOrder(b));
  }, [landmarks]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const l of landmarks) set.add(l.category);
    return [...set].sort((a, b) => a.localeCompare(b, 'ja'));
  }, [landmarks]);

  const prefTotalInFilter = useMemo(
    () => [...prefectureCounts.values()].reduce((a, b) => a + b, 0),
    [prefectureCounts],
  );
  const catTotalInFilter = useMemo(
    () => [...categoryCounts.values()].reduce((a, b) => a + b, 0),
    [categoryCounts],
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    return landmarks.filter((l) => {
      if (prefFilter !== '' && l.prefecture !== prefFilter) return false;
      if (categoryFilter !== '' && l.category !== categoryFilter) return false;
      if (onlyVisited && l.visited !== true) return false;
      if (q.length > 0 && !l.title.includes(q) && !l.description.includes(q)) return false;
      return true;
    });
  }, [landmarks, prefFilter, categoryFilter, onlyVisited, query]);

  return (
    <>
      <aside style={asideStyle}>
        <section style={sectionStyle}>
          <ImeSafeInput
            value={query}
            onChange={setQuery}
            placeholder="キーワード検索"
            style={inputStyle}
          />
        </section>

        <section style={sectionStyle}>
          <label style={labelStyle}>都道府県</label>
          <select
            value={prefFilter}
            onChange={(e) => setPrefFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="">すべて ({prefTotalInFilter})</option>
            {prefectures.map((p) => {
              const c = prefectureCounts.get(p) ?? 0;
              return (
                <option key={p} value={p} disabled={c === 0 && prefFilter !== p}>
                  {p} ({c})
                </option>
              );
            })}
          </select>
        </section>

        <section style={sectionStyle}>
          <label style={labelStyle}>カテゴリ</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="">すべて ({catTotalInFilter})</option>
            {categories.map((c) => {
              const n = categoryCounts.get(c) ?? 0;
              return (
                <option key={c} value={c} disabled={n === 0 && categoryFilter !== c}>
                  {c} ({n})
                </option>
              );
            })}
          </select>
        </section>

        <section style={sectionStyle}>
          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={onlyVisited}
              onChange={(e) => setOnlyVisited(e.target.checked)}
            />
            <span>行ったところだけ</span>
          </label>
        </section>

        <section style={sectionStyle}>
          <div style={mutedStyle}>{filtered.length} 件</div>
          <ul style={listStyle}>
            {filtered.map((l) => {
              const visited = l.visited === true;
              return (
                <li key={l.id} style={listItemStyle}>
                  <Link
                    to={`/landmark/${l.id}`}
                    style={{
                      ...linkStyle,
                      background: visited ? '#e3f2fd' : 'transparent',
                      color: visited ? '#0d47a1' : 'inherit',
                    }}
                  >
                    <span style={{ ...titleStyle, fontWeight: visited ? 600 : 500 }}>
                      {l.title}
                    </span>
                    <span style={metaStyle}>{l.prefecture} · {l.category}</span>
                    {visited && <span style={visitedBadge}>✓</span>}
                  </Link>
                </li>
              );
            })}
            {filtered.length === 0 && <li style={mutedStyle}>(該当なし)</li>}
          </ul>
        </section>
      </aside>
      <MapView landmarks={filtered} />
    </>
  );
}

const asideStyle: React.CSSProperties = {
  width: '320px',
  minWidth: '320px',
  height: '100%',
  overflowY: 'auto',
  padding: '1rem',
  boxSizing: 'border-box',
  background: '#fff',
  borderRight: '1px solid #e2e2e2',
};

const sectionStyle: React.CSSProperties = { margin: '0 0 0.8rem' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' };
const selectStyle: React.CSSProperties = { width: '100%', padding: '0.35rem 0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' };
const checkboxRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '13px', cursor: 'pointer' };
const mutedStyle: React.CSSProperties = { color: '#888', fontSize: '12px', padding: '0.3rem 0.1rem' };
const listStyle: React.CSSProperties = { listStyle: 'none', padding: 0, margin: 0, border: '1px solid #e8e8e8', borderRadius: '4px' };
const listItemStyle: React.CSSProperties = { borderBottom: '1px solid #eee' };
const linkStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', padding: '0.4rem 0.6rem', textDecoration: 'none', color: 'inherit', fontSize: '13px', position: 'relative' };
const titleStyle: React.CSSProperties = { fontWeight: 500 };
const metaStyle: React.CSSProperties = { fontSize: '11px', color: '#888' };
const visitedBadge: React.CSSProperties = { position: 'absolute', top: '0.4rem', right: '0.5rem', color: '#0d47a1', fontWeight: 700 };
