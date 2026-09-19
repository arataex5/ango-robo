import type { ReactNode } from 'react';
import type { Code } from '../core/criteria';

export const COLOR_NAMES = ['青', '黄', '紫'] as const;
export const COLOR_CLASS = ['c-blue', 'c-yellow', 'c-purple'] as const;
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/** 色のマーク：青▲ 黄■ 紫● */
export function Shape({ color, size = 16 }: { color: number; size?: number }) {
  const cls = `shape ${COLOR_CLASS[color]}`;
  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 20 20" aria-label={COLOR_NAMES[color]} role="img">
      {color === 0 && <path d="M10 2.5 18.5 17.5H1.5Z" strokeLinejoin="round" />}
      {color === 1 && <rect x="2.5" y="2.5" width="15" height="15" rx="3" />}
      {color === 2 && <circle cx="10" cy="10" r="8" />}
    </svg>
  );
}

/** 要件テキスト中の {B}{Y}{P} をマークに置き換える */
export function CritText({ text }: { text: string }) {
  const parts = text.split(/(\{[BYP]\})/g);
  return (
    <>
      {parts.map((p, i) =>
        p === '{B}' ? <Shape key={i} color={0} /> : p === '{Y}' ? <Shape key={i} color={1} /> : p === '{P}' ? <Shape key={i} color={2} /> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export function CodeChips({ code, size = 'md' }: { code: Code; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`codechips ${size}`}>
      {code.map((d, i) => (
        <span key={i} className={`digit ${COLOR_CLASS[i]}`}>
          {d}
        </span>
      ))}
    </span>
  );
}

export function Stars({ n, big = false }: { n: number; big?: boolean }) {
  return (
    <span className={`stars ${big ? 'big' : ''}`} aria-label={`星${n}つ`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? 'star on' : 'star'} style={big ? { animationDelay: `${i * 0.18}s` } : undefined}>
          ★
        </span>
      ))}
    </span>
  );
}

const ROBOT_COLORS = ['#FF8FA3', '#6FD3C4', '#FFB84C', '#8FB8FF', '#C59BFF', '#9BDB6E'];

/** 検証機ロボ。mood で表情が変わる */
export function Robot({ index, mood = 'idle', size = 56 }: { index: number; mood?: 'idle' | 'ok' | 'ng'; size?: number }) {
  const body = mood === 'ok' ? '#3CCB7F' : mood === 'ng' ? '#FF6B6B' : ROBOT_COLORS[index % 6];
  return (
    <svg className={`robot ${mood}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <line x1="32" y1="4" x2="32" y2="14" stroke="#2B2D5B" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="5" r="4" fill="#FFD84C" stroke="#2B2D5B" strokeWidth="3" />
      <rect x="6" y="14" width="52" height="44" rx="14" fill={body} stroke="#2B2D5B" strokeWidth="3.5" />
      <rect x="1" y="30" width="7" height="14" rx="3.5" fill={body} stroke="#2B2D5B" strokeWidth="3" />
      <rect x="56" y="30" width="7" height="14" rx="3.5" fill={body} stroke="#2B2D5B" strokeWidth="3" />
      <rect x="13" y="21" width="38" height="22" rx="9" fill="#FFFDF5" stroke="#2B2D5B" strokeWidth="3" />
      {mood === 'ok' ? (
        <>
          <path d="M19 33q4-7 8 0" fill="none" stroke="#2B2D5B" strokeWidth="3" strokeLinecap="round" />
          <path d="M37 33q4-7 8 0" fill="none" stroke="#2B2D5B" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : mood === 'ng' ? (
        <>
          <path d="M19 28l7 7m0-7-7 7" stroke="#2B2D5B" strokeWidth="3" strokeLinecap="round" />
          <path d="M38 28l7 7m0-7-7 7" stroke="#2B2D5B" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="23" cy="32" r="4" fill="#2B2D5B" />
          <circle cx="41" cy="32" r="4" fill="#2B2D5B" />
          <circle cx="24.5" cy="30.5" r="1.4" fill="#fff" />
          <circle cx="42.5" cy="30.5" r="1.4" fill="#fff" />
        </>
      )}
      <path
        d={mood === 'ng' ? 'M25 52q7-5 14 0' : 'M25 49q7 6 14 0'}
        fill="none"
        stroke="#2B2D5B"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Seg<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const DIFF_LABEL = { easy: 'やさしい', standard: 'ふつう', hard: 'むずかしい' } as const;
