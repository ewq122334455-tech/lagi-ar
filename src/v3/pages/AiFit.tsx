import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AI_TRYON_URL, CARRY_PROMPTS, photoToDataUrl, requestAiTryOn } from '@/tryon/aiTryOn';
import { useRealProducts } from '../data';

const STYLES = {
  bag: [
    { key: 'shoulder', label: '어깨에 메기', prompt: CARRY_PROMPTS.SHOULDER },
    { key: 'hand', label: '손에 들기', prompt: CARRY_PROMPTS.HAND },
    { key: 'cross', label: '크로스로 메기', prompt: CARRY_PROMPTS.CROSSBODY },
  ],
  acc: [
    { key: 'hand', label: '손에 들기', prompt: 'held naturally in one hand in front of the body' },
    { key: 'clip', label: '가방에 걸기', prompt: 'clipped or hanging from the bag or belt loop the person is carrying' },
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

  if (!p) return <p className="t-label px-page pt-page">불러오는 중</p>;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setResult(null);
    setError(null);
    try {
      setPhoto(await photoToDataUrl(f));
    } catch {
      setError('사진을 읽지 못했어요. 다른 사진으로 해 주세요.');
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
      <h1 className="t-display mt-4">AI로 입어보기</h1>
      <div className="rule mt-14 grid grid-cols-1 gap-[var(--gap)] pt-6 md:grid-cols-2">
        <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-gray)]">
          {shown ? <img src={shown} alt={result && !before ? 'AI 결과' : '내 사진'} className="h-full w-full object-contain" /> : <p className="t-body px-8 text-center text-[var(--c-mute)]">정면에 가까운 전신·상반신 사진을 올려 주세요.</p>}
          {busy && <p className="t-value absolute inset-0 flex items-center justify-center bg-[var(--c-ink)]/70 text-[var(--c-white)]">AI가 만드는 중… (10~40초)</p>}
          {result && (
            <button type="button" className="t-nav tag tag-ink absolute bottom-3 left-3" onPointerDown={() => setBefore(true)} onPointerUp={() => setBefore(false)} onPointerLeave={() => setBefore(false)}>
              누르고 원본 보기
            </button>
          )}
        </div>
        <div>
          <input ref={cam} type="file" accept="image/*" capture="user" className="hidden" onChange={pick} />
          <input ref={album} type="file" accept="image/*" className="hidden" onChange={pick} />
          <p className="t-label text-[var(--c-mute)]">1. 사진</p>
          <div className="t-nav mt-2 flex gap-2">
            <button type="button" className="tag bg-[var(--c-label)] px-4 py-3" onClick={() => cam.current?.click()}>
              사진 찍기
            </button>
            <button type="button" className="tag bg-[var(--c-label)] px-4 py-3" onClick={() => album.current?.click()}>
              앨범에서 선택
            </button>
          </div>
          <p className="t-label mt-8 text-[var(--c-mute)]">2. 착용 방식</p>
          <div className="t-nav mt-2 flex flex-wrap gap-2">
            {styles.map((s) => (
              <button key={s.key} type="button" aria-pressed={style === s.key} onClick={() => setStyle(s.key)} className={`tag px-4 py-3 ${style === s.key ? 'tag-ink' : ''}`}>
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={run} disabled={!photo || busy || !AI_TRYON_URL} className="t-nav tag tag-ink mt-8 px-5 py-3 disabled:opacity-40">
            {result ? '다시 만들기' : 'AI 피팅 시작'}
          </button>
          {error && <p className="t-label mt-4 text-[var(--c-blue)]">{error}</p>}
          <p className="t-caption mt-8 max-w-sm text-[var(--c-mute)]">사진은 AI 합성을 위해 Google Gemini로 전송되며 라기 서버에 저장되지 않습니다. AI가 만든 참고용 이미지라 실제 크기·색감과 다를 수 있어요.</p>
        </div>
      </div>
    </div>
  );
}
