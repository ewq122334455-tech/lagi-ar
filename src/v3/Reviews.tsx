import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { deleteReview, fetchReviews, myReviewedProducts, photoForReview, postReview, reviewPhotoUrl, type ReviewItem, type ReviewPage } from './reviews';

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex text-[var(--c-blue)]" aria-label={`별점 ${value}점`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" fill={i <= value ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3">
          <path d="M10 1.8 12.5 7l5.7.6-4.3 3.8 1.2 5.6L10 14.1 4.9 17l1.2-5.6L1.8 7.6 7.5 7 10 1.8Z" />
        </svg>
      ))}
    </span>
  );
}

const date = (iso: string) => iso.slice(0, 10).replace(/-/g, '.');

function ReviewRow({ r, showProduct, mine, onDelete }: { r: ReviewItem; showProduct: boolean; mine: boolean; onDelete: () => void }) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-b border-black/10 py-5 md:grid-cols-[1fr_96px]" data-testid="review">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stars value={r.rating} />
          {r.verified && <span className="t-label kr rounded-full bg-[var(--c-gray)] px-2 py-0.5">구매 확인</span>}
        </div>
        {showProduct && (
          <Link to={`/product/${r.productId}`} className="t-caption kr mt-2 block font-semibold underline-offset-2 hover:underline">
            {r.productName}
          </Link>
        )}
        <p className="t-body kr mt-2 whitespace-pre-line">{r.text}</p>
        <p className="t-caption kr mt-2 text-[var(--c-mute)]">
          {r.author} · {date(r.createdAt)}
          {mine && (
            <button type="button" onClick={onDelete} className="ml-3 underline underline-offset-2 hover:text-[var(--c-ink)]">
              삭제
            </button>
          )}
        </p>
      </div>
      {r.photo && (
        <a href={reviewPhotoUrl(r.id)} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-[var(--radius-card)] bg-[var(--c-gray)] md:h-24 md:w-24">
          <img src={reviewPhotoUrl(r.id)} alt="구매평 사진" loading="lazy" className="h-full w-full object-cover" />
        </a>
      )}
    </li>
  );
}

function ReviewForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="rounded-[var(--radius-card)] border border-black/15 p-5"
      data-testid="review-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!rating) return setError('별점을 선택해 주세요.');
        if (text.trim().length < 10) return setError('구매평은 10자 이상 써 주세요.');
        setBusy(true);
        setError(null);
        try {
          await postReview({ productId, rating, text: text.trim(), photo: photo ?? undefined });
          onDone();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="t-value kr">구매평 쓰기</p>
      <div className="mt-3 flex gap-1" role="radiogroup" aria-label="별점">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i}점`} onClick={() => setRating(i)} className="p-0.5 text-[var(--c-blue)]">
            <svg viewBox="0 0 20 20" width={26} height={26} fill={i <= rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
              <path d="M10 1.8 12.5 7l5.7.6-4.3 3.8 1.2 5.6L10 14.1 4.9 17l1.2-5.6L1.8 7.6 7.5 7 10 1.8Z" />
            </svg>
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={4}
        placeholder="제품을 받아 보고 느낀 점을 남겨 주세요 (10자 이상)"
        className="t-body kr mt-3 w-full rounded-[var(--radius-card)] border border-black/15 p-3 outline-none focus:border-[var(--c-ink)]"
        aria-label="구매평 내용"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="chip cursor-pointer">
          {photo ? '사진 바꾸기' : '사진 추가'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setPhoto(await photoForReview(f));
            }}
          />
        </label>
        {photo && <img src={photo} alt="첨부한 사진" className="h-12 w-12 rounded object-cover" />}
        <span className="t-caption kr ml-auto tabular-nums text-[var(--c-mute)]">{text.length} / 1000</span>
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? '올리는 중…' : '구매평 등록'}
        </button>
      </div>
      {error && (
        <p className="t-caption kr mt-3 text-[var(--c-blue)]" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/** Review list (one product, or all) with paging; members can write one review per product. */
export function Reviews({ productId, onCount }: { productId: string | null; onCount?: (n: number) => void }) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReviewPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [writing, setWriting] = useState(false);

  const load = useCallback(() => {
    fetchReviews(productId, page)
      .then((d) => {
        setData(d);
        onCount?.(d.total);
      })
      .catch((e) => setError((e as Error).message));
  }, [productId, page, onCount]);
  useEffect(load, [load]);
  useEffect(() => {
    if (user) myReviewedProducts().then((d) => setReviewed(d.products), () => undefined);
  }, [user]);

  const canWrite = !!productId && !!user && !reviewed.includes(productId);

  return (
    <div data-testid="reviews">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="t-value kr">
          구매평 <span className="tabular-nums text-[var(--c-mute)]">{data?.total ?? 0}</span>
        </p>
        {productId && !user && (
          <Link to="/login" className="btn btn-line">
            로그인하고 구매평 쓰기
          </Link>
        )}
        {canWrite && !writing && (
          <button type="button" className="btn btn-line" onClick={() => setWriting(true)}>
            구매평 쓰기
          </button>
        )}
      </div>
      {writing && productId && (
        <div className="mt-4">
          <ReviewForm
            productId={productId}
            onDone={() => {
              setWriting(false);
              setReviewed((r) => [...r, productId]);
              setPage(1);
              load();
            }}
          />
        </div>
      )}
      {error && <p className="t-caption kr mt-4 text-[var(--c-mute)]">{error}</p>}
      {data && data.total === 0 && (
        <div className="mt-6 rounded-[var(--radius-card)] bg-[var(--c-gray)] px-6 py-10 text-center">
          <p className="t-value kr">아직 구매평이 없습니다.</p>
          <p className="t-caption kr mt-1 text-[var(--c-mute)]">제품을 받아 보셨다면 첫 구매평을 남겨 주세요.</p>
        </div>
      )}
      {data && data.reviews.length > 0 && (
        <ul className="mt-2 border-t border-black/10">
          {data.reviews.map((r) => (
            <ReviewRow
              key={r.id}
              r={r}
              showProduct={!productId}
              mine={!!r.mine}
              onDelete={async () => {
                if (!confirm('이 구매평을 삭제할까요?')) return;
                try {
                  await deleteReview(r.productId, r.id);
                  setReviewed((x) => x.filter((p) => p !== r.productId));
                  load();
                } catch (e) {
                  alert((e as Error).message);
                }
              }}
            />
          ))}
        </ul>
      )}
      {data && data.pages > 1 && (
        <nav className="t-caption mt-6 flex justify-center gap-1" aria-label="구매평 페이지">
          {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" onClick={() => setPage(n)} aria-current={n === page ? 'page' : undefined} className={`h-8 w-8 rounded-full ${n === page ? 'bg-[var(--c-ink)] text-white' : 'hover:bg-[var(--c-gray)]'}`}>
              {n}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
