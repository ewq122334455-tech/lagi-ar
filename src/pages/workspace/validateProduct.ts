import type { Product } from '@/data/productTypes';
import { formatFromFilename, formatFromMimeType, isBlobUrl } from '@/utils/modelFile';

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

/** Pre-publish checks (spec §71-72) — never allow an obviously broken AR/3D config to publish silently. */
export function validateProduct(product: Product): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!product.id.trim()) issues.push({ level: 'error', message: '제품 ID가 필요합니다.' });
  if (!/^[a-z0-9-]+$/.test(product.id)) issues.push({ level: 'error', message: 'ID는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.' });

  if (!product.name.value) issues.push({ level: 'warning', message: '제품명이 없습니다 (CONTENT REQUIRED로 게시됨).' });
  if (product.images.length === 0) issues.push({ level: 'warning', message: '대표 이미지가 없습니다.' });

  if (product.threeDAvailable && !product.model3D) {
    issues.push({ level: 'error', message: '3D 사용 가능으로 표시되었지만 모델(GLB) 경로가 없습니다.' });
  }
  if (product.model3D) {
    if (isBlobUrl(product.model3D)) {
      // blob: URLs are random UUIDs with no filename/extension of their own — validate
      // against the uploaded File's original name/MIME type instead (see model3DAsset).
      const asset = product.model3DAsset;
      const validByName = asset ? formatFromFilename(asset.filename) !== null : false;
      const validByMime = asset ? formatFromMimeType(asset.mimeType) !== null : false;
      if (!asset || (!validByName && !validByMime)) {
        issues.push({
          level: 'warning',
          message: '업로드된 3D 모델 파일이 .glb 또는 .gltf 형식인지 확인할 수 없습니다. 워크스페이스에서 파일을 다시 업로드해 주세요.',
        });
      }
    } else if (formatFromFilename(product.model3D) === null) {
      issues.push({ level: 'warning', message: '모델 경로가 .glb 또는 .gltf로 끝나지 않습니다.' });
    }
  }

  if (product.arAvailable) {
    if (!product.arTarget) issues.push({ level: 'error', message: 'AR 사용 가능으로 표시되었지만 AR 타겟(.mind)이 없습니다.' });
    if (!product.model3D) issues.push({ level: 'error', message: 'AR 사용 가능으로 표시되었지만 3D 모델이 없습니다.' });
    if (!product.arSettings) issues.push({ level: 'error', message: 'AR 보정값(scale/position/rotation)이 없습니다.' });
  }

  product.hotspots.forEach((h, i) => {
    if (!h.title.trim()) issues.push({ level: 'warning', message: `Hotspot #${i + 1}: 제목이 없습니다.` });
    if (!h.description.value) issues.push({ level: 'warning', message: `Hotspot "${h.title || i + 1}": 설명이 CONTENT REQUIRED 상태입니다.` });
  });

  if (!product.shopUrl.value) issues.push({ level: 'warning', message: 'Shop URL이 없습니다 — BUY 버튼이 비활성화됩니다.' });

  return issues;
}
