/**
 * Cheap checks around the AI photo fitting, all in the browser (nothing leaves the device):
 *
 *  - `checkPhoto`   before the paid request: is the uploaded photo big, bright and sharp enough?
 *  - `compareResult` after it: is the answer still the same picture, with something changed?
 *
 * They are heuristics on a 64–256 px grey copy, not a judgement of beauty: they catch the failures
 * that are cheap to see (a tiny or dark photo, an answer that is cropped, unchanged or a different
 * scene) and say so softly; they never block the visitor. Pure functions over grey pixels, so they
 * are testable without a browser.
 */

export interface Grey {
  w: number;
  h: number;
  /** 0–255 luminance, row by row. */
  data: Float32Array;
}

export type PhotoIssue = 'small' | 'dark' | 'bright' | 'blurry' | 'extreme_ratio';

export interface PhotoCheck {
  issues: PhotoIssue[];
  brightness: number;
  sharpness: number;
}

/** Variance of a 3×3 Laplacian: low means blurry. Measured on ~256 px so the scale does not depend on the photo size. */
export function sharpness(g: Grey): number {
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = 1; y < g.h - 1; y++)
    for (let x = 1; x < g.w - 1; x++) {
      const i = y * g.w + x;
      const l = 4 * g.data[i] - g.data[i - 1] - g.data[i + 1] - g.data[i - g.w] - g.data[i + g.w];
      sum += l;
      sum2 += l * l;
      n++;
    }
  const mean = sum / Math.max(1, n);
  return sum2 / Math.max(1, n) - mean * mean;
}

export const THRESHOLDS = { minSide: 480, dark: 55, bright: 215, blurry: 40, ratio: 2.4 };

/** `grey` is the photo resized to ~256 px on its long side; `width`/`height` are the original size. */
export function checkPhoto(grey: Grey, width: number, height: number): PhotoCheck {
  let sum = 0;
  for (let i = 0; i < grey.data.length; i++) sum += grey.data[i];
  const brightness = sum / grey.data.length;
  const sharp = sharpness(grey);
  const issues: PhotoIssue[] = [];
  if (Math.min(width, height) < THRESHOLDS.minSide) issues.push('small');
  if (brightness < THRESHOLDS.dark) issues.push('dark');
  if (brightness > THRESHOLDS.bright) issues.push('bright');
  if (sharp < THRESHOLDS.blurry) issues.push('blurry');
  if (Math.max(width, height) / Math.max(1, Math.min(width, height)) > THRESHOLDS.ratio) issues.push('extreme_ratio');
  return { issues, brightness, sharpness: sharp };
}

export const PHOTO_ISSUE_TEXT: Record<PhotoIssue, string> = {
  small: '사진이 작습니다. 더 큰 사진이면 결과가 선명해집니다.',
  dark: '사진이 어둡습니다. 밝은 곳에서 찍은 사진이 잘 나옵니다.',
  bright: '사진이 너무 밝습니다. 빛이 덜 센 사진이 잘 나옵니다.',
  blurry: '사진이 흐릿합니다. 초점이 맞은 사진이 잘 나옵니다.',
  extreme_ratio: '사진이 너무 가로나 세로로 깁니다. 일반 비율의 사진이 잘 나옵니다.',
};

export type ResultIssue = 'cropped' | 'unchanged' | 'different_scene';

export interface ResultCheck {
  issues: ResultIssue[];
  /** Normalised correlation of the two grey images (1 = same picture). */
  similarity: number;
  /** Mean absolute grey difference (0 = identical). */
  change: number;
  aspectDiff: number;
}

/** Resamples a grey image to `size`×`size` (box average), so two pictures of any size can be compared. */
export function toGrid(g: Grey, size = 48): Float32Array {
  const out = new Float32Array(size * size);
  for (let gy = 0; gy < size; gy++)
    for (let gx = 0; gx < size; gx++) {
      const x0 = Math.floor((gx * g.w) / size);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * g.w) / size));
      const y0 = Math.floor((gy * g.h) / size);
      const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * g.h) / size));
      let s = 0;
      let n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          s += g.data[y * g.w + x];
          n++;
        }
      out[gy * size + gx] = s / n;
    }
  return out;
}

export const RESULT_THRESHOLDS = { aspect: 0.04, unchanged: 1.2, differentScene: 0.55 };

/** Compares the visitor's photo with the AI's answer. Sizes are the original pixel sizes. */
export function compareResult(before: Grey, after: Grey, beforeSize: { w: number; h: number }, afterSize: { w: number; h: number }): ResultCheck {
  const a = toGrid(before);
  const b = toGrid(after);
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < a.length; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= a.length;
  mb /= b.length;
  let cov = 0;
  let va = 0;
  let vb = 0;
  let abs = 0;
  for (let i = 0; i < a.length; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
    abs += Math.abs(a[i] - b[i]);
  }
  const similarity = va > 1e-6 && vb > 1e-6 ? cov / Math.sqrt(va * vb) : 0;
  const change = abs / a.length;
  const aspectDiff = Math.abs(afterSize.w / afterSize.h / (beforeSize.w / beforeSize.h) - 1);
  const issues: ResultIssue[] = [];
  if (aspectDiff > RESULT_THRESHOLDS.aspect) issues.push('cropped');
  if (change < RESULT_THRESHOLDS.unchanged) issues.push('unchanged');
  // Only meaningful when the framing is the same; a recropped answer is already flagged.
  else if (similarity < RESULT_THRESHOLDS.differentScene && aspectDiff <= RESULT_THRESHOLDS.aspect) issues.push('different_scene');
  return { issues, similarity, change, aspectDiff };
}

export const RESULT_ISSUE_TEXT: Record<ResultIssue, string> = {
  cropped: 'AI가 사진의 구도를 바꿨습니다. 마음에 들지 않으면 다시 만들어 보세요.',
  unchanged: '제품이 보이지 않거나 사진이 거의 바뀌지 않았습니다. 다시 만들어 보세요.',
  different_scene: '결과가 원래 사진과 많이 다릅니다. 다시 만들어 보세요.',
};

// --- Browser helpers -----------------------------------------------------------------------------

/** Loads an image (URL or data URL) as a grey grid of at most `max` px on its long side. */
export async function loadGrey(src: string, max = 256): Promise<{ grey: Grey; width: number; height: number }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s));
  const h = Math.max(1, Math.round(img.naturalHeight * s));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, w, h);
  const px = x.getImageData(0, 0, w, h).data;
  const data = new Float32Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  return { grey: { w, h, data }, width: img.naturalWidth, height: img.naturalHeight };
}
