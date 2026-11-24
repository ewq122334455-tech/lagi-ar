import type { Product } from '@/data/productTypes';
import type { VerifiableField } from '@/utils/contentStatus';
import { isClothing } from './data';
import { detailCopy } from './detailCopy';
import { responsive } from './img';

/** 상품정보제공고시: the items Korean e-commerce law requires, in the official order — 의류 and 가방·잡화. */
export const NOTICE_CLOTHING = ['제품 소재', '색상', '치수', '제조자 / 수입자', '제조국', '세탁방법 및 취급시 주의사항', '제조연월', '품질보증기준', 'A/S 책임자와 전화번호'] as const;
export const NOTICE_GOODS = ['종류', '소재', '색상', '크기', '제조자 / 수입자', '제조국', '취급시 주의사항', '품질보증기준', 'A/S 책임자와 전화번호'] as const;

const PENDING = '정보 준비 중';
type Shown = { v: string; draft: boolean } | null;
/** Owner facts and LAGI copy are shown as they are; example values (AI_DRAFT) are shown with a "예시" label so they are never read as checked facts. */
const val = (f?: VerifiableField<string> | null): Shown =>
  f && f.value !== null && (f.status === 'VERIFIED' || f.status === 'BRAND_COPY' || f.status === 'AI_DRAFT') ? { v: f.value, draft: f.status === 'AI_DRAFT' } : null;

const Draft = () => (
  <span className="kr ml-2 inline-block whitespace-nowrap rounded-full border border-[var(--c-blue)]/30 px-2 py-0.5 align-middle text-[11px] font-normal" data-draft="true">
    예시 정보 · 확인 전
  </span>
);

/** One block: a small English label, then the content. Thin blue rule on top, nothing else. */
function Block({ en, draft, children }: { en: string; draft?: boolean; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--c-blue)]/25 py-12 md:py-16" aria-label={en}>
      <h3 className="t-label t-mark">
        {en}
        {draft && <Draft />}
      </h3>
      <div className="kr mt-5 text-[15px] leading-[1.85]">{children}</div>
    </section>
  );
}

const EXCHANGE = [
  '단순 변심: 상품을 받은 날부터 7일 이내 교환·반품 신청 가능 (배송비 구매자 부담)',
  '상품 하자·오배송: 배송비 판매자 부담',
  '표시·광고와 다른 경우: 받은 날부터 3개월 이내, 또는 그 사실을 안 날부터 30일 이내 신청 가능',
  '상품 확인을 위한 포장 개봉만으로는 교환·반품이 제한되지 않습니다.',
];

/**
 * The detail page under the buy panel. Kept quiet on purpose: one line, then short blocks
 * (story, why LAGI picked it, how it is made, material, size, care, delivery, exchange, the legal notice).
 * Brand blue only, no icons, no numbering. A product with ready-made detail images (detailImages) shows those instead.
 * Example values (AI_DRAFT) carry the "예시 정보 · 확인 전" label.
 */
export function ProductInfo({ p }: { p: Product }) {
  if (p.detailImages?.length) {
    return (
      <div className="-mx-[var(--page-x)] mt-[var(--section)]" data-testid="detail-images">
        <div className="mx-auto max-w-[860px]">
          {p.detailImages.map((d) => (
            <img key={d.src} {...responsive(d.src, '(max-width: 860px) 100vw, 860px')} src={d.src} alt={d.alt} loading="lazy" className="block h-auto w-full" width={1024} height={1505} />
          ))}
        </div>
      </div>
    );
  }

  const clothing = isClothing(p);
  const copy = detailCopy(p.id, clothing);
  const story = val(p.story);
  const reason = val(p.lagiSelectionReason);
  const desc = val(p.description);
  const country = val(p.making?.country);
  const maker = val(p.making?.maker);
  const how = val(p.making?.how);
  const steps = p.process.map((s) => ({ s, d: val(s.description) })).filter((x) => x.d);
  const mats = p.materials.map((m) => ({ n: val(m.name), c: val(m.characteristics) })).filter((m) => m.n);
  const care = val(p.care);
  const d = p.dimensions ?? {};
  const chart =
    p.sizeChart && p.sizeChart.rows.length
      ? p.sizeChart
      : d.widthCm
        ? { unit: 'cm' as const, columns: ['가로', '세로', '폭'], rows: [{ size: 'ONE', values: [d.widthCm, d.heightCm ?? null, d.depthCm ?? null] }], note: '실측 기준, 소재 특성상 1~2cm 차이가 있을 수 있습니다.', status: undefined }
        : null;
  const notice = p.notice ?? {};
  const items = clothing ? NOTICE_CLOTHING : NOTICE_GOODS;
  const shownNotice = items.map((k) => [k, val(notice[k])] as const);
  const madeDraft = [country, maker, how, ...steps.map((x) => x.d)].some((x) => x?.draft);
  const fee = p.shipping?.fee;

  return (
    <div className="mx-auto mt-[var(--section)] max-w-[760px] text-[var(--c-blue)]" data-testid="product-info">
      <p className="kr text-center text-[clamp(20px,2.4vw,28px)] font-semibold leading-[1.4]">
        {copy.hook[0]} {copy.hook[1]}
      </p>

      <div className="mt-16">
        <Block en="STORY" draft={story?.draft}>
          <p className="whitespace-pre-line">{story?.v ?? desc?.v ?? PENDING}</p>
        </Block>

        <Block en="WHY WE SELECTED" draft={reason?.draft}>
          <p className="whitespace-pre-line">{reason?.v ?? PENDING}</p>
        </Block>

        <Block en="MADE BY" draft={madeDraft}>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1">
            <dt className="opacity-60">제조국</dt>
            <dd>{country?.v ?? PENDING}</dd>
            <dt className="opacity-60">만든 곳</dt>
            <dd>{maker?.v ?? PENDING}</dd>
          </dl>
          {how && <p className="mt-4">{how.v}</p>}
          {steps.length > 0 && <p className="mt-4 opacity-80">{steps.map(({ s }) => s.title).join(' → ')}</p>}
        </Block>

        <Block en={clothing ? 'FABRIC' : 'MATERIAL'} draft={[...mats.flatMap((m) => [m.n, m.c]), care].some((x) => x?.draft)}>
          {mats.length ? (
            <ul className="space-y-1">
              {mats.map((m, i) => (
                <li key={i}>
                  {m.n!.v}
                  {m.c && <span className="opacity-70"> — {m.c.v}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p data-pending="true">{PENDING}</p>
          )}
          {care && <p className="mt-4 opacity-70">{care.v}</p>}
        </Block>

        <Block en="SIZE" draft={chart?.status === 'AI_DRAFT'}>
          {chart ? (
            <div data-testid="size-chart">
              <table className="w-full table-fixed border-collapse text-center text-[12px] tabular-nums sm:text-[14px]">
                <thead>
                  <tr className="border-b border-[var(--c-blue)]">
                    <th className="w-[3.2rem] py-2 text-left font-medium sm:w-16">cm</th>
                    {chart.columns.map((c) => (
                      <th key={c} className="break-keep px-0.5 py-2 font-medium leading-tight">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.rows.map((r) => (
                    <tr key={r.size} className="border-b border-[var(--c-blue)]/15">
                      <td className="py-2 text-left font-semibold">{r.size}</td>
                      {r.values.map((v, i) => (
                        <td key={i} className="py-2">
                          {v ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[12.5px] opacity-60">{chart.note ?? '단면 기준, 재는 방법에 따라 1~3cm 차이가 있을 수 있습니다.'}</p>
            </div>
          ) : (
            <p data-pending="true">{PENDING}</p>
          )}
        </Block>

        <Block en="DELIVERY">
          <p>출고 후 2~3영업일{fee !== undefined && ` · 배송비 ${fee === 0 ? '무료' : fee.toLocaleString('ko-KR')}`}</p>
          <ul className="mt-4 space-y-1 opacity-70">
            {EXCHANGE.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Block>

        <Block en="INFORMATION" draft={shownNotice.some(([, x]) => x?.draft)}>
          <p className="sr-only">상품 정보 제공 고시</p>
          <dl className="grid grid-cols-1 text-[14px] sm:grid-cols-[11rem_1fr]" data-testid="notice">
            {shownNotice.map(([k, x]) => (
              <div key={k} className="contents">
                <dt className="pt-3 opacity-60 sm:border-b sm:border-[var(--c-blue)]/15 sm:py-2.5">{k}</dt>
                <dd className="border-b border-[var(--c-blue)]/15 pb-3 sm:py-2.5">{x?.v ?? PENDING}</dd>
              </div>
            ))}
          </dl>
        </Block>
      </div>
    </div>
  );
}
