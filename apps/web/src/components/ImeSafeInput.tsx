import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

/**
 * Controlled text input that cooperates with the IME. The parent is not
 * told about the value while an IME composition is in progress (which
 * would otherwise force the input's value back in mid-typing and drop
 * the composition). Updates flow on every keystroke for ASCII input
 * and on compositionend for IME input.
 */
export function ImeSafeInput({ value, onChange, placeholder, style }: Props): React.ReactElement {
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);

  // External value changes (URL nav, filter reset, etc.) should sync
  // into the draft, but only when the user is not in the middle of an
  // IME composition.
  useEffect(() => {
    if (!composingRef.current) setDraft(value);
  }, [value]);

  return (
    <input
      value={draft}
      placeholder={placeholder}
      style={style}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        if (!composingRef.current) onChange(v);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        const v = (e.target as HTMLInputElement).value;
        setDraft(v);
        onChange(v);
      }}
    />
  );
}
