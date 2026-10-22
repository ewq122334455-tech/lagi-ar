import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import type { Product } from '@/data/productTypes';
import { productDisplayName } from '@/utils/productImage';
import type { Cutout } from '@/tryon/cutouts';
import { cutoutAnchors, deleteCutout, fetchCutout, garmentTypeOf, generateCutoutSource, keyOutBackground, saveCutout } from '@/tryon/cutouts';
import { AI_TRYON_URL } from '@/tryon/aiTryOn';

const KEY_STORAGE = 'lagi-admin-key';

type RowState = { status: 'idle' | 'working' | 'saved' | 'error'; message?: string; preview?: Cutout | null };

/**
 * Admin tool: turns each product's store photo into a photoreal transparent cut-out (Gemini on a
 * chroma background, keyed out here) and saves it to the Worker, where the live camera try-on
 * picks it up. Each generation is one paid Gemini image (about 55원).
 */
export default function CutoutStudio() {
  const state = useProducts();
  const products = state.status === 'ready' ? state.data.filter((p) => p.images.length > 0 && garmentTypeOf(p)) : [];
  const [key, setKey] = useState(() => {
    try {
      return sessionStorage.getItem(KEY_STORAGE) ?? '';
    } catch {
      return '';
    }
  });
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [runningAll, setRunningAll] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY_STORAGE, key);
    } catch {
      // ignore
    }
  }, [key]);

  // Show what is already stored.
  useEffect(() => {
    products.forEach((p) =>
      fetchCutout(p.id).then((c) => c && setRows((r) => ({ ...r, [p.id]: { status: 'saved', preview: c, message: '저장됨' } }))),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const set = (id: string, s: RowState) => setRows((r) => ({ ...r, [id]: { ...r[id], ...s } }));

  async function make(p: Product) {
    const type = garmentTypeOf(p)!;
    set(p.id, { status: 'working', message: 'AI가 누끼를 만드는 중… (10~40초)' });
    try {
      const src = await generateCutoutSource(p, key);
      set(p.id, { status: 'working', message: '배경 지우는 중…' });
      const img = await keyOutBackground(src);
      const cut: Cutout = { image: img.src, ...cutoutAnchors(img, type) };
      await saveCutout(p.id, cut, key);
      set(p.id, { status: 'saved', preview: cut, message: '저장됨 · 카메라 피팅에 바로 적용돼요' });
    } catch (e) {
      set(p.id, { status: 'error', message: (e as Error).message });
    }
  }

  async function makeAll() {
    setRunningAll(true);
    for (const p of products) {
      if (rows[p.id]?.status === 'saved') continue;
      await make(p);
    }
    setRunningAll(false);
  }

  async function remove(p: Product) {
    try {
      await deleteCutout(p.id, key);
      set(p.id, { status: 'idle', preview: null, message: '삭제됨 (기본 이미지 사용)' });
    } catch (e) {
      set(p.id, { status: 'error', message: (e as Error).message });
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 lg:px-10">
      <Link to="/workspace" className="text-xs text-stone hover:text-ink">
        ← 상품 등록
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-[-0.03em]">실사 누끼 스튜디오</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite">
        상품 사진을 AI가 배경 없는 실사 누끼로 다시 그리고, 카메라 피팅(거울 모드)에 바로 적용합니다. 한 장 만들 때마다 Gemini 이미지 1장 요금(약
        55원)이 들어요. 결과가 실제 상품과 다르면 ‘다시 만들기’나 ‘삭제’를 누르세요.
      </p>

      {!AI_TRYON_URL && <p className="mt-6 rounded-md bg-mist px-4 py-3 text-sm">서버 주소가 설정되지 않았습니다.</p>}

      <div className="mt-8 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-graphite">관리자 키</span>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="wrangler secret put ADMIN_KEY 로 정한 값"
            className="h-11 w-72 rounded-md border border-line px-3 text-sm focus:border-ink focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={makeAll}
          disabled={!key || runningAll}
          className="h-11 rounded-md bg-ink px-5 text-sm font-bold text-paper hover:bg-blue disabled:opacity-40"
        >
          {runningAll ? '만드는 중…' : '아직 없는 것 전부 만들기'}
        </button>
      </div>

      <ul className="mt-10 divide-y divide-line border-y border-line">
        {products.map((p) => {
          const row = rows[p.id];
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-5 py-5">
              <img src={p.images[0]} alt="" className="h-20 w-20 rounded-md object-cover" />
              <span className="text-stone" aria-hidden="true">
                →
              </span>
              <div className="flex h-24 w-24 items-center justify-center rounded-md bg-[conic-gradient(#eee_0_25%,#fff_0_50%,#eee_0_75%,#fff_0)] bg-[length:16px_16px]">
                {row?.preview ? <img src={row.preview.image} alt="" className="max-h-full max-w-full" /> : <span className="text-[11px] text-stone">없음</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{productDisplayName(p)}</p>
                <p className="text-xs text-stone">{garmentTypeOf(p)}</p>
                {row?.message && <p className={`mt-1 text-xs ${row.status === 'error' ? 'text-orange' : 'text-graphite'}`}>{row.message}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => make(p)}
                  disabled={!key || row?.status === 'working'}
                  className="h-10 rounded-md border border-ink px-4 text-sm font-semibold hover:bg-mist disabled:opacity-40"
                >
                  {row?.preview ? '다시 만들기' : '만들기'}
                </button>
                {row?.preview && (
                  <button type="button" onClick={() => remove(p)} disabled={!key} className="h-10 rounded-md px-3 text-sm text-stone hover:text-ink">
                    삭제
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
