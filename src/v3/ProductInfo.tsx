import type { Product } from '@/data/productTypes';
import type { VerifiableField } from '@/utils/contentStatus';
import { isClothing } from './data';

/** 상품정보제공고시: the items Korean e-commerce law requires, in the official order — 의류 and 가방·잡화. */
export const NOTICE_CLOTHING = ['제품 소재', '색상', '치수', '제조자 / 수입자', '제조국', '세탁방법 및 취급시 주의사항', '제조연월', '품질보증기준', 'A/S 책임자와 전화번호'] as const;
export const NOTICE_GOODS = ['종류', '소재', '색상', '크기', '제조자 / 수입자', '제조국', '취급시 주의사항', '품질보증기준', 'A/S 책임자와 전화번호'] as const;

const PENDING = '정보 준비 중';
type Shown = { v: string; draft: boolean } | null;
/** Owner facts and LAGI copy are shown as they are; example values (AI_DRAFT) are shown with a "예시" label so they are never read as checked facts. */
const val = (f?: VerifiableField<string> | null): Shown =>
  f && f.value !== null && (f.status === 'VERIFIED' || f.status === 'BRAND_COPY' || f.status === 'AI_DRAFT') ? { v: f.value, draft: f.status === 'AI_DRAFT' } : null;

const Draft = () => (
  <span className="kr ml-2 inline-block rounded-full border border-[var(--c-blue)]/40 px-2 py-0.5 align-middle text-[11px] text-[var(--c-blue)]" data-draft="true">
    예시 정보 · 확인 전
  </span>
);

function Block({ n, en, ko, draft, children }: { n: string; en: string; ko: string; draft?: boolean; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 border-t border-[var(--c-blue)] pt-6 md:grid-cols-12" aria-label={ko}>
      <div className="md:col-span-4">
        <p className="t-label t-mark text-[var(--c-blue)]">{n}</p>
        <h3 className="t-mark mt-2 text-[clamp(20px,1.8vw,28px)] font-medium text-[var(--c-blue)]">{en}</h3>
        <p className="kr mt-1 text-[14px] text-[var(--c-mute)]">
          {ko}
          {draft && <Draft />}
        </p>
      </div>
      <div className="kr text-[15px] leading-[1.85] md:col-span-8">{children}</div>
    </section>
  );
}

const Pending = () => <p className="text-[var(--c-mute)]" data-pending="true">{PENDING}</p>;
const BrandCopy = () => <p className="mt-2 text-[12px] text-[var(--c-mute)]">라기 작성 소개 · 제품 사진을 보고 쓴 글입니다</p>;

/**
 * The written half of a product page: story, why LAGI picked it, where and how it is made, the material, the size and
 * the legally required product information. Example values are labelled "예시 정보 · 확인 전" until replaced with real ones.
 */
export function ProductInfo({ p }: { p: Product }) {
  const clothing = isClothing(p);
  const story = val(p.story);
  const reason = val(p.lagiSelectionReason);
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
  const chartDraft = chart?.status === 'AI_DRAFT';
  const notice = p.notice ?? {};
  const items = clothing ? NOTICE_CLOTHING : NOTICE_GOODS;
  const shownNotice = items.map((k) => [k, val(notice[k])] as const);
  const madeDraft = [country, maker, how, ...steps.map((x) => x.d)].some((x) => x?.draft);
  return (
    <div className="mt-[var(--section)] space-y-14" data-testid="product-info">
      <Block n="01" en="STORY" ko={clothing ? '이 옷의 이야기' : '이 제품의 이야기'} draft={story?.draft}>
        {story ? <><p className="whitespace-pre-line">{story.v}</p>{p.story.status === 'BRAND_COPY' && <BrandCopy />}</> : <Pending />}
      </Block>
      <Block n="02" en="WHY WE SELECTED" ko="라기가 고른 이유" draft={reason?.draft}>
        {reason ? <><p className="whitespace-pre-line">{reason.v}</p>{p.lagiSelectionReason.status === 'BRAND_COPY' && <BrandCopy />}</> : <Pending />}
      </Block>
      <Block n="03" en="MADE BY" ko="어디서, 어떻게 만들어졌나" draft={madeDraft}>
        <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
          <dt className="text-[var(--c-mute)]">제조국</dt><dd>{country?.v ?? PENDING}</dd>
          <dt className="text-[var(--c-mute)]">만든 곳</dt><dd>{maker?.v ?? PENDING}</dd>
        </dl>
        {how && <p className="mt-4 whitespace-pre-line">{how.v}</p>}
        {steps.length > 0 && (
          <ol className="mt-4 space-y-2">
            {steps.map(({ s, d: x }) => (
              <li key={s.order}><span className="t-mark mr-2 text-[var(--c-blue)]">{String(s.order).padStart(2, '0')}</span>{s.title} — {x!.v}</li>
            ))}
          </ol>
        )}
      </Block>
      <Block n="04" en={clothing ? 'FABRIC' : 'MATERIAL'} ko={clothing ? '원단과 관리' : '소재와 관리'} draft={[...mats.flatMap((m) => [m.n, m.c]), care].some((x) => x?.draft)}>
        {mats.length ? (
          <ul className="space-y-2">
            {mats.map((m, i) => (
              <li key={i}><b className="font-semibold">{m.n!.v}</b>{m.c && <span> — {m.c.v}</span>}</li>
            ))}
          </ul>
        ) : <Pending />}
        {care && <p className="mt-4 text-[var(--c-mute)]">관리 · {care.v}</p>}
      </Block>
      <Block n="05" en="SIZE" ko="사이즈 (단위 cm)" draft={chartDraft}>
        {chart ? (
          <div className="overflow-x-auto" data-testid="size-chart">
            <table className="w-full min-w-[420px] border-collapse text-center tabular-nums">
              <thead><tr className="border-b border-[var(--c-blue)] text-[var(--c-blue)]"><th className="py-2 text-left">사이즈</th>{chart.columns.map((c) => <th key={c} className="py-2 font-medium">{c}</th>)}</tr></thead>
              <tbody>{chart.rows.map((r) => <tr key={r.size} className="border-b border-black/10"><td className="py-2 text-left font-semibold">{r.size}</td>{r.values.map((v, i) => <td key={i} className="py-2">{v ?? '-'}</td>)}</tr>)}</tbody>
            </table>
            <p className="mt-2 text-[13px] text-[var(--c-mute)]">{chart.note ?? '단면 기준, 재는 방법에 따라 1~3cm 차이가 있을 수 있습니다.'}</p>
          </div>
        ) : <Pending />}
      </Block>
      <Block n="06" en="INFORMATION" ko="상품 정보 제공 고시" draft={shownNotice.some(([, x]) => x?.draft)}>
        <dl className="grid grid-cols-1 border-t border-black/10 sm:grid-cols-[12rem_1fr]" data-testid="notice">
          {shownNotice.map(([k, x]) => (
            <div key={k} className="contents">
              <dt className="border-b border-black/10 py-2.5 text-[var(--c-mute)]">{k}</dt>
              <dd className="border-b border-black/10 py-2.5">{x?.v ?? PENDING}</dd>
            </div>
          ))}
        </dl>
      </Block>
    </div>
  );
}
