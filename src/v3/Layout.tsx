import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LagiLogo } from '@/components/LagiLogo';
import { useCart } from '@/commerce/CartContext';
import { useAuth } from '@/auth/AuthContext';
import { CATEGORY_LABEL, OFFICIAL_LINKS, price, useRealProducts } from './data';
import './tokens.css';
import { responsive } from './img';
import { useRouteMeta } from './usePageMeta';
import { BUSINESS, PRIVACY_POLICY, TERMS } from '@/content/legal';
import { BrandFilmOverlay } from './BrandFilm';

export const NAV = [
  { to: '/discover', label: 'Shop', kr: '제품' },
  { to: '/why', label: 'Why LAGI', kr: '선정 기준' },
  { to: '/review', label: 'Review', kr: '구매평' },
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
  useRouteMeta(pathname);
  const [searching, setSearching] = useState(false);
  const [film, setFilm] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setSearching(false);
  }, [pathname]);

  return (
    <div className="v3 min-h-screen">
      <a href="#main" className="skip-link">
        본문으로 건너뛰기
      </a>
      <Header onSearch={() => setSearching(true)} onFilm={() => setFilm(true)} />
      <main id="main" className="sheet">
        <div key={pathname} className={isHome ? '' : 'enter'}>
          <Outlet />
        </div>
      </main>
      <LegalFooter />
      <HelpButton />
      {searching && <SearchOverlay onClose={() => setSearching(false)} />}
      {film && <BrandFilmOverlay onClose={() => setFilm(false)} />}
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
  play: (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5Z" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
};

function Header({ onSearch, onFilm }: { onSearch: () => void; onFilm: () => void }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { count } = useCart();
  const { user } = useAuth();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);
  // Menu as a proper dialog: focus moves in, Tab stays inside, Esc closes, focus returns to the button.
  const menuBtn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) menuBtn.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const el = menu.current;
    el?.querySelector<HTMLElement>('button, a[href]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>('button, a[href]')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const utilities = (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onFilm} className="icon-btn" aria-label="브랜드 필름 보기" data-testid="film-open">
        {Icon.play}
        <span className="t-nav t-mark hidden xl:inline">Film</span>
      </button>
      <button type="button" onClick={onSearch} className="icon-btn" aria-label="검색">
        {Icon.search}
        <span className="t-nav t-mark hidden xl:inline">Search</span>
      </button>
      <Link to={user ? '/account' : '/login'} className="icon-btn hidden sm:inline-flex" aria-label={user ? `내 계정 (${user.name})` : '로그인'}>
        {Icon.user}
      </Link>
      <Link to="/cart" className="icon-btn">
        {Icon.bag}
        <span className="sr-only">장바구니 </span>
        <span className="t-nav tabular-nums">{count}</span>
        <span className="sr-only">개</span>
      </Link>
    </div>
  );

  return (
    <>
      <header
        // Always on white, so the icons never sit on top of a photo. One row: menu left, logo centre, icons right.
        className="site-header fixed inset-x-0 top-0 z-30 bg-[rgba(255,255,255,0.96)] shadow-[0_1px_0_rgba(0,0,0,0.08)] backdrop-blur"
      >
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center px-page lg:h-[88px]">
          <div className="flex min-w-0 items-center">
            <button ref={menuBtn} type="button" className="icon-btn lg:hidden" aria-expanded={open} aria-controls="v3-menu" aria-label="메뉴 열기" onClick={() => setOpen(true)}>
              {Icon.menu}
            </button>
            <nav aria-label="Main" className="t-nav hidden items-center gap-6 lg:flex xl:gap-10">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className="nav-link t-mark" aria-current={pathname.startsWith(n.to) ? 'page' : undefined}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <Link to="/" aria-label="LAGI home" className="-m-1.5 p-1.5">
            <LagiLogo className="h-11 w-auto text-[var(--c-blue)] lg:h-14" title="LAGI" />
          </Link>
          <div className="flex min-w-0 justify-end">{utilities}</div>
        </div>
      </header>

      {open && (
        <div ref={menu} id="v3-menu" role="dialog" aria-modal="true" aria-label="메뉴" onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)} className="fixed inset-0 z-40 flex flex-col bg-[var(--c-white)] px-page pb-8">
          <div className="relative flex h-14 items-center justify-between">
            <button type="button" onClick={() => setOpen(false)} className="icon-btn" aria-label="메뉴 닫기">
              {Icon.close}
            </button>
            <LagiLogo className="absolute left-1/2 h-11 w-auto -translate-x-1/2 text-[var(--c-blue)]" title="LAGI" />
            <span className="w-10" />
          </div>
          <nav className="mt-10 flex flex-col items-start gap-5" aria-label="모바일 메뉴">
            {[{ to: '/', label: 'Home' }, ...NAV].map((n) => (
              <Link key={n.to} to={n.to} className="t-h2 t-mark">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="t-caption t-mark mt-auto flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--c-ink)] pt-5">
            <Link to={user ? '/account' : '/login'}>{user ? user.name : 'Log in'}</Link>
            <Link to="/cart">Cart {count}</Link>
            <Link to="/order">Order</Link>
            <a href={OFFICIAL_LINKS.store} target="_blank" rel="noopener noreferrer">
              Smart Store ↗
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
      [p.name.value, p.nameEn, p.shortDescription.value, p.category.value, CATEGORY_LABEL[p.category.value ?? ''], p.brandLabel]
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
                  <img {...responsive(p.drawings?.find((d) => d.group === 'view')?.src ?? p.images[0], '(max-width: 639px) 50vw, 33vw')} src={p.drawings?.find((d) => d.group === 'view')?.src ?? p.images[0]} alt="" className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.04]" />
                </div>
                <p className="t-caption t-mark pname mt-3">{p.nameEn ?? p.name.value}</p>
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
  // Phones: the button steps aside while the page is scrolling, so it never sits on what is being read.
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    let t = 0;
    const on = () => {
      if (window.innerWidth >= 768) return;
      setMoving(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setMoving(false), 700);
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      window.clearTimeout(t);
    };
  }, []);
  const away = moving && !open;
  return (
    // On a product page on phones, lifted above the buy bar (--buybar-h is 0 elsewhere).
    <div
      className={`fixed bottom-4 right-4 z-[35] flex flex-col items-end gap-2 transition-opacity duration-200 md:bottom-6 md:right-6 ${away ? 'pointer-events-none opacity-0' : ''}`}
      style={{ transform: 'translateY(calc(-1 * (var(--buybar-h, 0px) + var(--buybar-gap, 0px))))' }}
      data-testid="help-float"
    >
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
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_4px_18px_rgba(0,0,0,0.12)] transition-transform hover:scale-105"
        data-testid="help-button"
      >
        <LagiLogo className="h-6 w-auto text-[var(--c-blue)]" title="" />
      </button>
    </div>
  );
}

/**
 * Business details and legal links (전자상거래법 제10조 표시사항, 개인정보처리방침). Renders nothing until the
 * owner fills in src/content/legal.ts — no placeholder ever reaches the published site.
 */
function LegalFooter() {
  if (!BUSINESS && !PRIVACY_POLICY && !TERMS) return null;
  const b = BUSINESS;
  return (
    <div className="t-caption kr space-y-2 bg-white px-page pb-10 pt-6 text-center text-[var(--c-mute)]" data-testid="legal-footer">
      {(TERMS || PRIVACY_POLICY) && (
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          {TERMS && (
            <Link to="/terms" className="hit hover:text-[var(--c-ink)]">
              이용약관
            </Link>
          )}
          {PRIVACY_POLICY && (
            <Link to="/privacy" className="hit font-bold text-[var(--c-ink)]">
              개인정보처리방침
            </Link>
          )}
        </p>
      )}
      {b && (
        <p className="leading-relaxed">
          상호 {b.companyName} · 대표 {b.representative} · 사업자등록번호 {b.businessNumber}{' '}
          <a href={`https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${b.businessNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hit underline underline-offset-2 hover:text-[var(--c-ink)]">
            사업자정보 확인
          </a>
          <br />
          통신판매업 신고번호 {b.mailOrderNumber} · 주소 {b.address}
          <br />
          전화 {b.phone} · 이메일 {b.email} · 호스팅 제공 {b.hostingProvider}
        </p>
      )}
    </div>
  );
}

