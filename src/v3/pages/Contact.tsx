import { OFFICIAL_LINKS } from '../data';

/** Only confirmed official channels. */
export default function Contact() {
  const rows = [
    { label: '공식 스토어', value: '네이버 스마트스토어', href: OFFICIAL_LINKS.store },
    { label: '인스타그램', value: '@lagi.official', href: OFFICIAL_LINKS.instagram },
  ];
  return (
    <div className="px-page pb-[var(--section)] pt-page">
      <h1 className="t-label t-mark text-center">Contact</h1>
      <dl className="mt-32 grid grid-cols-1 gap-16 text-center md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="t-caption kr text-[var(--c-mute)]">{r.label}</dt>
            <dd className="mt-2">
              <a href={r.href} target="_blank" rel="noopener noreferrer" className="tap t-h1 kr hover:text-[var(--c-blue)]">
                {r.value} ↗
              </a>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
