import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/products', label: 'PRODUCT' },
  { to: '/ar', label: 'AR' },
  { to: '/story', label: 'STORY' },
  { to: '/about', label: 'ABOUT' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 flex h-[var(--nav-height)] items-center justify-between px-6 transition-colors duration-300 lg:px-10 ${
        scrolled ? 'bg-paper/95 backdrop-blur border-b border-line' : 'bg-transparent'
      }`}
    >
      <NavLink to="/" className="text-lg font-semibold tracking-[0.3em] focus-ring" aria-label="LAGI 홈">
        LAGI
      </NavLink>

      <nav className="hidden items-center gap-10 lg:flex" aria-label="주요 메뉴">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `eyebrow focus-ring transition-colors hover:text-ink ${isActive ? 'text-ink' : 'text-stone'}`
            }
          >
            {l.label}
          </NavLink>
        ))}
        <a
          href="https://smartstore.naver.com/lagi_official"
          target="_blank"
          rel="noopener noreferrer"
          className="eyebrow border border-ink px-4 py-2 transition-colors hover:bg-ink hover:text-paper focus-ring"
        >
          SHOP
        </a>
      </nav>

      <button
        type="button"
        className="flex flex-col gap-1.5 p-2 lg:hidden focus-ring"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
      >
        <span className={`h-px w-6 bg-ink transition-transform ${open ? 'translate-y-[3px] rotate-45' : ''}`} />
        <span className={`h-px w-6 bg-ink transition-transform ${open ? '-translate-y-[3px] -rotate-45' : ''}`} />
      </button>

      {open && (
        <div className="fixed inset-x-0 top-[var(--nav-height)] flex flex-col gap-6 border-t border-line bg-paper px-6 py-8 lg:hidden">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className="eyebrow text-ink focus-ring">
              {l.label}
            </NavLink>
          ))}
          <a
            href="https://smartstore.naver.com/lagi_official"
            target="_blank"
            rel="noopener noreferrer"
            className="eyebrow text-ink focus-ring"
          >
            SHOP
          </a>
        </div>
      )}
    </header>
  );
}
