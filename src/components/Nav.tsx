import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const LINKS = [
  { to: '/products', label: 'PRODUCTS' },
  { to: '/ar', label: 'LOOK CLOSER' },
  { to: '/materials', label: 'MATERIALS' },
  { to: '/about', label: 'ABOUT' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
    setSearchOpen(false);
    setOpen(false);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-[var(--nav-height)] items-center justify-between border-b border-line bg-paper px-6 lg:px-10">
      <NavLink to="/" className="font-display text-2xl focus-ring" aria-label="LAGI 홈">
        LAGI
      </NavLink>

      <nav className="hidden items-center gap-8 lg:flex" aria-label="주요 메뉴">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `font-heading text-sm font-extrabold focus-ring transition-colors hover:text-blue ${isActive ? 'text-ink' : 'text-graphite'}`
            }
          >
            {l.label}
          </NavLink>
        ))}

        {searchOpen ? (
          <form onSubmit={submitSearch} className="flex items-center gap-2 rounded-full border-2 border-ink px-3 py-1.5">
            <SearchIcon />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => !query && setSearchOpen(false)}
              placeholder="SEARCH"
              aria-label="제품 검색"
              className="w-32 bg-transparent font-heading text-sm font-bold placeholder:text-stone focus:outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="검색 열기"
            className="focus-ring text-graphite transition-colors hover:text-ink"
          >
            <SearchIcon />
          </button>
        )}

        <a
          href="https://smartstore.naver.com/lagi_official"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-ink px-5 py-2 font-heading text-sm font-extrabold text-paper transition-transform hover:-translate-y-0.5 focus-ring"
        >
          SHOP
        </a>
      </nav>

      <div className="flex items-center gap-4 lg:hidden">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={open} className="flex flex-col gap-1.5 p-2 focus-ring">
          <span className={`h-0.5 w-6 rounded-full bg-ink transition-transform ${open ? 'translate-y-[3px] rotate-45' : ''}`} />
          <span className={`h-0.5 w-6 rounded-full bg-ink transition-transform ${open ? '-translate-y-[3px] -rotate-45' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-x-0 top-[var(--nav-height)] flex flex-col gap-6 border-t border-line bg-paper px-6 py-8 lg:hidden">
          <form onSubmit={submitSearch} className="flex items-center gap-2 rounded-full border-2 border-line px-3 py-2">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SEARCH PRODUCTS"
              aria-label="제품 검색"
              className="w-full bg-transparent font-heading text-sm font-bold placeholder:text-stone focus:outline-none"
            />
          </form>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className="font-heading text-lg font-extrabold text-ink focus-ring">
              {l.label}
            </NavLink>
          ))}
          <a
            href="https://smartstore.naver.com/lagi_official"
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit rounded-full bg-ink px-6 py-3 font-heading text-sm font-extrabold text-paper focus-ring"
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
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11.5 11.5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
