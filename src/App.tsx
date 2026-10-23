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
const Again = lazy(() => import('@/pages/Again'));
const LoginPage = lazy(() => import('@/pages/AuthPages').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('@/pages/AuthPages').then((m) => ({ default: m.SignupPage })));
const AccountPage = lazy(() => import('@/pages/AuthPages').then((m) => ({ default: m.AccountPage })));
const RedesignHome = lazy(() => import('@/redesign/RedesignHome'));
const AiFitPage = lazy(() => import('@/pages/AiFitPage'));
const Exhibition = lazy(() => import('@/pages/Exhibition'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const AssetWorkspace = lazy(() => import('@/pages/workspace/AssetWorkspace'));
const NotFound = lazy(() => import('@/pages/NotFound'));

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
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<ProductCollection />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/about" element={<About />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/story" element={<Story />} />
            <Route path="/again" element={<Again />} />
            <Route path="/ai-fit/:id" element={<AiFitPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/workspace" element={<AssetWorkspace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/try-on/:id" element={<TryOnRedirect />} />
          <Route path="/exhibition" element={<Exhibition />} />
          <Route path="/v2" element={<RedesignHome />} />
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
