import { OFFICIAL_LINKS } from '../data';

/** Only confirmed official channels. */
export default function Contact() {
  const rows = [
    { label: '공식 스토어', value: '네이버 스마트스토어', href: OFFICIAL_LINKS.store },
    { label: '인스타그램', value: '@lagi.official', href: OFFICIAL_LINKS.instagram },
  ];
  return (
    <div className="px-page pb-32 pt-page">
      <h1 className="t-display t-mark">CONTACT</h1>
      <p className="t-en mt-4">Official channels.</p>
      <p className="t-kr-sub mt-2">라기의 공식 채널입니다. 주문 · 배송 문의는 스마트스토어 문의하기를 이용해 주세요.</p>
      <dl className="rule mt-16 grid grid-cols-1 gap-[var(--gap)] pt-4 md:grid-cols-2 lg:mt-24">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="t-caption kr text-[var(--c-mute)]">{r.label}</dt>
            <dd className="mt-2">
              <a href={r.href} target="_blank" rel="noopener noreferrer" className="t-h1 kr hover:text-[var(--c-blue)]">
                {r.value} ↗
              </a>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
