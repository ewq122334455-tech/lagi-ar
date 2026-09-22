import { Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';
import { QRCodeImage } from '@/components/QRCode';

export default function ARLanding() {
  const state = useProducts();
  const arProducts = state.status === 'ready' ? state.data.filter((p) => p.arAvailable) : [];

  return (
    <div>
      <section className="border-b border-line bg-ink px-6 py-24 text-paper lg:px-10 lg:py-32">
        <div className="mx-auto max-w-canvas">
          <p className="eyebrow text-mist">WEB AR</p>
          <h1 className="mt-4 max-w-2xl font-display text-5xl leading-tight lg:text-6xl">
            카메라를 실물 LAGI 제품에 비추면
            <br />
            3D 제품이 그 자리에 나타납니다.
          </h1>
          <p className="mt-6 max-w-xl text-mist/80">
            AR은 모바일 카메라 기반 경험입니다. iPhone Safari와 Android Chrome에서 바로 열 수 있으며, 별도의 앱
            설치가 필요하지 않습니다.
          </p>
        </div>
      </section>

      <section className="px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-canvas">
          <p className="eyebrow">AR AVAILABLE PRODUCTS</p>

          <div className="mt-10">
            {state.status === 'loading' && <Loading label="불러오는 중" />}
            {state.status === 'error' && <ErrorState message={state.message} />}
            {state.status === 'ready' && arProducts.length === 0 && (
              <div className="border border-dashed border-line px-8 py-16 text-center">
                <p className="eyebrow text-stone">AR — CONTENT REQUIRED</p>
                <p className="mx-auto mt-3 max-w-md text-sm text-graphite">
                  아직 AR 타겟과 3D 모델이 등록된 제품이 없습니다. AR 아키텍처(카메라 권한 처리, 이미지 인식, GLB
                  렌더링, Spotlight)는 이미 구축되어 있으며, 제품 워크스페이스에서 타겟/모델을 등록하면 바로
                  활성화됩니다.
                </p>
                <Link
                  to="/workspace"
                  className="eyebrow mt-6 inline-block border border-ink px-6 py-3 hover:bg-ink hover:text-paper focus-ring"
                >
                  PRODUCT WORKSPACE →
                </Link>
              </div>
            )}
            {state.status === 'ready' && arProducts.length > 0 && (
              <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
                {arProducts.map((p) => {
                  const url = `${window.location.origin}${window.location.pathname}#/ar/${p.id}`;
                  return (
                    <div key={p.id} className="flex flex-col items-center gap-4 border border-line p-8 text-center">
                      <p className="font-medium">{p.name.value ?? p.id}</p>
                      <QRCodeImage value={url} size={140} />
                      <Link to={`/ar/${p.id}`} className="eyebrow border-b border-ink pb-0.5 hover:text-graphite focus-ring">
                        데스크톱에서 열기 →
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
