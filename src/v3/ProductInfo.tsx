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

const NAVY = '#17224f';
const RED = '#d62828';

const Draft = () => (
  <span className="kr ml-2 inline-block whitespace-nowrap rounded-full border border-[#17224f]/30 bg-white px-2 py-0.5 align-middle text-[11px] font-medium text-[#17224f]" data-draft="true">
    예시 정보 · 확인 전
  </span>
);

/* ---------- line icons (stroke = currentColor) ---------- */
const P: Record<string, string> = {
  bag: 'M6 8h12l1 12H5L6 8Zm3 0V6a3 3 0 0 1 6 0v2',
  tag: 'M3 12V4h8l9 9-8 8-9-9Zm4.5-4.5h.01',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  recycle: 'M7 19H4l3-5M17 19h3l-3-5M12 4l-2 3.5M12 4l2 3.5M8 14l4-7 4 7H8Z',
  layers: 'M12 3 3 8l9 5 9-5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  ruler: 'M3 17 17 3l4 4L7 21l-4-4Zm4-4 2 2m1-5 2 2m1-5 2 2',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10',
  truck: 'M2 6h11v10H2V6Zm11 4h4l4 4v2h-8v-6ZM6 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01',
  calendar: 'M4 6h16v14H4V6Zm0 4h16M8 3v5m8-5v5',
  gift: 'M4 10h16v10H4V10Zm-1-4h18v4H3V6Zm9 0v14M12 6S10 2 8 3s0 3 4 3Zm0 0s2-4 4-3 0 3-4 3Z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z',
  walk: 'M13 4a1.5 1.5 0 1 0 0-.01M10 21l2-6 3 3v3m-5-12 3-1 3 4 3 1m-9-4-2 5',
  refresh: 'M4 12a8 8 0 0 1 14-5l2 2m0-5v5h-5M20 12a8 8 0 0 1-14 5l-2-2m0 5v-5h5',
  shirt: 'M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3c0 2-2 3-4 3S8 5 8 3Z',
  alert: 'M12 3 2 20h20L12 3Zm0 6v5m0 3h.01',
  phone: 'M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2Z',
  clip: 'M8 4h8v3H8V4Zm-3 2h3m8 0h3v15H5V6Zm4 8 2 2 4-4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 3',
  cut: 'M6 6a2.5 2.5 0 1 0 0 .01M6 18a2.5 2.5 0 1 0 0 .01M8 7.5 20 18M8 16.5 20 6',
  hanger: 'M12 7a2 2 0 1 1 2-2c0 1.5-2 2-2 3.5L3 15v2h18v-2l-9-6.5',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
  hand: 'M8 13V5a1.5 1.5 0 0 1 3 0v6m0-7a1.5 1.5 0 0 1 3 0v7m0-5a1.5 1.5 0 0 1 3 0v8c0 4-3 7-7 7-3 0-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 13',
  screen: 'M3 4h18v12H3V4Zm6 16h6m-3-4v4',
  leaf: 'M5 19C5 9 11 4 20 4c0 9-5 15-15 15Zm0 0 8-8',
  pin: 'M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11Zm0-9a2 2 0 1 0 0-.01',
};
function Icon({ n, className = 'h-7 w-7' }: { n: keyof typeof P | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={P[n] ?? P.spark} />
    </svg>
  );
}
const Round = ({ n, red }: { n: string; red?: boolean }) => (
  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${red ? 'bg-[#d62828] text-white' : 'bg-[#ecebe7] text-[#17224f]'}`}>
    <Icon n={n} />
  </span>
);

/* ---------- building blocks ---------- */
function H({ eyebrow, lines, red, align = 'left', draft }: { eyebrow?: string; lines: string[]; red?: string; align?: 'left' | 'center'; draft?: boolean }) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      {eyebrow && <p className="t-mark text-[12px] font-semibold uppercase tracking-[0.18em] text-[#d62828]">{eyebrow}</p>}
      <h3 className="kr mt-2 text-[clamp(32px,6.4vw,60px)] font-black leading-[1.15] tracking-[-0.03em]" style={{ color: NAVY }}>
        {lines.map((l, i) => {
          const last = i === lines.length - 1;
          if (last && red && l.endsWith(red))
            return (
              <span key={i} className="block">
                {l.slice(0, -red.length)}
                <span style={{ color: RED }}>{red}</span>
              </span>
            );
          return <span key={i} className="block">{l}</span>;
        })}
      </h3>
      {align === 'center' && <span aria-hidden="true" className="mx-auto mt-5 block h-[3px] w-16 rounded-full bg-[#d62828]" />}
      {draft && <p className={`mt-3 ${align === 'center' ? 'text-center' : ''}`}><Draft /></p>}
    </div>
  );
}
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-[22px] bg-white p-5 shadow-[0_8px_28px_rgba(23,34,79,0.07)] md:p-7 ${className}`}>{children}</div>
);
function Row({ icon, children, red }: { icon: string; children: React.ReactNode; red?: boolean }) {
  return (
    <div className="flex items-center gap-4 py-4 md:gap-6">
      <Round n={icon} red={red} />
      <span aria-hidden="true" className="h-10 w-px shrink-0 bg-black/15" />
      <div className="kr text-[15px] leading-[1.7] text-[#2a2f45] md:text-[16px]">{children}</div>
    </div>
  );
}
function Photo({ src, alt, className = '', contain, pos }: { src?: string | null; alt: string; className?: string; contain?: boolean; pos?: string }) {
  if (!src) return null;
  return (
    <img
      {...responsive(src, '(max-width: 820px) 100vw, 820px')}
      src={src}
      alt={alt}
      loading="lazy"
      className={`block w-full ${contain ? 'object-contain' : 'object-cover'} ${className}`}
      style={pos ? { objectPosition: pos } : undefined}
    />
  );
}
const Sec = ({ children, label, className = '' }: { children: React.ReactNode; label: string; className?: string }) => (
  <section aria-label={label} className={`border-t border-black/[0.06] px-5 py-[clamp(64px,9vw,112px)] first:border-t-0 md:px-10 ${className}`}>
    {children}
  </section>
);

const EXCHANGE: [string, string][] = [
  ['calendar', '단순 변심: 상품을 수령한 날부터 7일 이내 교환·반품 신청 가능'],
  ['truck', '단순 변심 시 교환·반품 배송비는 구매자 부담'],
  ['gift', '상품 하자·오배송 시 배송비는 판매자 부담'],
  ['clip', '표시·광고 또는 계약 내용과 다른 경우: 공급받은 날부터 3개월 이내 또는 그 사실을 안 날부터 30일 이내 신청 가능'],
  ['box', '상품 확인을 위한 단순 포장 개봉만으로 교환·반품이 제한되지 않습니다.'],
  ['clock', '시간 경과로 재판매가 곤란할 정도로 상품 가치가 현저히 감소한 경우 교환·반품이 제한될 수 있습니다.'],
];
const FOR_ICONS = ['heart', 'walk', 'bag', 'refresh', 'gift', 'spark'];
const POINT_ICONS = ['layers', 'bag', 'spark', 'refresh', 'star'];

/**
 * The long product detail page, laid out like LAGI's FlourSack tote detail page: big navy headlines, red accents,
 * white icon cards, tables. A product with ready-made detail images (detailImages) shows those instead.
 * Everything comes from the product data; example values (AI_DRAFT) carry the "예시 정보 · 확인 전" label.
 */
export function ProductInfo({ p }: { p: Product }) {
  if (p.detailImages?.length) {
    return (
      <div className="-mx-[var(--page-x)] mt-[var(--section)] bg-[#f5f4f1]" data-testid="detail-images">
        <div className="mx-auto max-w-[860px]">
          {p.detailImages.map((d) => (
            <img key={d.src} {...responsive(d.src, '(max-width: 860px) 100vw, 860px')} src={d.src} alt={d.alt} loading="lazy" className="block h-auto w-full" width={1024} height={1505} />
          ))}
        </div>
      </div>
    );
  }

  const clothing = isClothing(p);
  const name = p.name.value ?? '';
  const copy = detailCopy(p.id, clothing, name);
  const story = val(p.story);
  const reason = val(p.lagiSelectionReason);
  const desc = val(p.description);
  const short = val(p.shortDescription);
  const country = val(p.making?.country);
  const maker = val(p.making?.maker);
  const how = val(p.making?.how);
  const steps = p.process.map((s) => ({ s, d: val(s.description) })).filter((x) => x.d);
  const mats = p.materials.map((m) => ({ n: val(m.name), c: val(m.characteristics) })).filter((m) => m.n);
  const care = val(p.care);
  const hl = p.highlights?.value ?? [];
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
  const brand = p.brandLabel ?? 'LAGI';

  // Pictures: real product photos and drawings only.
  const main = p.images[0];
  const draw = (g: string) => (p.drawings ?? []).filter((x) => x.group === g);
  const views = draw('view');
  const front = views[0]?.src ?? main;
  const styled = p.styledImages ?? [];
  const hero = styled[0] ?? main;
  const points: { label: string; src?: string; pos?: string; contain?: boolean }[] = clothing
    ? [
        { label: '상의', src: p.fitting?.image, contain: true },
        { label: '하의', src: p.fittingBottom?.image, contain: true },
        { label: '구성품', src: front, contain: true },
        { label: '스타일링', src: main, pos: '50% 25%' },
        { label: 'LAGI 셀렉', src: main, pos: '50% 80%' },
      ].filter((x) => x.src)
    : draw('detail').slice(0, 5).map((x) => ({ label: x.label, src: x.src, contain: false }));
  const processPics = draw('form').concat(draw('detail'));
  const storyPic = styled[1] ?? (clothing ? main : views.find((v) => /사선/.test(v.label))?.src ?? main);
  const choicePic = styled[2] ?? (clothing ? p.fittingBottom?.image ?? main : views[1]?.src ?? main);
  const setList = p.setItems ?? [];
  const fee = p.shipping?.fee;

  const diffCards: [string, string][] = clothing
    ? mats.slice(0, 2).map((m, i) => [i ? 'layers' : 'shirt', `${m.n!.v}${m.c ? ` — ${m.c.v}` : ''}`])
    : hl.slice(0, 2).map((t, i) => [i ? 'spark' : 'recycle', t]);

  return (
    <div className="-mx-[var(--page-x)] mt-[var(--section)] bg-[#f5f4f1]" data-testid="product-info">
      <div className="mx-auto max-w-[860px]">
        {/* 1. Hook */}
        <Sec label="소개">
          <H lines={copy.hook} />
          <p className="kr mt-6 text-[15px] leading-[1.7] text-[#3b4058]">
            [{brand}] {name}
            {short && <><br />{short.v}</>}
          </p>
          <div className="mt-10 overflow-hidden rounded-[22px]">
            <Photo src={hero} alt={`${name} 연출 사진`} className="aspect-[4/5] md:aspect-[5/6]" pos="50% 30%" />
          </div>
        </Sec>

        {/* 2. Name + kind */}
        <Sec label="제품">
          <H lines={[name.length > 14 ? copy.kind : name]} />
          <div className="mt-8 space-y-3">
            <Card className="!py-4"><Row icon="bag"><b className="font-semibold">[{brand}] {name}</b>{short && <><br />{short.v}</>}</Row></Card>
            <Card className="!py-4"><Row icon="tag"><b className="mr-4 font-semibold">상품 종류</b>{copy.kind}</Row></Card>
          </div>
          <div className="mt-8 overflow-hidden rounded-[22px] bg-white">
            <Photo src={front} alt={`${name} 제품 사진`} contain className="aspect-square p-6" />
          </div>
        </Sec>

        {/* 3. Story */}
        <Sec label="이 제품의 이야기">
          <H eyebrow="STORY" lines={clothing ? ['이 옷의', '이야기'] : ['이 제품의', '이야기']} align="center" draft={story?.draft} />
          <Card className="mx-auto mt-10 max-w-[640px]">
            <p className="kr whitespace-pre-line text-[16px] leading-[1.9] text-[#2a2f45]">{story?.v ?? desc?.v ?? PENDING}</p>
            {p.story.status === 'BRAND_COPY' && <p className="kr mt-3 text-[12px] text-[#8a8d99]">라기 작성 소개 · 제품 사진을 보고 쓴 글입니다</p>}
          </Card>
          <div className="mt-10 overflow-hidden rounded-[22px]">
            <Photo src={storyPic} alt={`${name} 사진`} className="aspect-[4/3]" pos="50% 35%" />
          </div>
        </Sec>

        {/* 4. Different */}
        <Sec label="다른 디자인">
          <H lines={copy.diff} align="center" />
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {diffCards.map(([ic, t]) => (
              <Card key={t} className="text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#17224f] text-[#17224f]"><Icon n={ic} className="h-8 w-8" /></span>
                <span aria-hidden="true" className="mx-auto my-4 block h-px w-full bg-black/10" />
                <p className="kr text-[15px] leading-[1.8] text-[#2a2f45]">{t}</p>
              </Card>
            ))}
          </div>
        </Sec>

        {/* 5. Points at a glance */}
        {points.length > 0 && (
          <Sec label="한눈에 보는 포인트">
            <H lines={['한눈에 보는', '포인트']} />
            <ul className="mt-10 space-y-3">
              {points.map((x, i) => (
                <li key={x.label + i} className="grid grid-cols-[1fr_1.2fr] items-stretch overflow-hidden rounded-[18px] bg-white shadow-[0_6px_20px_rgba(23,34,79,0.06)]">
                  <div className="flex items-center gap-3 px-4 py-4 md:gap-5 md:px-6">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#17224f] text-white md:h-12 md:w-12"><Icon n={POINT_ICONS[i % POINT_ICONS.length]} className="h-6 w-6" /></span>
                    <span className="kr text-[15px] font-bold text-[#17224f] md:text-[17px]">{x.label}</span>
                  </div>
                  <div className="h-[104px] bg-[#f0efeb] md:h-[120px]">
                    <Photo src={x.src} alt={`${name} ${x.label}`} contain={x.contain} pos={x.pos} className={`h-full ${x.contain ? 'p-2' : ''}`} />
                  </div>
                </li>
              ))}
            </ul>
          </Sec>
        )}

        {/* 6. Material */}
        <Sec label={clothing ? '원단' : '소재'}>
          <H eyebrow={clothing ? 'FABRIC' : 'MATERIAL'} lines={clothing ? ['원단이 만든', '개성'] : ['소재가 만든', '개성']} align="center" draft={mats.some((m) => m.n?.draft || m.c?.draft)} />
          <div className="mx-auto mt-10 max-w-[640px] space-y-3">
            {mats.length ? (
              mats.map((m, i) => (
                <Card key={i} className="!py-3"><Row icon={clothing ? 'shirt' : 'leaf'} red><b className="font-semibold">{m.n!.v}</b>{m.c && <><br />{m.c.v}</>}</Row></Card>
              ))
            ) : (
              <Card><p className="kr text-[#8a8d99]" data-pending="true">{PENDING}</p></Card>
            )}
          </div>
        </Sec>

        {/* 7. Why LAGI chose it */}
        <Sec label="라기가 고른 이유">
          <p className="t-mark text-[12px] font-semibold uppercase tracking-[0.18em] text-[#d62828]">WHY WE SELECTED</p>
          <h3 className="kr mt-2 text-[clamp(32px,6.4vw,60px)] font-black leading-[1.15] tracking-[-0.03em]" style={{ color: NAVY }}>
            <span className="mb-2 block"><span className="border-b-[3px] border-[#17224f] pb-0.5">LAGI의</span></span>
            <span className="block"><span style={{ color: RED }}>{clothing ? '셀렉' : '업사이클링'}</span> 선택</span>
          </h3>
          {reason?.draft && <p className="mt-3"><Draft /></p>}
          <div className="mt-8 divide-y divide-black/10">
            <Row icon="ruler">{reason?.v ?? PENDING}</Row>
            <Row icon="refresh">{clothing ? '라기가 직접 고른 스타일을 한 벌로 묶어 소개해요.' : '버려지는 소재에 다시 쓰임을 주는 제작 방식을 골랐어요.'}</Row>
          </div>
          <div className="mt-8 overflow-hidden rounded-[22px] bg-white">
            <Photo src={choicePic} alt={`${name} 사진`} contain={clothing || !styled[2]} className="aspect-[4/3] p-4" />
          </div>
        </Sec>

        {/* 8. How it is made */}
        <Sec label="어디서, 어떻게 만들어졌나">
          <H eyebrow="MADE BY" lines={clothing ? ['어디서,', '어떻게 만들었나'] : ['업사이클링', '방식']} align="center" draft={madeDraft} />
          {how && <p className="kr mx-auto mt-8 max-w-[640px] rounded-full border border-[#17224f]/40 bg-white px-6 py-3 text-center text-[14px] leading-[1.7] text-[#2a2f45]">{how.v}</p>}
          {steps.length > 0 && (
            <ol className="mt-10 grid grid-cols-3 gap-2 md:gap-4">
              {steps.slice(0, 3).map(({ s, d: x }, i) => (
                <li key={s.order} className="text-center">
                  <div className="overflow-hidden rounded-[18px] bg-white">
                    <Photo src={processPics[i]?.src ?? main} alt={`${s.title}`} contain className="aspect-[3/4] p-2" />
                  </div>
                  <p className="kr mt-3 text-[14px] font-bold text-[#17224f]"><span className="t-mark mr-1 text-[#d62828]">{String(s.order).padStart(2, '0')}</span>{s.title}</p>
                  <p className="kr mt-1 text-[12.5px] leading-[1.6] text-[#5b6075]">{x!.v}</p>
                </li>
              ))}
            </ol>
          )}
          <dl className="kr mx-auto mt-10 grid max-w-[640px] grid-cols-[6.5rem_1fr] overflow-hidden rounded-[14px] bg-white text-[14px]">
            <dt className="bg-[#17224f] px-4 py-3 font-semibold text-white">제조국</dt><dd className="border-b border-black/5 px-4 py-3">{country?.v ?? PENDING}</dd>
            <dt className="bg-[#17224f] px-4 py-3 font-semibold text-white">만든 곳</dt><dd className="px-4 py-3">{maker?.v ?? PENDING}</dd>
          </dl>
        </Sec>

        {/* 9. Product info + size */}
        <Sec label="구성 및 제품 정보">
          <H eyebrow="SIZE" lines={['구성 및 제품 정보']} align="center" draft={chart?.status === 'AI_DRAFT'} />
          <dl className="kr mt-10 grid grid-cols-[7rem_1fr] overflow-hidden rounded-[10px] border border-black/10 bg-white text-[14px] md:grid-cols-[9rem_1fr]">
            {[
              ['제품명', name],
              ['브랜드', brand],
              ['제품 유형', copy.kind],
              [clothing ? '주요 원단' : '주요 소재', mats.map((m) => m.n!.v).join(' / ') || PENDING],
              ['구성품', setList.length ? setList.join(', ') : `${name} 1개`],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="border-b border-white/10 bg-[#17224f] px-4 py-3 text-center font-semibold text-white">{k}</dt>
                <dd className="border-b border-black/5 px-4 py-3">{v}</dd>
              </div>
            ))}
          </dl>
          {chart ? (
            <div className="mt-8 overflow-x-auto rounded-[14px] bg-white p-4 md:p-6" data-testid="size-chart">
              <p className="kr mb-3 text-[14px] font-bold text-[#17224f]">사이즈 (단위 cm)</p>
              <table className="w-full min-w-[420px] border-collapse text-center text-[14px] tabular-nums">
                <thead><tr className="bg-[#17224f] text-white"><th className="px-2 py-2 text-left">사이즈</th>{chart.columns.map((c) => <th key={c} className="px-2 py-2 font-medium">{c}</th>)}</tr></thead>
                <tbody>{chart.rows.map((r) => <tr key={r.size} className="border-b border-black/10"><td className="px-2 py-2 text-left font-semibold">{r.size}</td>{r.values.map((v, i) => <td key={i} className="py-2">{v ?? '-'}</td>)}</tr>)}</tbody>
              </table>
              <p className="kr mt-2 text-[12.5px] text-[#8a8d99]">{chart.note ?? '단면 기준, 재는 방법에 따라 1~3cm 차이가 있을 수 있습니다.'}</p>
            </div>
          ) : (
            <p className="kr mt-8 text-[#8a8d99]" data-pending="true">사이즈 {PENDING}</p>
          )}
        </Sec>

        {/* 10. Use and care */}
        <Sec label="사용 및 관리 안내">
          <H lines={['사용 및 관리 안내']} align="center" draft={care?.draft} />
          <div className="mt-10 overflow-hidden rounded-[14px] border-2 border-[#17224f] bg-white">
            <div className="grid grid-cols-[7rem_1fr] bg-[#17224f] text-center text-[14px] font-semibold text-white md:grid-cols-[9rem_1fr]"><span className="kr py-2">관리 방법</span><span className="kr py-2">안내</span></div>
            <div className="grid grid-cols-[7rem_1fr] items-center md:grid-cols-[9rem_1fr]">
              <span className="flex justify-center py-6 text-[#17224f]"><Icon n={clothing ? 'hanger' : 'box'} className="h-12 w-12" /></span>
              <p className="kr border-l border-[#17224f]/30 px-5 py-6 text-[15px] leading-[1.8] text-[#2a2f45]">{care?.v ?? PENDING}</p>
            </div>
          </div>
          <Card className="mt-4 divide-y divide-dashed divide-black/15 !py-2">
            <Row icon="alert">날카로운 물체와의 마찰 및 과도한 하중에 주의해 주세요. 고온 및 화기 가까이에서의 사용을 피해 주세요.</Row>
            <Row icon="sun">직사광선과 습기를 피해 보관해 주세요.</Row>
            <Row icon="screen">모니터 및 디스플레이 환경에 따라 실제 제품의 색상이 다르게 보일 수 있습니다.</Row>
          </Card>
        </Sec>

        {/* 11. For whom */}
        <Sec label="이런 분께 추천해요">
          <H lines={['이런 분께 추천해요']} align="center" />
          <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(copy.forWhom ?? []).map((t, i) => (
              <li key={t} className="flex items-center gap-4 rounded-[18px] bg-white px-5 py-5 shadow-[0_6px_20px_rgba(23,34,79,0.06)]">
                <span className={i % 2 ? 'text-[#d62828]' : 'text-[#17224f]'}><Icon n={FOR_ICONS[i % FOR_ICONS.length]} className="h-9 w-9" /></span>
                <span className="kr text-[15px] leading-[1.6] text-[#2a2f45]">{t}</span>
              </li>
            ))}
          </ul>
        </Sec>

        {/* 12. Delivery */}
        <Sec label="배송 안내">
          <H lines={['배송 안내']} align="center" />
          <Card className="mt-10">
            <div className="flex items-center gap-5 md:gap-8">
              <span className="text-[#17224f]"><Icon n="truck" className="h-16 w-16 md:h-20 md:w-20" /></span>
              <span aria-hidden="true" className="h-16 w-px bg-black/15" />
              <p className="kr text-[clamp(18px,3vw,26px)] font-bold leading-[1.5] text-[#17224f]">
                평균 배송 기간:<br />출고 후 2~3영업일
              </p>
            </div>
            {fee !== undefined && <p className="kr mt-4 text-[14px] text-[#5b6075]">배송비 {fee === 0 ? '무료' : `${fee.toLocaleString('ko-KR')}원`}</p>}
          </Card>
        </Sec>

        {/* 13. Exchange + legal notice */}
        <Sec label="교환·반품 및 고지">
          <H eyebrow="INFORMATION" lines={['교환·반품 및 고지']} />
          <ul className="mt-8 divide-y divide-black/10 border-y border-black/10">
            {EXCHANGE.map(([ic, t]) => (
              <li key={t} className="kr flex items-center gap-4 py-3.5 text-[14px] leading-[1.6] text-[#2a2f45]">
                <span className="text-[#17224f]"><Icon n={ic} className="h-6 w-6" /></span>
                {t}
              </li>
            ))}
          </ul>
          <h4 className="kr mt-12 text-[17px] font-bold text-[#17224f]">
            상품 정보 제공 고시
            {shownNotice.some(([, x]) => x?.draft) && <Draft />}
          </h4>
          <dl className="kr mt-3 grid grid-cols-1 overflow-hidden rounded-[10px] border border-black/10 bg-white text-[14px] sm:grid-cols-[12rem_1fr]" data-testid="notice">
            {shownNotice.map(([k, x]) => (
              <div key={k} className="contents">
                <dt className="border-b border-black/5 bg-[#ecebe7] px-4 py-2.5 font-semibold text-[#17224f]">{k}</dt>
                <dd className="border-b border-black/5 px-4 py-2.5">{x?.v ?? PENDING}</dd>
              </div>
            ))}
          </dl>
          <Card className="mt-6 !py-2">
            <Row icon="phone">제품 관련 문의 및 교환·반품 상담은 LAGI 공식 스마트스토어를 통해 문의해 주세요.</Row>
          </Card>
        </Sec>
      </div>
    </div>
  );
}
