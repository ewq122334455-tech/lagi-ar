/**
 * "다시 조합하기" — recolouring a bag's parts. Parts are matched by the node names in the GLB,
 * so a model without these names simply has nothing to remix.
 */
export interface RemixPart {
  key: string;
  label: string;
  match: RegExp;
}

export const REMIX_PARTS: RemixPart[] = [
  { key: 'body', label: '몸통', match: /^(Body_Shell|FrontPocket_)/ },
  { key: 'straps', label: '손잡이·스트랩', match: /^(Strap_|Handle_)/ },
  { key: 'trim', label: '상단 트림', match: /^Trim_Blue/ },
  { key: 'binding', label: '사이드 라인', match: /SidePanel_Binding/ },
  { key: 'piping', label: '파이핑', match: /^Piping_Corner/ },
  { key: 'zipper', label: '지퍼', match: /^Zipper_Tape/ },
];

export interface Swatch {
  name: string;
  hex: string;
}

/** LAGI's own logo colours first, then companions chosen to sit with them. */
export const REMIX_PALETTE: Swatch[] = [
  { name: '라기 블루', hex: '#2e55a3' },
  { name: '오렌지', hex: '#c2662c' },
  { name: '머스타드', hex: '#deb457' },
  { name: '크림', hex: '#ede3cc' },
  { name: '레드', hex: '#b3262f' },
  { name: '포레스트', hex: '#1f6b45' },
  { name: '스카이', hex: '#8fb8de' },
  { name: '핑크', hex: '#e9a6b8' },
  { name: '라일락', hex: '#a99bd6' },
  { name: '올리브', hex: '#7c7a3a' },
  { name: '잉크', hex: '#1e1d1b' },
  { name: '화이트', hex: '#f7f5f1' },
];

/** part key → hex. A part missing from the map keeps the model's original colour. */
export type RemixColors = Record<string, string>;

/** A fresh random combination: every part different from its neighbours where the palette allows. */
export function shuffleColors(previous: RemixColors): RemixColors {
  const pick = (exclude: string[]) => {
    const pool = REMIX_PALETTE.filter((s) => !exclude.includes(s.hex));
    return pool[Math.floor(Math.random() * pool.length)].hex;
  };
  const body = pick([previous.body ?? '']);
  const straps = pick([body, previous.straps ?? '']);
  const trim = pick([body, straps]);
  return {
    body,
    straps,
    trim,
    binding: pick([body, trim]),
    piping: pick([body]),
    zipper: pick([body]),
  };
}

/** Compact, shareable encoding for the URL: `body-2e55a3.straps-c2662c`. */
export function encodeColors(colors: RemixColors): string {
  return Object.entries(colors)
    .map(([k, v]) => `${k}-${v.replace('#', '')}`)
    .join('.');
}

export function decodeColors(value: string | null): RemixColors {
  const out: RemixColors = {};
  if (!value) return out;
  for (const pair of value.split('.')) {
    const [k, v] = pair.split('-');
    if (REMIX_PARTS.some((p) => p.key === k) && /^[0-9a-f]{6}$/i.test(v ?? '')) out[k] = `#${v.toLowerCase()}`;
  }
  return out;
}

export function swatchName(hex: string): string {
  return REMIX_PALETTE.find((s) => s.hex === hex)?.name ?? hex;
}
