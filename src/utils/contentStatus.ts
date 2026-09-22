/**
 * LAGI Brand Information Rule (spec §6-7, §44):
 * - Never invent price, material, dimensions, production method, creator,
 *   manufacturer, sustainability claims, history or philosophy.
 * - Missing information is CONTENT_REQUIRED, not guessed.
 * - Uncertain information is UNKNOWN, never silently VERIFIED.
 * - AI-generated copy is AI_DRAFT until a human marks it VERIFIED.
 */

export type ContentStatus = 'VERIFIED' | 'AI_DRAFT' | 'UNKNOWN' | 'CONTENT_REQUIRED';

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
  return !!f && f.value !== null && (f.status === 'VERIFIED' || f.status === 'AI_DRAFT' || f.status === 'UNKNOWN');
}

export const STATUS_LABEL: Record<ContentStatus, string> = {
  VERIFIED: 'VERIFIED',
  AI_DRAFT: 'AI DRAFT',
  UNKNOWN: 'UNVERIFIED',
  CONTENT_REQUIRED: 'CONTENT REQUIRED',
};
