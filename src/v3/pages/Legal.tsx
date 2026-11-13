import type { LegalDocument } from '@/content/legal';

/** A legal notice (privacy policy, terms) from src/content/legal.ts. Only routed when it is filled in. */
export default function Legal({ doc }: { doc: LegalDocument }) {
  return (
    <article className="px-page pb-32 pt-page">
      <div className="mx-auto max-w-3xl">
        <h1 className="t-h1 kr !font-bold">{doc.title}</h1>
        <p className="t-caption kr mt-2 text-[var(--c-mute)]">시행일 {doc.effectiveDate}</p>
        <div className="mt-10 space-y-4">
          {doc.body
            .split(/\n{2,}/)
            .map((block) => block.trim())
            .filter(Boolean)
            .map((block, i) =>
              block.startsWith('## ') ? (
                <h2 key={i} className="t-h3 kr pt-6">
                  {block.slice(3)}
                </h2>
              ) : (
                <p key={i} className="t-body kr whitespace-pre-line">
                  {block}
                </p>
              ),
            )}
        </div>
      </div>
    </article>
  );
}
