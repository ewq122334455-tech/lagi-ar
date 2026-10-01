import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProduct } from '@/hooks/useProducts';
import { Loading } from '@/components/Loading';
import { ARExperience } from '@/ar/ARExperience';

function checkSupport(): { webgl: boolean; camera: boolean } {
  let webgl = true;
  try {
    const canvas = document.createElement('canvas');
    webgl = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    webgl = false;
  }
  const camera = !!navigator.mediaDevices?.getUserMedia;
  return { webgl, camera };
}

export default function ARExperiencePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useProduct(id);
  const [support] = useState(checkSupport);

  useEffect(() => {
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overscrollBehavior = '';
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-ink text-paper">
        <Loading label="제품 정보를 불러오는 중" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <FullscreenMessage
        eyebrow="오류"
        title="제품을 찾을 수 없습니다"
        message={state.message}
        onExit={() => navigate('/products')}
      />
    );
  }

  const product = state.data;

  if (!support.webgl) {
    return (
      <FullscreenMessage
        eyebrow="AR IS NOT SUPPORTED ON THIS DEVICE"
        title="이 브라우저는 AR을 지원하지 않습니다"
        message="최신 iPhone Safari 또는 Android Chrome에서 다시 시도해 주세요. 3D로는 계속 살펴보실 수 있습니다."
        onExit={() => navigate(`/product/${product.id}`)}
        exitLabel="VIEW IN 3D"
      />
    );
  }

  if (!support.camera) {
    return (
      <FullscreenMessage
        eyebrow="AR IS NOT SUPPORTED ON THIS DEVICE"
        title="카메라를 사용할 수 없습니다"
        message="이 기기 또는 브라우저는 카메라 접근을 지원하지 않습니다. 3D로는 계속 살펴보실 수 있습니다."
        onExit={() => navigate(`/product/${product.id}`)}
        exitLabel="VIEW IN 3D"
      />
    );
  }

  // A 3D model is the one hard requirement. An image target is optional: without it the
  // experience runs markerless, placing the product by hand instead of tracking a picture.
  if (!product.model3D) {
    return (
      <FullscreenMessage
        eyebrow="AR — 준비 중"
        title="이 제품은 아직 AR로 준비되지 않았습니다"
        message="3D 모델이 등록되면 AR로 볼 수 있습니다."
        onExit={() => navigate(`/product/${product.id}`)}
        exitLabel="제품 페이지로"
      />
    );
  }

  return <ARExperience product={product} onExit={() => navigate(`/product/${product.id}`)} />;
}

function FullscreenMessage({
  eyebrow,
  title,
  message,
  onExit,
  exitLabel = '돌아가기',
}: {
  eyebrow: string;
  title: string;
  message: string;
  onExit: () => void;
  exitLabel?: string;
}) {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-ink px-8 text-center text-paper">
      <p className="eyebrow text-mist">{eyebrow}</p>
      <h1 className="text-2xl font-medium">{title}</h1>
      <p className="max-w-sm text-sm text-mist/80">{message}</p>
      <button
        type="button"
        onClick={onExit}
        className="eyebrow mt-4 border border-paper px-7 py-4 hover:bg-paper hover:text-ink focus-ring"
      >
        {exitLabel}
      </button>
    </div>
  );
}
