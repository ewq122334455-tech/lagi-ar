import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AI_TRYON_URL, CARRY_PROMPTS, photoToDataUrl, requestAiTryOn } from '@/tryon/aiTryOn';
import { useRealProducts } from '../data';

const STYLES = {
  bag: [
    { key: 'shoulder', label: 'On the shoulder', prompt: CARRY_PROMPTS.SHOULDER },
    { key: 'hand', label: 'In the hand', prompt: CARRY_PROMPTS.HAND },
    { key: 'cross', label: 'Cross-body', prompt: CARRY_PROMPTS.CROSSBODY },
  ],
  acc: [
    { key: 'hand', label: 'In the hand', prompt: 'held naturally in one hand in front of the body' },
    { key: 'clip', label: 'On a bag', prompt: 'clipped or hanging from the bag or belt loop the person is carrying' },
  ],
};

/** AI fitting — same Worker and client (src/tryon/aiTryOn.ts) as before, new layout. */
export default function AiFit() {
  const { id } = useParams<{ id: string }>();
  const { products } = useRealProducts();
  const p = products.find((x) => x.id === id);
  const styles = (p?.category.value ?? '').toLowerCase().includes('bag') ? STYLES.bag : STYLES.acc;
  const [style, setStyle] = useState(styles[0].key);
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [before, setBefore] = useState(false);
  const cam = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);

  if (!p) return <p className="t-label px-page pt-page">Loading…</p>;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setResult(null);
    setError(null);
    try {
      setPhoto(await photoToDataUrl(f));
    } catch {
      setError('Could not read that photo. Please try another one.');
    }
  }
  async function run() {
    if (!photo || !p) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await requestAiTryOn({ person: photo, product: p, style: styles.find((s) => s.key === style)?.prompt }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const shown = result && !before ? result : photo;

  return (
    <div className="px-page pb-32 pt-page">
      <Link to={`/product/${p.id}`} className="t-label text-[var(--c-mute)] hover:text-[var(--c-ink)]">
        ← {p.name.value}
      </Link>
      <h1 className="t-display mt-4">TRY ON WITH AI</h1>
      <div className="rule mt-14 grid grid-cols-1 gap-[var(--gap)] pt-6 md:grid-cols-2">
        <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-gray)]">
          {shown ? <img src={shown} alt={result && !before ? 'AI result' : 'Your photo'} className="h-full w-full object-contain" /> : <p className="t-body px-8 text-center text-[var(--c-mute)]">Add a front-facing full-body or upper-body photo.</p>}
          {busy && <p className="t-value absolute inset-0 flex items-center justify-center bg-[var(--c-ink)]/70 text-[var(--c-white)]">Creating your image… (10–40 s)</p>}
          {result && (
            <button type="button" className="t-nav tag tag-ink absolute bottom-3 left-3" onPointerDown={() => setBefore(true)} onPointerUp={() => setBefore(false)} onPointerLeave={() => setBefore(false)}>
              Hold to see original
            </button>
          )}
        </div>
        <div>
          <input ref={cam} type="file" accept="image/*" capture="user" className="hidden" onChange={pick} />
          <input ref={album} type="file" accept="image/*" className="hidden" onChange={pick} />
          <p className="t-label text-[var(--c-mute)]">1. Photo</p>
          <div className="t-nav mt-2 flex gap-2">
            <button type="button" className="tag bg-[var(--c-label)] px-4 py-3" onClick={() => cam.current?.click()}>
              Take a photo
            </button>
            <button type="button" className="tag bg-[var(--c-label)] px-4 py-3" onClick={() => album.current?.click()}>
              Choose from album
            </button>
          </div>
          <p className="t-label mt-8 text-[var(--c-mute)]">2. How to wear it</p>
          <div className="t-nav mt-2 flex flex-wrap gap-2">
            {styles.map((s) => (
              <button key={s.key} type="button" aria-pressed={style === s.key} onClick={() => setStyle(s.key)} className={`tag px-4 py-3 ${style === s.key ? 'tag-ink' : ''}`}>
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={run} disabled={!photo || busy || !AI_TRYON_URL} className="t-nav tag tag-ink mt-8 px-5 py-3 disabled:opacity-40">
            {result ? 'Try again' : 'Start AI fitting'}
          </button>
          {error && <p className="t-label mt-4 text-[var(--c-blue)]">{error}</p>}
          <p className="t-caption mt-8 max-w-sm text-[var(--c-mute)]">Your photo is sent to Google Gemini to create the image and is not stored by LAGI. The result is an AI preview; size and colour may differ from the real product.</p>
        </div>
      </div>
    </div>
  );
}
