/**
 * LAGI Brand Information Rule (spec §6-7, §44):
 * - Never invent price, material, dimensions, production method, creator,
 *   manufacturer, sustainability claims, history or philosophy.
 * - Missing information is CONTENT_REQUIRED, not guessed.
 * - Uncertain information is UNKNOWN, never silently VERIFIED.
 * - AI-generated copy is AI_DRAFT until a human marks it VERIFIED.
 * - BRAND_COPY is introduction copy LAGI wrote from the verified basics (name, short description,
 *   size) and what the product photos show, published at the owner's request. It describes; it does
 *   not add specifications, and the page says who wrote it.
 */

export type ContentStatus = 'VERIFIED' | 'BRAND_COPY' | 'AI_DRAFT' | 'UNKNOWN' | 'CONTENT_REQUIRED';

/** Classification used when AI analyzes product photographs (spec §7, §70). */
export type ObservationLevel = 'OBSERVED' | 'INFERRED' | 'UNKNOWN';

export interface Observation {
  level: ObservationLevel;
  label: string;
  note?: string;
}

/** A content field that carries its own verification status alongside its value. */
export interface VerifiableField<T> {
  value: T | null;
  status: ContentStatus;
  /** Where the value came from — a supplied brand asset, an AI draft, a human editor, etc. */
  source?: string;
}

export function field<T>(value: T | null, status: ContentStatus, source?: string): VerifiableField<T> {
  return { value, status, source };
}

export function contentRequired<T>(): VerifiableField<T> {
  return { value: null, status: 'CONTENT_REQUIRED' };
}

export function verified<T>(value: T, source?: string): VerifiableField<T> {
  return { value, status: 'VERIFIED', source };
}

export function isDisplayable<T>(f: VerifiableField<T> | undefined | null): f is VerifiableField<T> & { value: T } {
  return !!f && f.value !== null && (f.status === 'VERIFIED' || f.status === 'BRAND_COPY' || f.status === 'AI_DRAFT' || f.status === 'UNKNOWN');
}

/** Fit for the public product page: verified facts, or LAGI's published copy. Drafts stay hidden. */
export function isPublished<T>(f: VerifiableField<T> | undefined | null): f is VerifiableField<T> & { value: T } {
  return !!f && f.value !== null && (f.status === 'VERIFIED' || f.status === 'BRAND_COPY');
}

export const STATUS_LABEL: Record<ContentStatus, string> = {
  VERIFIED: '확인됨',
  BRAND_COPY: '라기 작성',
  AI_DRAFT: 'AI 초안',
  UNKNOWN: '미확인',
  CONTENT_REQUIRED: '정보 미등록',
};
