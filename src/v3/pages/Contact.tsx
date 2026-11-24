import { OFFICIAL_LINKS } from '../data';

/** Only confirmed official channels. */
export default function Contact() {
  const rows = [
    { label: 'Store', value: 'Smart Store', href: OFFICIAL_LINKS.store },
    { label: 'Instagram', value: '@lagi.official', href: OFFICIAL_LINKS.instagram },
  ];
  return (
    <div className="px-page pb-[var(--section)] pt-page">
      <h1 className="sr-only">Contact</h1>
      <dl className="mt-16 grid grid-cols-1 gap-16 text-center md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="t-label t-mark text-[var(--c-mute)]">{r.label}</dt>
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
