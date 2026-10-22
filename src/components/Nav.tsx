import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '@/commerce/CartContext';
import { LagiLogo } from '@/components/LagiLogo';

/** Store categories. `match` decides which tab lights up for the current URL. */
const TABS: { to: string; label: string; match: (path: string, search: string) => boolean }[] = [
  { to: '/', label: '홈', match: (p) => p === '/' },
  { to: '/products?sort=ranking', label: '랭킹', match: (p, s) => p === '/products' && s.includes('sort=ranking') },
  { to: '/products', label: '전체 상품', match: (p, s) => p === '/products' && !s.includes('sort=ranking') && !s.includes('filter=') },
  { to: '/products?filter=tryon', label: 'AI 피팅', match: (p, s) => p === '/products' && s.includes('filter=tryon') },
  { to: '/again', label: '다시 조합', match: (p) => p === '/again' },
  { to: '/materials', label: '소재', match: (p) => p === '/materials' },
  { to: '/story', label: '스토리', match: (p) => p === '/story' },
  { to: '/about', label: '브랜드', match: (p) => p === '/about' },
];

export function Nav() {
  const [mobileSearch, setMobileSearch] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { count, open: openCart } = useCart();

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
    setMobileSearch(false);
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 bg-paper">
        {/* Utility strip */}
        <div className="hidden h-9 items-center justify-between bg-blue px-10 text-xs text-paper lg:flex">
          <p className="font-medium tracking-wide">
            lagi = 다시 · <span className="opacity-70">Look closer, again.</span>
          </p>
          <div className="flex gap-5 opacity-90">
            <a href="https://smartstore.naver.com/lagi_official" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 focus-ring">
              스마트스토어
            </a>
            <a href="https://www.instagram.com/lagi.official/" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 focus-ring">
              인스타그램
            </a>
          </div>
        </div>

        {/* Main bar */}
        <div className="flex h-14 items-center gap-4 px-4 lg:h-[68px] lg:gap-10 lg:px-10">
          <Link to="/" className="flex shrink-0 items-center focus-ring" aria-label="LAGI 홈">
            <LagiLogo className="h-[18px] w-auto lg:h-[22px]" />
          </Link>

          <form onSubmit={submitSearch} className="hidden max-w-xl flex-1 lg:block" role="search">
            <label className="flex h-11 items-center gap-3 rounded-full bg-mist px-5 focus-within:ring-2 focus-within:ring-blue">
              <SearchIcon />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="가방, 기능, 소재를 검색해 보세요"
                aria-label="제품 검색"
                className="w-full bg-transparent text-sm placeholder:text-stone focus:outline-none"
              />
            </label>
          </form>

          <div className="ml-auto flex items-center gap-1 lg:gap-3">
            <button
              type="button"
              onClick={() => setMobileSearch((v) => !v)}
              aria-label="검색"
              className="p-2 focus-ring lg:hidden"
            >
              <SearchIcon />
            </button>
            <Link to="/again" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-mist focus-ring lg:flex">
              <span className="h-2 w-2 rounded-full bg-lime" aria-hidden="true" />
              다시 조합하기
            </Link>
            <button
              type="button"
              onClick={openCart}
              aria-label={`장바구니 열기, ${count}개 담김`}
              className="relative flex items-center gap-2 rounded-full p-2 text-sm font-semibold hover:bg-mist focus-ring lg:px-3"
            >
              <BagIcon />
              <span className="hidden lg:inline">장바구니</span>
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold text-paper lg:static lg:h-5 lg:min-w-5">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {mobileSearch && (
          <form onSubmit={submitSearch} className="absolute inset-x-0 top-14 z-10 border-b border-line bg-paper px-4 py-3 lg:hidden" role="search">
            <label className="flex h-11 items-center gap-3 rounded-full bg-mist px-4">
              <SearchIcon />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="가방, 기능, 소재를 검색해 보세요"
                aria-label="제품 검색"
                className="w-full bg-transparent text-sm placeholder:text-stone focus:outline-none"
              />
            </label>
          </form>
        )}

        {/* Category tabs */}
        <nav aria-label="카테고리" className="border-b border-line">
          <ul className="no-scrollbar flex h-11 items-stretch gap-5 overflow-x-auto px-4 lg:gap-8 lg:px-10">
            {TABS.map((t) => {
              const active = t.match(pathname, search);
              return (
                <li key={t.label} className="shrink-0">
                  <Link
                    to={t.to}
                    aria-current={active ? 'page' : undefined}
                    className={`flex h-full items-center border-b-2 text-[15px] focus-ring ${
                      active ? 'border-blue font-bold text-ink' : 'border-transparent font-medium text-graphite hover:text-ink'
                    }`}
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <MobileTabBar count={count} onCart={openCart} />
    </>
  );
}

function MobileTabBar({ count, onCart }: { count: number; onCart: () => void }) {
  const item = 'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium focus-ring';
  const tone = ({ isActive }: { isActive: boolean }) => `${item} ${isActive ? 'text-blue' : 'text-graphite'}`;
  return (
    <nav
      aria-label="하단 메뉴"
      className="fixed inset-x-0 bottom-0 z-50 flex h-[var(--tabbar-height)] border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <NavLink to="/" end className={tone}>
        <HomeIcon />홈
      </NavLink>
      <NavLink to="/products" className={tone}>
        <GridIcon />
        상품
      </NavLink>
      <NavLink to="/again" className={tone}>
        <AgainIcon />
        다시
      </NavLink>
      <NavLink to="/about" className={tone}>
        <InfoIcon />
        브랜드
      </NavLink>
      <button type="button" onClick={onCart} className={`${item} relative text-graphite`}>
        <BagIcon />
        장바구니
        {count > 0 && (
          <span className="absolute right-[calc(50%-18px)] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[9px] font-bold text-paper">
            {count}
          </span>
        )}
      </button>
    </nav>
  );
}

const iconProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

function SearchIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 8h14l-1 12H6L5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 11l8-7 8 7v9H4z" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}
function AgainIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v5h-5" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}
