import type { Product } from '@/data/productTypes';

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

/** Pre-publish checks (spec §71-72) — catch missing basics before publishing. */
export function validateProduct(product: Product): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!product.id.trim()) issues.push({ level: 'error', message: '제품 ID가 필요합니다.' });
  if (!/^[a-z0-9-]+$/.test(product.id)) issues.push({ level: 'error', message: 'ID는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.' });

  if (!product.name.value) issues.push({ level: 'warning', message: '제품명이 없습니다 (사이트에 ‘정보 미등록’으로 표시됩니다).' });
  if (product.images.length === 0) issues.push({ level: 'warning', message: '대표 이미지가 없습니다.' });

  if (!product.shopUrl.value) issues.push({ level: 'warning', message: '구매 링크가 없습니다 — 구매 버튼이 비활성화됩니다.' });

  return issues;
}
