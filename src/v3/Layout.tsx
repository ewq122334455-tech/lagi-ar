import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LagiLogo } from '@/components/LagiLogo';
import { useCart } from '@/commerce/CartContext';
import { useAuth } from '@/auth/AuthContext';
import { OFFICIAL_LINKS } from './data';
import './tokens.css';

export const NAV = [
  { to: '/discover', label: 'Discover' },
  { to: '/why', label: 'Why LAGI' },
  { to: '/about', label: 'About' },
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
        Skip to content
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
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between px-page">
        <Link to="/" aria-label="LAGI home" className="flex items-center">
          <LagiLogo className="h-11 w-auto text-[var(--c-blue)]" title="LAGI" />
        </Link>
        <nav aria-label="Main" className="t-nav absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="tag" aria-current={pathname.startsWith(n.to) ? 'page' : undefined}>
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/contact" className="tag tag-ink">
            Contact
          </NavLink>
        </nav>
        <div className="t-nav flex items-center gap-1">
          <Link to={user ? '/account' : '/login'} className="tag hidden lg:inline-block">
            {user ? user.name : 'Log in'}
          </Link>
          <Link to="/cart" className="tag" aria-label={`Cart, ${count} items`}>
            Cart <span className="tabular-nums">{count}</span>
          </Link>
          <button type="button" className="tag lg:hidden" aria-expanded={open} aria-controls="v3-menu" onClick={() => setOpen(true)}>
            Menu
          </button>
        </div>
      </header>

      {open && (
        <div id="v3-menu" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-40 flex flex-col bg-[var(--c-white)] px-page pb-8">
          <div className="flex h-16 items-center justify-between">
            <LagiLogo className="h-11 w-auto text-[var(--c-blue)]" title="LAGI" />
            <button type="button" onClick={() => setOpen(false)} className="t-nav tag" aria-label="Close menu">
              Close
            </button>
          </div>
          <nav className="mt-10 flex flex-col items-start gap-3" aria-label="Mobile">
            {[{ to: '/', label: 'Home' }, ...NAV].map((n) => (
              <Link key={n.to} to={n.to} className="t-h3 bg-[var(--c-label)] px-2 pb-1 pt-1.5">
                {n.label}
              </Link>
            ))}
            <Link to="/contact" className="t-h3 bg-[var(--c-ink)] px-2 pb-1 pt-1.5 text-[var(--c-white)]">
              Contact
            </Link>
          </nav>
          <div className="t-label mt-auto flex gap-6 border-t border-[var(--c-ink)] pt-5">
            <Link to={user ? '/account' : '/login'}>{user ? user.name : 'Log in'}</Link>
            <Link to="/cart">Cart {count}</Link>
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
      <p className="t-h1 text-center">LAGI in AGAIN</p>
      {/* Official emblem in its one-colour reverse, large and cropped by the bottom edge. */}
      <span aria-hidden="true" className="pointer-events-none absolute bottom-[-14%] left-1/2 h-[42%] -translate-x-1/2 lg:h-[58%]">
        <LagiLogo className="h-full w-auto text-[var(--c-white)]" title="" />
      </span>
      <div className="t-label relative flex items-end justify-between gap-8">
        <div>
          <p className="t-nav mb-2">Contact</p>
          <a href={OFFICIAL_LINKS.store} target="_blank" rel="noopener noreferrer" className="block opacity-80 hover:opacity-100">
            Smart Store
          </a>
          <a href={OFFICIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="block opacity-80 hover:opacity-100">
            Instagram
          </a>
        </div>
        <div className="text-right">
          <p className="t-nav mb-2">Navigation</p>
          {[{ to: '/', label: 'Home' }, ...NAV, { to: '/contact', label: 'Contact' }].map((n) => (
            <Link key={n.to} to={n.to} className="block opacity-80 hover:opacity-100">
              {n.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  </footer>
  );
});
