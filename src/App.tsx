import { Suspense, lazy } from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Loading } from '@/components/Loading';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const Home = lazy(() => import('@/pages/Home'));
const ProductCollection = lazy(() => import('@/pages/ProductCollection'));
const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const About = lazy(() => import('@/pages/About'));
const Materials = lazy(() => import('@/pages/Materials'));
const Story = lazy(() => import('@/pages/Story'));
const ARLanding = lazy(() => import('@/pages/ARLanding'));
const ARExperiencePage = lazy(() => import('@/pages/ARExperiencePage'));
const Exhibition = lazy(() => import('@/pages/Exhibition'));
const AssetWorkspace = lazy(() => import('@/pages/workspace/AssetWorkspace'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function SiteLayout() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <a href="#main" className="skip-link">본문으로 건너뛰기</a>
      <Nav />
      <main id="main" style={{ paddingTop: 'var(--nav-height)' }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading label="LAGI" />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<ProductCollection />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/story" element={<Story />} />
            <Route path="/ar" element={<ARLanding />} />
            <Route path="/workspace" element={<AssetWorkspace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/ar/:id" element={<ARExperiencePage />} />
          <Route path="/exhibition" element={<Exhibition />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
