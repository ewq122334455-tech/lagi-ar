import { OFFICIAL_LINKS } from '../data';

/** Only confirmed official channels. */
export default function Contact() {
  const rows = [
    { label: 'Official store', value: 'Naver Smart Store', href: OFFICIAL_LINKS.store },
    { label: 'Instagram', value: '@lagi.official', href: OFFICIAL_LINKS.instagram },
  ];
  return (
    <div className="px-page pb-32 pt-page">
      <h1 className="t-display">CONTACT</h1>
      <dl className="rule mt-16 grid grid-cols-1 gap-[var(--gap)] pt-4 md:grid-cols-2 lg:mt-24">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="t-label text-[var(--c-mute)]">{r.label}</dt>
            <dd className="mt-2">
              <a href={r.href} target="_blank" rel="noopener noreferrer" className="t-h1 hover:text-[var(--c-blue)]">
                {r.value} ↗
              </a>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
