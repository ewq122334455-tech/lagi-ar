import type { Product } from '@/data/productTypes';
import { isPublished } from '@/utils/contentStatus';
import type { VerifiableField } from '@/utils/contentStatus';

/** The items Korean law (상품정보제공고시 · 의류) requires on a clothing page, in the official order. */
export const NOTICE_ITEMS = ['제품 소재', '색상', '치수', '제조자 / 수입자', '제조국', '세탁방법 및 취급시 주의사항', '제조연월', '품질보증기준', 'A/S 책임자와 전화번호'] as const;

const PENDING = '정보 준비 중';
const val = (f?: VerifiableField<string> | null) => (f && isPublished(f) ? f.value : null);

function Block({ n, en, ko, children }: { n: string; en: string; ko: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-x-[var(--gap)] gap-y-4 border-t border-[var(--c-blue)] pt-6 md:grid-cols-12" aria-label={ko}>
      <div className="md:col-span-4">
        <p className="t-label t-mark text-[var(--c-blue)]">{n}</p>
        <h3 className="t-mark mt-2 text-[clamp(20px,1.8vw,28px)] font-medium text-[var(--c-blue)]">{en}</h3>
        <p className="kr mt-1 text-[14px] text-[var(--c-mute)]">{ko}</p>
      </div>
      <div className="kr text-[15px] leading-[1.85] md:col-span-8">{children}</div>
    </section>
  );
}

const Pending = () => <p className="text-[var(--c-mute)]" data-pending="true">{PENDING}</p>;

/**
 * The written half of a product page: this garment's story, why LAGI picked it, where and how it is made, the fabric,
 * the size chart and the legally required product information. Only owner-supplied facts are shown; anything not yet
 * supplied reads "정보 준비 중" (nothing is guessed — see contentStatus.ts).
 */
export function ProductInfo({ p }: { p: Product }) {
  const story = val(p.story);
  const reason = val(p.lagiSelectionReason);
  const country = val(p.making?.country);
  const maker = val(p.making?.maker);
  const how = val(p.making?.how);
  const steps = p.process.filter((s) => isPublished(s.description));
  const mats = p.materials.filter((m) => isPublished(m.name));
  const care = val(p.care);
  const chart = p.sizeChart && p.sizeChart.rows.length ? p.sizeChart : null;
  const notice = p.notice ?? {};
  return (
    <div className="mt-[var(--section)] space-y-14" data-testid="product-info">
      <Block n="01" en="STORY" ko="이 옷의 이야기">{story ? <p className="whitespace-pre-line">{story}</p> : <Pending />}</Block>
      <Block n="02" en="WHY WE SELECTED" ko="라기가 고른 이유">{reason ? <p className="whitespace-pre-line">{reason}</p> : <Pending />}</Block>
      <Block n="03" en="MADE BY" ko="어디서, 어떻게 만들어졌나">
        <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
          <dt className="text-[var(--c-mute)]">제조국</dt><dd>{country ?? PENDING}</dd>
          <dt className="text-[var(--c-mute)]">만든 곳</dt><dd>{maker ?? PENDING}</dd>
        </dl>
        {how && <p className="mt-4 whitespace-pre-line">{how}</p>}
        {steps.length > 0 && (
          <ol className="mt-4 space-y-2">
            {steps.map((s) => (
              <li key={s.order}><span className="t-mark mr-2 text-[var(--c-blue)]">{String(s.order).padStart(2, '0')}</span>{s.title} — {s.description.value}</li>
            ))}
          </ol>
        )}
      </Block>
      <Block n="04" en="FABRIC" ko="원단과 관리">
        {mats.length ? (
          <ul className="space-y-2">
            {mats.map((m, i) => (
              <li key={i}><b className="font-semibold">{m.name.value}</b>{isPublished(m.characteristics) && <span> — {m.characteristics.value}</span>}</li>
            ))}
          </ul>
        ) : <Pending />}
        {care && <p className="mt-4 text-[var(--c-mute)]">관리 · {care}</p>}
      </Block>
      <Block n="05" en="SIZE" ko="사이즈 (단위 cm)">
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
      <Block n="06" en="INFORMATION" ko="상품 정보 제공 고시">
        <dl className="grid grid-cols-1 border-t border-black/10 sm:grid-cols-[12rem_1fr]" data-testid="notice">
          {NOTICE_ITEMS.map((k) => (
            <div key={k} className="contents">
              <dt className="border-b border-black/10 py-2.5 text-[var(--c-mute)]">{k}</dt>
              <dd className="border-b border-black/10 py-2.5">{val(notice[k]) ?? PENDING}</dd>
            </div>
          ))}
        </dl>
      </Block>
    </div>
  );
}
