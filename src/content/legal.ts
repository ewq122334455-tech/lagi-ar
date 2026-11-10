/**
 * Legal notices — to be filled in by the owner (and reviewed by a legal professional).
 *
 * Nothing is shown on the site while a value is `null`: no footer block, no /privacy or /terms page,
 * no links. Do not put sample or placeholder text here — whatever is filled in is published as the
 * real notice. See docs/legal-readiness.md for what each field is and why it is needed.
 */

export interface BusinessInfo {
  /** 상호 */
  companyName: string;
  /** 대표자 성명 */
  representative: string;
  /** 사업자등록번호, e.g. "123-45-67890" */
  businessNumber: string;
  /** 통신판매업 신고번호, e.g. "제2026-서울강남-0000호" */
  mailOrderNumber: string;
  /** 사업장 주소 (소비자 불만을 처리할 수 있는 곳) */
  address: string;
  phone: string;
  email: string;
  /** 호스팅서비스 제공자 상호 */
  hostingProvider: string;
}

export interface LegalDocument {
  title: string;
  /** 시행일, e.g. "2026-12-01" */
  effectiveDate: string;
  /** Paragraphs; a line starting with "## " is a section heading. */
  body: string;
}

export const BUSINESS: BusinessInfo | null = null;
export const PRIVACY_POLICY: LegalDocument | null = null;
export const TERMS: LegalDocument | null = null;
