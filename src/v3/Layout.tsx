import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LagiLogo } from '@/components/LagiLogo';
import { useCart } from '@/commerce/CartContext';
import { useAuth } from '@/auth/AuthContext';
import { OFFICIAL_LINKS } from './data';
import './tokens.css';

export const NAV = [
  { to: '/discover', label: 'Discover', kr: '제품' },
  { to: '/why', label: 'Why LAGI', kr: '선정 기준' },
  { to: '/about', label: 'About', kr: '브랜드' },
  { to: '/again', label: 'Again', kr: 'AI 이미지 합성' },
] as const;

/**
 * Site frame: a white content sheet over a fixed black footer that is revealed as the sheet
 * scrolls away (the sheet's bottom corners round off). The home page is one screen with no
 * footer, like the reference.
 */
export function V3Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const footerRef = useRef<HTMLElement>(null);
  const [footerH, setFooterH] = useState(0);

  useLayoutEffect(() => {
    if (isHome) return;
    const el = footerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFooterH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isHome]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="v3 min-h-screen">
      <a href="#main" className="skip-link">
        본문으로 건너뛰기
      </a>
      <Header />
      <main id="main" className={isHome ? 'relative z-[2] h-[100svh] overflow-hidden bg-[var(--c-gray)]' : 'sheet'}>
        <div key={pathname} className={isHome ? 'h-full' : 'enter'}>
          <Outlet />
        </div>
      </main>
      {!isHome && (
        <>
          <div aria-hidden="true" style={{ height: footerH }} />
          <Footer ref={footerRef} />
        </>
      )}
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { count } = useCart();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
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

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-30 flex h-14 items-center lg:h-16 justify-between px-page transition-colors duration-300 ${
          scrolled ? 'bg-[rgba(255,255,255,0.94)]' : ''
        }`}
      >
        <Link to="/" aria-label="LAGI home" className="-m-1.5 flex items-center p-1.5">
          <LagiLogo className="h-9 w-auto text-[var(--c-blue)] lg:h-11" title="LAGI" />
        </Link>
        <nav aria-label="Main" className="t-nav absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className="tag t-mark"
              aria-current={pathname.startsWith(n.to) ? 'page' : undefined}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="t-nav flex items-center gap-1">
          <Link to={user ? '/account' : '/login'} className="tag kr hidden lg:inline-block">
            {user ? user.name : '로그인'}
          </Link>
          <Link to="/cart" className="tag kr" aria-label={`장바구니, ${count}개`}>
            장바구니 <span className="tabular-nums">{count}</span>
          </Link>
          <button type="button" className="tag kr lg:hidden" aria-expanded={open} aria-controls="v3-menu" onClick={() => setOpen(true)}>
            메뉴
          </button>
        </div>
      </header>

      {open && (
        <div id="v3-menu" role="dialog" aria-modal="true" aria-label="메뉴" className="fixed inset-0 z-40 flex flex-col bg-[var(--c-white)] px-page pb-8">
          <div className="flex h-14 items-center justify-between">
            <LagiLogo className="h-9 w-auto text-[var(--c-blue)]" title="LAGI" />
            <button type="button" onClick={() => setOpen(false)} className="t-nav tag kr" aria-label="메뉴 닫기">
              닫기
            </button>
          </div>
          <nav className="mt-10 flex flex-col items-start gap-4" aria-label="모바일 메뉴">
            {[{ to: '/', label: 'Home', kr: '홈' }, ...NAV].map((n) => (
              <Link key={n.to} to={n.to} className="flex items-baseline gap-3">
                <span className="t-h2 t-mark bg-[var(--c-label)] px-2 pb-0.5 pt-1.5">{n.label}</span>
                <span className="t-caption kr text-[var(--c-mute)]">{n.kr}</span>
              </Link>
            ))}
          </nav>
          <div className="t-caption kr mt-auto flex gap-6 border-t border-[var(--c-ink)] pt-5">
            <Link to={user ? '/account' : '/login'}>{user ? user.name : '로그인'}</Link>
            <Link to="/cart">장바구니 {count}</Link>
            <a href={OFFICIAL_LINKS.store} target="_blank" rel="noopener noreferrer">
              스마트스토어
            </a>
          </div>
        </div>
      )}
    </>
  );
}

const Footer = forwardRef<HTMLElement>(function Footer(_, ref) {
  return (
    <footer ref={ref} className="fixed inset-x-0 bottom-0 z-[1] overflow-hidden bg-[var(--c-ink)] px-page text-[var(--c-white)]">
      <div className="relative flex min-h-[70svh] flex-col justify-between pb-8 pt-28 lg:min-h-[82svh] lg:pt-36">
        <div className="text-center">
          <p className="t-h1 t-mark">LAGI in AGAIN</p>
          <p className="t-caption kr mt-3 text-white/80">디자인과 완성도, 소재의 새로운 가능성을 발견하고 소개합니다.</p>
        </div>
        {/* Phones: the emblem sits below the links (in flow); wider screens: large and behind, cropped by the edge. */}
        <span aria-hidden="true" className="pointer-events-none order-last -mb-16 mt-10 block h-48 self-center md:absolute md:bottom-[-14%] md:left-1/2 md:mb-0 md:mt-0 md:h-[42%] md:-translate-x-1/2 lg:h-[58%]">
          <LagiLogo className="h-full w-auto text-[var(--c-white)]" title="" />
        </span>
        <div className="t-caption kr relative mt-14 flex items-end justify-between gap-8 md:mt-0">
          <div>
            <p className="t-label t-mark mb-2 text-white/80">Official</p>
            <a href={OFFICIAL_LINKS.store} target="_blank" rel="noopener noreferrer" className="tap block opacity-80 hover:opacity-100 sm:py-0.5">
              네이버 스마트스토어
            </a>
            <a href={OFFICIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="tap block opacity-80 hover:opacity-100 sm:py-0.5">
              인스타그램
            </a>
            <p className="mt-4 text-white/80">© LAGI</p>
          </div>
          <div className="text-right">
            <p className="t-label t-mark mb-2 text-white/80">Menu</p>
            {[{ to: '/', kr: '홈' }, ...NAV, { to: '/cart', kr: '장바구니' }].map((n) => (
              <Link key={n.to} to={n.to} className="tap block opacity-80 hover:opacity-100 sm:py-0.5">
                {n.kr}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
});
