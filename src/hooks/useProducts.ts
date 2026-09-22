import { useEffect, useState } from 'react';
import type { Product } from '@/data/productTypes';
import { loadProduct, loadProducts } from '@/data/productEngine';

type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

export function useProducts(): AsyncState<Product[]> {
  const [state, setState] = useState<AsyncState<Product[]>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loadProducts()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: '제품 목록을 불러오지 못했습니다.' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useProduct(id: string | undefined): AsyncState<Product> {
  const [state, setState] = useState<AsyncState<Product>>({ status: 'loading' });

  useEffect(() => {
    if (!id) {
      setState({ status: 'error', message: '제품 ID가 없습니다.' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    loadProduct(id)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setState({ status: 'error', message: '해당 제품을 찾을 수 없습니다.' });
        } else {
          setState({ status: 'ready', data });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: '제품 정보를 불러오지 못했습니다.' });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
