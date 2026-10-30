import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LagiLogo } from '@/components/LagiLogo';
import { useCart } from '@/commerce/CartContext';
import { useAuth } from '@/auth/AuthContext';
import { CATEGORY_LABEL, OFFICIAL_LINKS, price, useRealProducts } from './data';
import './tokens.css';

export const NAV = [
  { to: '/discover', label: 'Shop', kr: '제품' },
  { to: '/why', label: 'Why LAGI', kr: '선정 기준' },
  { to: '/review', label: 'Review', kr: '구매평' },
  { to: '/about', label: 'About', kr: '브랜드' },
  { to: '/again', label: 'Again', kr: 'AI 피팅' },
] as const;

/**
 * Site frame. A two-row header (logo centred, menu row under it, utilities as icons) that folds to
 * one row on scroll; a white content sheet over a fixed black footer that is revealed as the sheet
 * scrolls away; a floating emblem button for help, store and back-to-top.
 */
export function V3Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const footerRef = useRef<HTMLElement>(null);
  const [footerH, setFooterH] = useState(0);
  const [searching, setSearching] = useState(false);

  useLayoutEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFooterH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    setSearching(false);
  }, [pathname]);

  return (
    <div className="v3 min-h-screen">
      <a href="#main" className="skip-link">
        본문으로 건너뛰기
      </a>
      <Header onSearch={() => setSearching(true)} />
      <main id="main" className="sheet">
        <div key={pathname} className={isHome ? '' : 'enter'}>
          <Outlet />
        </div>
      </main>
      <div aria-hidden="true" style={{ height: footerH }} />
      <Footer ref={footerRef} />
      <HelpButton />
      {searching && <SearchOverlay onClose={() => setSearching(false)} />}
    </div>
  );
}

const Icon = {
  search: (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6" />
    </svg>
  ),
  bag: (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M5 8h14l-1 13H6L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
};

function Header({ onSearch }: { onSearch: () => void }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { count } = useCart();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const utilities = (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onSearch} className="icon-btn" aria-label="검색">
        {Icon.search}
        <span className="t-nav t-mark hidden xl:inline">Search</span>
      </button>
      <Link to={user ? '/account' : '/login'} className="icon-btn hidden sm:inline-flex" aria-label={user ? `내 계정 (${user.name})` : '로그인'}>
        {Icon.user}
      </Link>
      <Link to="/cart" className="icon-btn" aria-label={`장바구니, ${count}개`}>
        {Icon.bag}
        <span className="t-nav tabular-nums">{count}</span>
      </Link>
    </div>
  );

  return (
    <>
      <header
        data-folded={scrolled || undefined}
        // Always on white (as in the reference), so the icons never sit on top of a photo.
        className="site-header fixed inset-x-0 top-0 z-30 bg-[rgba(255,255,255,0.96)] shadow-[0_1px_0_rgba(0,0,0,0.08)] backdrop-blur"
      >
        {/* Row 1 (wide screens): the logo, centred. Folds away on scroll. */}
        <div className="header-top hidden items-center justify-center px-page lg:flex">
          <Link to="/" aria-label="LAGI home" className="-m-1.5 p-1.5">
            <LagiLogo className="h-12 w-auto text-[var(--c-blue)]" title="LAGI" />
          </Link>
        </div>
        {/* Row 2: menu in the middle, utilities on the right (on phones: menu · logo · utilities). */}
        <div className="relative flex h-14 items-center justify-between px-page lg:h-12">
          <div className="flex min-w-[96px] items-center">
            <button type="button" className="icon-btn lg:hidden" aria-expanded={open} aria-controls="v3-menu" aria-label="메뉴 열기" onClick={() => setOpen(true)}>
              {Icon.menu}
            </button>
            <Link to="/" aria-label="LAGI home" className={`header-mini hidden lg:inline-flex`}>
              <LagiLogo className="h-8 w-auto text-[var(--c-blue)]" title="LAGI" />
            </Link>
          </div>
          <Link to="/" aria-label="LAGI home" className="absolute left-1/2 -translate-x-1/2 lg:hidden">
            <LagiLogo className="h-9 w-auto text-[var(--c-blue)]" title="LAGI" />
          </Link>
          <nav aria-label="Main" className="t-nav absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 lg:flex xl:gap-10">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className="nav-link t-mark" aria-current={pathname.startsWith(n.to) ? 'page' : undefined}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex min-w-[96px] justify-end">{utilities}</div>
        </div>
      </header>

      {open && (
        <div id="v3-menu" role="dialog" aria-modal="true" aria-label="메뉴" className="fixed inset-0 z-40 flex flex-col bg-[var(--c-white)] px-page pb-8">
          <div className="relative flex h-14 items-center justify-between">
            <button type="button" onClick={() => setOpen(false)} className="icon-btn" aria-label="메뉴 닫기">
              {Icon.close}
            </button>
            <LagiLogo className="absolute left-1/2 h-9 w-auto -translate-x-1/2 text-[var(--c-blue)]" title="LAGI" />
            <span className="w-10" />
          </div>
          <nav className="mt-10 flex flex-col items-start gap-5" aria-label="모바일 메뉴">
            {[{ to: '/', label: 'Home', kr: '홈' }, ...NAV].map((n) => (
              <Link key={n.to} to={n.to} className="flex items-baseline gap-3">
                <span className="t-h2 t-mark">{n.label}</span>
                <span className="t-caption kr text-[var(--c-mute)]">{n.kr}</span>
              </Link>
            ))}
          </nav>
          <div className="t-caption kr mt-auto flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--c-ink)] pt-5">
            <Link to={user ? '/account' : '/login'}>{user ? user.name : '로그인'}</Link>
            <Link to="/cart">장바구니 {count}</Link>
            <Link to="/order">주문 조회</Link>
            <a href={OFFICIAL_LINKS.store} target="_blank" rel="noopener noreferrer">
              스마트스토어 ↗
            </a>
          </div>
        </div>
      )}
    </>
  );
}

/** Product search over name, one-liner, category and brand line. */
function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { products } = useRealProducts();
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return products.filter((p) =>
      [p.name.value, p.shortDescription.value, p.category.value, CATEGORY_LABEL[p.category.value ?? ''], p.brandLabel]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(t)),
    );
  }, [q, products]);
  const suggestions = ['가방', '토트', '파우치', '업사이클링', '번호판'];

  return (
    <div role="dialog" aria-modal="true" aria-label="제품 검색" className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(255,255,255,0.98)] px-page pb-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex h-14 items-center justify-end lg:h-20">
          <button type="button" onClick={onClose} className="icon-btn" aria-label="검색 닫기">
            {Icon.close}
          </button>
        </div>
        <form
          className="mt-6 flex items-center gap-3 border-b-2 border-[var(--c-ink)] pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (results[0]) navigate(`/product/${results[0].id}`);
          }}
        >
          {Icon.search}
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="제품 이름이나 소재로 찾아보세요"
            aria-label="검색어"
            className="t-h1 kr w-full bg-transparent outline-none placeholder:text-[#b5b5b5]"
            data-testid="search-input"
          />
        </form>
        {!q && (
          <div className="mt-6 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => setQ(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {q && (
          <p className="t-caption kr mt-5 text-[var(--c-mute)]" aria-live="polite">
            {results.length ? `${results.length}개의 제품` : '찾는 제품이 없습니다. 다른 이름으로 검색해 보세요.'}
          </p>
        )}
        <ul className="mt-4 grid grid-cols-2 gap-x-[var(--gap)] gap-y-8 sm:grid-cols-3" data-testid="search-results">
          {results.map((p) => (
            <li key={p.id}>
              <Link to={`/product/${p.id}`} className="group block">
                <div className="aspect-square overflow-hidden rounded-[var(--radius-card)] bg-white">
                  <img src={p.drawings?.find((d) => d.group === 'view')?.src ?? p.images[0]} alt="" className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.04]" />
                </div>
                <p className="t-value kr mt-3">{p.name.value}</p>
                <p className="t-caption kr tabular-nums text-[var(--c-mute)]">{price(p.price.value)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Floating emblem: help (Instagram DM), the official store, order lookup and back to top. */
function HelpButton() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="fixed bottom-4 right-4 z-[35] flex flex-col items-end gap-2 md:bottom-6 md:right-6">
      {open && (
        <div className="t-caption kr w-52 overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.14)]" role="menu" aria-label="도움말">
          <a role="menuitem" href={OFFICIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="block px-4 py-3 hover:bg-[var(--c-gray)]">
            인스타그램으로 문의 ↗
          </a>
          <a role="menuitem" href={OFFICIAL_LINKS.store} target="_blank" rel="noopener noreferrer" className="block border-t border-black/5 px-4 py-3 hover:bg-[var(--c-gray)]">
            공식 스마트스토어 ↗
          </a>
          <Link role="menuitem" to="/order" className="block border-t border-black/5 px-4 py-3 hover:bg-[var(--c-gray)]">
            주문 조회
          </Link>
          <button role="menuitem" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="block w-full border-t border-black/5 px-4 py-3 text-left hover:bg-[var(--c-gray)]">
            맨 위로
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="도움말 열기"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_4px_18px_rgba(0,0,0,0.16)] transition-transform hover:scale-105 md:h-14 md:w-14"
        data-testid="help-button"
      >
        <LagiLogo className="h-7 w-auto text-[var(--c-blue)] md:h-8" title="" />
      </button>
    </div>
  );
}

const Footer = forwardRef<HTMLElement>(function Footer(_, ref) {
  return (
    <footer ref={ref} className="fixed inset-x-0 bottom-0 z-[1] overflow-hidden bg-[var(--c-ink)] px-page text-[var(--c-white)]">
      <div className="relative flex min-h-[64svh] flex-col justify-between pb-8 pt-24 lg:min-h-[72svh] lg:pt-32">
        <div className="text-center">
          <p className="t-h1 t-mark">LAGI in AGAIN</p>
          <p className="t-caption kr mt-3 text-white/80">디자인과 완성도, 소재의 새로운 가능성을 발견하고 소개합니다.</p>
        </div>
        {/* Phones: the emblem sits below the links (in flow); wider screens: large and behind, cropped by the edge. */}
        <span aria-hidden="true" className="pointer-events-none order-last -mb-16 mt-10 block h-40 self-center md:absolute md:bottom-[-16%] md:left-1/2 md:mb-0 md:mt-0 md:h-[40%] md:-translate-x-1/2 lg:h-[52%]">
          <LagiLogo className="h-full w-auto text-[var(--c-white)]" title="" />
        </span>
        <div className="relative mt-14 md:mt-0">
          <div className="t-caption kr flex flex-wrap items-end justify-between gap-8">
            <div>
              <p className="t-label t-mark mb-2 text-white/80">Official</p>
              <a href={OFFICIAL_LINKS.store} target="_blank" rel="noopener noreferrer" className="tap block opacity-80 hover:opacity-100 sm:py-0.5">
                네이버 스마트스토어
              </a>
              <a href={OFFICIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="tap block opacity-80 hover:opacity-100 sm:py-0.5">
                인스타그램
              </a>
            </div>
            <div className="text-right">
              <p className="t-label t-mark mb-2 text-white/80">Menu</p>
              {[{ to: '/', kr: '홈' }, ...NAV, { to: '/cart', kr: '장바구니' }, { to: '/order', kr: '주문 조회' }].map((n) => (
                <Link key={n.to} to={n.to} className="tap block opacity-80 hover:opacity-100 sm:py-0.5">
                  {n.kr}
                </Link>
              ))}
            </div>
          </div>
          <div className="t-caption kr mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/20 pt-4 text-white/70">
            <p className="t-mark font-bold text-white">© LAGI</p>
            <p className="flex gap-4">
              <Link to="/contact" className="hover:text-white">
                문의
              </Link>
              <a href={OFFICIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">
                Instagram
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
});
