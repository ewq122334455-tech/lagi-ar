import { useEffect, useRef, useState } from 'react';
import { LOGO_PATHS, LOGO_VIEWBOX } from '@/components/logoPaths';

const THEMES = [
  { key: 'blue', bg: '#2e55a3', fg: '#f6f4ef', accent: '#deb457' },
  { key: 'mustard', bg: '#deb457', fg: '#161514', accent: '#2e55a3' },
  { key: 'orange', bg: '#c2662c', fg: '#f6f4ef', accent: '#161514' },
  { key: 'paper', bg: '#f6f4ef', fg: '#161514', accent: '#c2662c' },
  { key: 'ink', bg: '#161514', fg: '#f6f4ef', accent: '#deb457' },
] as const;

const EXAMPLES = ['그 바다에 가기', '처음처럼 시작하기', '좋아하는 노래 듣기', '엄마랑 여행 가기', '같은 가방 메고 나가기'];

/** Same brand stack as the site (see tailwind.config.js). */
const FONT = `posterama, "Posterama", Jost, YoonGothic, "Yoon Gothic", "윤고딕", "Pretendard Variable", Pretendard, sans-serif`;

const W = 1080;
const H = 1350;
const MAX_CHARS = 28;

interface AgainCardProps {
  /** Optional transparent PNG of the visitor's remixed bag to place on the card. */
  getBagImage?: () => string | null;
  /** Changes whenever the remixed bag changes, so the card picks up the new colours. */
  bagKey?: string;
}

/** "다시 ___" — a shareable card for something you'd like to do again. */
export function AgainCard({ getBagImage, bagKey }: AgainCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState('');
  const [themeIndex, setThemeIndex] = useState(0);
  const [withBag, setWithBag] = useState(false);
  const [bag, setBag] = useState<HTMLImageElement | null>(null);
  const [saving, setSaving] = useState(false);
  const placeholder = EXAMPLES[0];

  useEffect(() => {
    if (!withBag || !getBagImage) {
      setBag(null);
      return;
    }
    const src = getBagImage();
    if (!src) return;
    const img = new Image();
    img.onload = () => setBag(img);
    img.src = src;
  }, [withBag, getBagImage, bagKey]);

  useEffect(() => {
    let cancelled = false;
    // Canvas text only uses web fonts that are already loaded.
    Promise.all([
      document.fonts.load(`italic 34px ${FONT}`),
      document.fonts.load(`600 80px ${FONT}`, '다시'),
      document.fonts.load(`800 200px ${FONT}`, '다시'),
    ])
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) draw(canvasRef.current, text || placeholder, THEMES[themeIndex], bag);
      });
    return () => {
      cancelled = true;
    };
  }, [text, themeIndex, bag, placeholder]);

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) return;
      const file = new File([blob], 'lagi-again-card.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'LAGI — 다시' }).catch(() => undefined);
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)]">
        <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full" aria-label="다시 카드 미리보기" />
      </div>

      <div className="flex flex-col gap-8">
        <label className="flex flex-col gap-3">
          <span className="eyebrow">다시, 하고 싶은 것</span>
          <div className="flex items-baseline gap-3 border-b border-ink pb-3">
            <span className="text-2xl font-semibold tracking-[-0.04em] text-stone">다시,</span>
            <input
              value={text}
              maxLength={MAX_CHARS}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-2xl font-semibold tracking-[-0.03em] placeholder:text-stone/60 focus:outline-none"
            />
          </div>
          <span className="text-xs text-stone">
            {text.length}/{MAX_CHARS}
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="rounded-full border border-line px-3.5 py-1.5 text-sm text-graphite hover:border-ink hover:text-ink focus-ring"
            >
              {ex}
            </button>
          ))}
        </div>

        <div>
          <p className="eyebrow mb-3">컬러</p>
          <div className="flex gap-3">
            {THEMES.map((t, i) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setThemeIndex(i)}
                aria-label={`${t.key} 테마`}
                aria-pressed={themeIndex === i}
                className={`h-10 w-10 rounded-full border focus-ring ${themeIndex === i ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'border-line'}`}
                style={{ backgroundColor: t.bg }}
              />
            ))}
          </div>
        </div>

        {getBagImage && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={withBag} onChange={(e) => setWithBag(e.target.checked)} className="h-4 w-4 accent-ink" />
            위에서 만든 내 조합 가방 넣기
          </label>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-fit rounded-full bg-ink px-7 py-4 text-sm font-semibold text-paper transition-colors hover:bg-blue focus-ring disabled:opacity-50"
        >
          {saving ? '저장 중…' : '카드 저장 · 공유하기'}
        </button>
      </div>
    </div>
  );
}

function draw(
  canvas: HTMLCanvasElement | null,
  text: string,
  theme: (typeof THEMES)[number],
  bag: HTMLImageElement | null
) {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  const pad = 96;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = theme.fg;
  ctx.textBaseline = 'alphabetic';

  // Header
  // Logo, scaled from its own 25-unit-high artwork to ~30px.
  const logoScale = 30 / LOGO_VIEWBOX.height;
  ctx.save();
  ctx.translate(pad, pad - 6);
  ctx.scale(logoScale, logoScale);
  ctx.strokeStyle = theme.fg;
  ctx.lineWidth = 3;
  LOGO_PATHS.forEach((d) => ctx.stroke(new Path2D(d)));
  ctx.restore();
  ctx.font = `italic 34px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('lagi = again', W - pad, pad + 20);
  ctx.textAlign = 'left';

  if (bag) {
    const maxW = 380;
    const maxH = 460;
    const s = Math.min(maxW / bag.naturalWidth, maxH / bag.naturalHeight);
    const bw = bag.naturalWidth * s;
    const bh = bag.naturalHeight * s;
    ctx.drawImage(bag, W - pad - bw, 210, bw, bh);
  }

  // Korean has no true italic, so "다시," stays upright and heavy rather than synthetically slanted.
  ctx.font = `800 200px ${FONT}`;
  ctx.letterSpacing = '-10px';
  ctx.fillStyle = theme.accent;
  ctx.fillText('다시,', pad - 8, 640);
  ctx.letterSpacing = '0px';

  // The visitor's line, wrapped to fit.
  ctx.fillStyle = theme.fg;
  const fontSize = text.length > 16 ? 84 : 104;
  ctx.font = `600 ${fontSize}px ${FONT}`;
  const lines = wrap(ctx, text, W - pad * 2);
  lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, pad, 800 + i * fontSize * 1.18));

  // Footer
  ctx.globalAlpha = 0.7;
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText('lagi — 말레이·인도네시아어로 ‘다시’', pad, H - pad - 44);
  const date = new Date();
  ctx.font = `italic 34px ${FONT}`;
  ctx.fillText(`Look closer, again. — ${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`, pad, H - pad);
  ctx.globalAlpha = 1;
}

/** Greedy wrap that breaks on spaces, and inside long words when it has to (Korean has few spaces). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of Array.from(text)) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      const lastSpace = line.lastIndexOf(' ');
      if (ch !== ' ' && lastSpace > 0) {
        lines.push(line.slice(0, lastSpace));
        line = line.slice(lastSpace + 1) + ch;
      } else {
        lines.push(line.trimEnd());
        line = ch === ' ' ? '' : ch;
      }
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
