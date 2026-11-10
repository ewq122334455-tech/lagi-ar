import { useEffect } from 'react';

const SITE = 'LAGI';
const DEFAULT_TITLE = 'LAGI — LAGI in AGAIN';
const DEFAULT_DESCRIPTION =
  '라기는 디자인과 완성도, 소재의 새로운 가능성을 발견하고 제품을 선별해 소개하는 큐레이션 브랜드입니다. 발견하고, 선별하고, 소개하고, 연결합니다.';

/** Page titles by route (product pages set their own from the product). */
const TITLES: [RegExp, string][] = [
  [/^\/$/, DEFAULT_TITLE],
  [/^\/discover/, '전체 제품'],
  [/^\/why/, 'Why LAGI · 라기가 제품을 고르는 기준'],
  [/^\/about/, 'About · 브랜드'],
  [/^\/contact/, '문의'],
  [/^\/cart/, '장바구니'],
  [/^\/checkout\/success/, '결제 완료'],
  [/^\/checkout\/fail/, '결제 미완료'],
  [/^\/checkout/, '주문서'],
  [/^\/again/, 'Again · AI 피팅'],
  [/^\/login/, '로그인'],
  [/^\/signup/, '회원가입'],
  [/^\/account/, '내 계정'],
  [/^\/order/, '주문 조회'],
  [/^\/review/, '구매평'],
];

function setMeta(title: string, description: string) {
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
}

/** Tab title and meta description for a route; `null` leaves it to the page itself. */
export function titleFor(pathname: string): string | null {
  if (pathname.startsWith('/product/')) return null;
  const hit = TITLES.find(([re]) => re.test(pathname));
  if (!hit) return `페이지를 찾을 수 없습니다 — ${SITE}`;
  return hit[1] === DEFAULT_TITLE ? DEFAULT_TITLE : `${hit[1]} — ${SITE}`;
}

export function useRouteMeta(pathname: string) {
  useEffect(() => {
    const t = titleFor(pathname);
    if (t) setMeta(t, DEFAULT_DESCRIPTION);
  }, [pathname]);
}

/** A page with its own title (e.g. a product): "<name> — LAGI" and its one-line description. */
export function usePageMeta(name: string | null | undefined, description?: string | null) {
  useEffect(() => {
    if (!name) return;
    setMeta(`${name} — ${SITE}`, description || DEFAULT_DESCRIPTION);
  }, [name, description]);
}
