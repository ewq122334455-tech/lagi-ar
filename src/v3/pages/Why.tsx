import { WHY_LAGI } from '@/content/whyLagi';

/** WHY LAGI: the four criteria, side by side. No title (the menu already says it), no numbers, no scrolling tricks. */
export default function Why() {
  return (
    <div className="px-page pb-[var(--section)] pt-page">
      <h1 className="sr-only">Why LAGI</h1>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-x-[var(--gap)] gap-y-16 sm:grid-cols-2" data-testid="why-list">
        {WHY_LAGI.map((c) => (
          <section key={c.key} className="border-t border-[var(--c-blue)] pt-5">
            <h2 className="t-h3 t-mark">{c.key}</h2>
            <p className="t-body kr mt-3 text-[var(--c-mute)]">{c.question}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
