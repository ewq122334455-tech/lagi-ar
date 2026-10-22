import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProduct } from '@/hooks/useProducts';
import { Loading } from '@/components/Loading';
import { TryOnExperience } from '@/tryon/TryOnExperience';

export default function TryOnPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useProduct(id);

  useEffect(() => {
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overscrollBehavior = '';
    };
  }, []);

  if (state.status === 'loading') return <Loading label="TRY-ON 준비 중" />;
  if (state.status === 'error') {
    return (
      <FullscreenMessage eyebrow="오류" title="제품을 찾을 수 없습니다" message={state.message} onExit={() => navigate('/products')} />
    );
  }

  const product = state.data;
  const exit = () => navigate(`/product/${product.id}`);

  // A missing try-on garment is not something the visitor can work around —
  // say so plainly rather than opening the camera onto nothing.
  if (!product.tryOn?.garmentImage) {
    return (
      <FullscreenMessage
        eyebrow="VIRTUAL TRY-ON — 준비 중"
        title="이 제품은 아직 가상 피팅을 지원하지 않습니다"
        message="의상 이미지가 등록되면 카메라로 직접 입어볼 수 있습니다."
        onExit={exit}
        exitLabel="제품 페이지로"
      />
    );
  }

  return <TryOnExperience product={product} settings={product.tryOn} onExit={exit} />;
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
      <button type="button" onClick={onExit} className="eyebrow mt-4 border border-paper px-7 py-4 hover:bg-paper hover:text-ink focus-ring">
        {exitLabel}
      </button>
    </div>
  );
}
