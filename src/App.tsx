import { Suspense, lazy } from 'react';
import { Routes, Route, Outlet, Navigate, useLocation, useParams } from 'react-router-dom';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Loading } from '@/components/Loading';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CartDrawer } from '@/components/CartDrawer';
import { CartProvider } from '@/commerce/CartContext';
import { AuthProvider } from '@/auth/AuthContext';

const AssetWorkspace = lazy(() => import('@/pages/workspace/AssetWorkspace'));

// Site (v3). The previous site's code is kept in src/pages but no longer routed (its copy used the old concept).
const V3Layout = lazy(() => import('@/v3/Layout').then((m) => ({ default: m.V3Layout })));
const V3Home = lazy(() => import('@/v3/pages/Home'));
const V3Discover = lazy(() => import('@/v3/pages/Discover'));
const V3Product = lazy(() => import('@/v3/pages/ProductPage'));
const V3Why = lazy(() => import('@/v3/pages/Why'));
const V3About = lazy(() => import('@/v3/pages/About'));
const V3Contact = lazy(() => import('@/v3/pages/Contact'));
const V3Cart = lazy(() => import('@/v3/pages/Commerce').then((m) => ({ default: m.CartPage })));
const V3Checkout = lazy(() => import('@/v3/pages/Commerce').then((m) => ({ default: m.CheckoutPage })));
const V3CheckoutSuccess = lazy(() => import('@/v3/pages/Commerce').then((m) => ({ default: m.CheckoutSuccessPage })));
const V3CheckoutFail = lazy(() => import('@/v3/pages/Commerce').then((m) => ({ default: m.CheckoutFailPage })));
const V3Again = lazy(() => import('@/v3/pages/Again'));
const V3Login = lazy(() => import('@/v3/pages/Auth').then((m) => ({ default: m.LoginPage })));
const V3Signup = lazy(() => import('@/v3/pages/Auth').then((m) => ({ default: m.SignupPage })));
const V3NotFound = lazy(() => import('@/v3/pages/NotFound'));
const V3Account = lazy(() => import('@/v3/pages/Auth').then((m) => ({ default: m.AccountPage })));
const V3Order = lazy(() => import('@/v3/pages/Auth').then((m) => ({ default: m.OrderLookupPage })));
const V3Review = lazy(() => import('@/v3/pages/ReviewPage'));

function SiteLayout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-paper text-ink">
      <a href="#main" className="skip-link">본문으로 건너뛰기</a>
      <Nav />
      <main id="main" style={{ paddingTop: 'var(--nav-height)' }}>
        {/* Each page fades in as it opens. */}
        <div key={pathname} className="animate-[lagi-fade_0.5s_ease-out_both]">
          <Outlet />
        </div>
      </main>
      <div className="bg-mist" style={{ paddingBottom: 'var(--tabbar-height)' }}>
        <Footer />
      </div>
      <CartDrawer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
      <CartProvider>
      <Suspense fallback={<Loading label="LAGI" />}>
        <Routes>
          <Route element={<V3Layout />}>
            <Route path="/" element={<V3Home />} />
            <Route path="/discover" element={<V3Discover />} />
            <Route path="/product/:id" element={<V3Product />} />
            <Route path="/why" element={<V3Why />} />
            <Route path="/about" element={<V3About />} />
            <Route path="/contact" element={<V3Contact />} />
            <Route path="/cart" element={<V3Cart />} />
            <Route path="/checkout" element={<V3Checkout />} />
            <Route path="/checkout/success" element={<V3CheckoutSuccess />} />
            <Route path="/checkout/fail" element={<V3CheckoutFail />} />
            <Route path="/again" element={<V3Again />} />
            <Route path="/ai-fit/:id" element={<TryOnRedirect />} />
            <Route path="/login" element={<V3Login />} />
            <Route path="/signup" element={<V3Signup />} />
            <Route path="/account" element={<V3Account />} />
            <Route path="/order" element={<V3Order />} />
            <Route path="/review" element={<V3Review />} />
            <Route path="*" element={<V3NotFound />} />
          </Route>
          {/* Old addresses that were shared before the rebuild. */}
          <Route path="/products" element={<Navigate to="/discover" replace />} />
          <Route path="/materials" element={<Navigate to="/about" replace />} />
          <Route path="/story" element={<Navigate to="/about" replace />} />
          <Route path="/v2" element={<Navigate to="/" replace />} />
          <Route path="/try-on/:id" element={<TryOnRedirect />} />

          {/* The previous site used the old "Look closer" concept — its addresses now lead home. */}
          <Route path="/classic/*" element={<Navigate to="/" replace />} />
          <Route element={<SiteLayout />}>
            <Route path="/workspace" element={<AssetWorkspace />} />
          </Route>
          <Route path="/exhibition" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

/** Old camera try-on links and QR codes now open the AI fitting. */
function TryOnRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/again?p=${id}`} replace />;
}
