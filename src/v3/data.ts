import { useEffect, useMemo, useState } from 'react';
import { useProducts } from '@/hooks/useProducts';
import type { Product } from '@/data/productTypes';

/**
 * Products the new site may show: real items on sale whose name and price were checked against
 * the official store. Sample/placeholder products are never shown.
 */
export function isReal(p: Product) {
  return !p.sample && p.images.length > 0 && p.name.status === 'VERIFIED' && p.price.status === 'VERIFIED';
}

export function useRealProducts(): { products: Product[]; loading: boolean; error: string | null } {
  const state = useProducts();
  const products = useMemo(() => (state.status === 'ready' ? state.data.filter(isReal) : []), [state]);
  return { products, loading: state.status === 'loading', error: state.status === 'error' ? state.message : null };
}

/** Natural width/height of each product's first photo, so nothing is ever stretched. */
export function useImageRatios(products: Product[]) {
  const [ratios, setRatios] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    for (const p of products) {
      const img = new Image();
      img.onload = () => alive && setRatios((r) => ({ ...r, [p.id]: img.naturalWidth / img.naturalHeight }));
      img.src = p.images[0];
    }
    return () => {
      alive = false;
    };
  }, [products]);
  return ratios;
}

/** Korean category names for the store's category values. */
export const CATEGORY_KO: Record<string, string> = { Bag: '가방', 'Acc.': '소품', Acc: '소품' };

export const OFFICIAL_LINKS = {
  store: 'https://smartstore.naver.com/lagi_official',
  instagram: 'https://www.instagram.com/lagi.official/',
} as const;

export const price = (n: number | null | undefined) => (n == null ? '' : `${n.toLocaleString('ko-KR')}원`);
