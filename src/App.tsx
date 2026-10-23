import { Suspense, lazy } from 'react';
import { Routes, Route, Outlet, Navigate, useLocation, useParams } from 'react-router-dom';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Loading } from '@/components/Loading';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CartDrawer } from '@/components/CartDrawer';
import { CartProvider } from '@/commerce/CartContext';
import { AuthProvider } from '@/auth/AuthContext';

const Home = lazy(() => import('@/pages/Home'));
const ProductCollection = lazy(() => import('@/pages/ProductCollection'));
const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const About = lazy(() => import('@/pages/About'));
const Materials = lazy(() => import('@/pages/Materials'));
const Story = lazy(() => import('@/pages/Story'));
const LoginPage = lazy(() => import('@/pages/AuthPages').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('@/pages/AuthPages').then((m) => ({ default: m.SignupPage })));
const AccountPage = lazy(() => import('@/pages/AuthPages').then((m) => ({ default: m.AccountPage })));
const RedesignHome = lazy(() => import('@/redesign/RedesignHome'));
const AiFitPage = lazy(() => import('@/pages/AiFitPage'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const AssetWorkspace = lazy(() => import('@/pages/workspace/AssetWorkspace'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// New site (v3). The previous site is kept intact under /classic.
const V3Layout = lazy(() => import('@/v3/Layout').then((m) => ({ default: m.V3Layout })));
const V3Home = lazy(() => import('@/v3/pages/Home'));
const V3Discover = lazy(() => import('@/v3/pages/Discover'));
const V3Product = lazy(() => import('@/v3/pages/ProductPage'));
const V3Why = lazy(() => import('@/v3/pages/Why'));
const V3About = lazy(() => import('@/v3/pages/About'));
const V3Contact = lazy(() => import('@/v3/pages/Contact'));
const V3Cart = lazy(() => import('@/v3/pages/Commerce').then((m) => ({ default: m.CartPage })));
const V3Checkout = lazy(() => import('@/v3/pages/Commerce').then((m) => ({ default: m.CheckoutPage })));
const V3AiFit = lazy(() => import('@/v3/pages/AiFit'));
const V3Login = lazy(() => import('@/v3/pages/Auth').then((m) => ({ default: m.LoginPage })));
const V3Signup = lazy(() => import('@/v3/pages/Auth').then((m) => ({ default: m.SignupPage })));
const V3Account = lazy(() => import('@/v3/pages/Auth').then((m) => ({ default: m.AccountPage })));

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
            <Route path="/ai-fit/:id" element={<V3AiFit />} />
            <Route path="/login" element={<V3Login />} />
            <Route path="/signup" element={<V3Signup />} />
            <Route path="/account" element={<V3Account />} />
          </Route>
          {/* Old addresses that were shared before the rebuild. */}
          <Route path="/products" element={<Navigate to="/discover" replace />} />
          <Route path="/materials" element={<Navigate to="/about" replace />} />
          <Route path="/story" element={<Navigate to="/about" replace />} />
          <Route path="/again" element={<Navigate to="/" replace />} />
          <Route path="/v2" element={<Navigate to="/" replace />} />
          <Route path="/try-on/:id" element={<TryOnRedirect />} />

          {/* Previous site, preserved as it was. */}
          <Route path="/classic" element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="products" element={<ProductCollection />} />
            <Route path="product/:id" element={<ProductDetail />} />
            <Route path="about" element={<About />} />
            <Route path="materials" element={<Materials />} />
            <Route path="story" element={<Story />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="ai-fit/:id" element={<AiFitPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="v2" element={<RedesignHome />} />
          </Route>
          <Route element={<SiteLayout />}>
            <Route path="/workspace" element={<AssetWorkspace />} />
            <Route path="*" element={<NotFound />} />
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
  return <Navigate to={`/ai-fit/${id}`} replace />;
}
