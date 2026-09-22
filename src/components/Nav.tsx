import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const LINKS = [
  { to: '/products', label: 'PRODUCTS' },
  { to: '/ar', label: 'LOOK CLOSER' },
  { to: '/materials', label: 'MATERIALS' },
  { to: '/about', label: 'ABOUT' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
    setSearchOpen(false);
    setOpen(false);
  }

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

        {searchOpen ? (
          <form onSubmit={submitSearch} className="flex items-center gap-2 border-b border-ink pb-1">
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => !query && setSearchOpen(false)}
              placeholder="SEARCH PRODUCTS"
              aria-label="제품 검색"
              className="eyebrow w-40 bg-transparent placeholder:text-stone focus:outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="검색 열기"
            className="focus-ring text-stone transition-colors hover:text-ink"
          >
            <SearchIcon />
          </button>
        )}

        <a
          href="https://smartstore.naver.com/lagi_official"
          target="_blank"
          rel="noopener noreferrer"
          className="eyebrow border border-ink px-4 py-2 transition-colors hover:bg-ink hover:text-paper focus-ring"
        >
          SHOP
        </a>
      </nav>

      <div className="flex items-center gap-4 lg:hidden">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={open} className="flex flex-col gap-1.5 p-2 focus-ring">
          <span className={`h-px w-6 bg-ink transition-transform ${open ? 'translate-y-[3px] rotate-45' : ''}`} />
          <span className={`h-px w-6 bg-ink transition-transform ${open ? '-translate-y-[3px] -rotate-45' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-x-0 top-[var(--nav-height)] flex flex-col gap-6 border-t border-line bg-paper px-6 py-8 lg:hidden">
          <form onSubmit={submitSearch} className="flex items-center gap-2 border-b border-line pb-2">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SEARCH PRODUCTS"
              aria-label="제품 검색"
              className="eyebrow w-full bg-transparent placeholder:text-stone focus:outline-none"
            />
          </form>
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

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11.5 11.5L15 15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
