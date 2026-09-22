import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';
import { ProductViewer } from '@/three/ProductViewer';

const AUTO_ADVANCE_MS = 14000;

export default function Exhibition() {
  const state = useProducts();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  const products = useMemo(() => (state.status === 'ready' ? state.data : []), [state]);
  const product = products[index % Math.max(products.length, 1)];

  useEffect(() => {
    if (products.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % products.length), AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [products.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') navigate('/');
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % Math.max(products.length, 1));
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + products.length) % Math.max(products.length, 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [products.length, navigate]);

  if (state.status === 'loading') {
    return (
      <div className="exhibition-mode flex h-[100dvh] items-center justify-center bg-ink text-paper">
        <Loading label="Exhibition 준비 중" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="exhibition-mode flex h-[100dvh] items-center justify-center bg-ink text-paper">
        <ErrorState message={state.message} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="exhibition-mode flex h-[100dvh] flex-col items-center justify-center gap-4 bg-ink text-paper">
        <p className="eyebrow">CONTENT REQUIRED</p>
        <p className="text-sm text-mist/80">전시할 게시된 제품이 없습니다.</p>
        <button type="button" onClick={() => navigate('/')} className="eyebrow border border-paper px-6 py-3 hover:bg-paper hover:text-ink focus-ring">
          홈으로
        </button>
      </div>
    );
  }

  const displayName = product.name.value ?? `Product ${product.id.replace('product-', '#')}`;

  return (
    <div className="exhibition-mode grid h-[100dvh] grid-cols-1 bg-ink text-paper lg:grid-cols-[1.1fr_0.9fr]">
      <div className="relative min-h-[45vh] bg-mist lg:min-h-full">
        <ProductViewer
          className="h-full w-full"
          modelUrl={product.model3D}
          hotspots={product.hotspots}
          selectedHotspotId={null}
          onSelectHotspot={() => {}}
        />
      </div>

      <div className="flex flex-col justify-center gap-8 px-12 py-16 xl:px-20">
        <p className="eyebrow text-mist">LAGI EXHIBITION</p>
        <h1 className="text-[4vw] font-medium leading-[1.02] lg:text-[3vw] 2xl:text-[2.4vw]">{displayName}</h1>
        {product.shortDescription.value && <p className="max-w-lg text-lg text-mist/80">{product.shortDescription.value}</p>}

        {product.hotspots.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {product.hotspots.map((h) => (
              <li key={h.id} className="eyebrow border border-paper/30 px-4 py-2 text-mist">
                {h.title}
              </li>
            ))}
          </ul>
        )}

        {products.length > 1 && (
          <div className="mt-4 flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + products.length) % products.length)}
              className="eyebrow border border-paper/40 px-4 py-2.5 hover:border-paper focus-ring"
            >
              ←
            </button>
            <p className="eyebrow text-mist">
              {String(index + 1).padStart(2, '0')} / {String(products.length).padStart(2, '0')}
            </p>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % products.length)}
              className="eyebrow border border-paper/40 px-4 py-2.5 hover:border-paper focus-ring"
            >
              →
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/')}
        className="eyebrow absolute right-6 top-6 border border-paper/40 bg-ink/60 px-4 py-2.5 backdrop-blur hover:border-paper focus-ring"
      >
        EXIT
      </button>
    </div>
  );
}
