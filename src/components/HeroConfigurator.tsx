import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '@/data/productTypes';
import { useCart } from '@/commerce/CartContext';
import { canUseAR } from '@/utils/arAvailability';
import { ProductViewer } from '@/three/ProductViewer';
import { Button, ButtonLink } from '@/components/ui/Button';

function uniq(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}

/**
 * The hero's signature interactive card (DESIGN.md → "signature interactive card").
 *
 * Wise puts a currency converter here; LAGI puts the product itself — live 3D, the real
 * option list, and the three real next steps (cart, buy, AR) without leaving the home page.
 * Price is shown only when the brand has supplied one; otherwise it says so.
 */
export function HeroConfigurator({ product }: { product: Product }) {
  const { add } = useCart();
  const navigate = useNavigate();
  const variants = useMemo(() => product.variants ?? [], [product.variants]);

  const sizes = useMemo(() => uniq(variants.map((v) => v.size)), [variants]);
  const colors = useMemo(() => uniq(variants.map((v) => v.color)), [variants]);

  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0] : null);
  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0] : null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => {
    if (variants.length === 0) return null;
    return (
      variants.find(
        (v) => (sizes.length === 0 || v.size === size) && (colors.length === 0 || v.color === color),
      ) ?? null
    );
  }, [variants, sizes.length, colors.length, size, color]);

  const needsSelection =
    variants.length > 0 && ((sizes.length > 0 && !size) || (colors.length > 0 && !color));
  const soldOut = selected?.stock === 0;

  function line() {
    return {
      productId: product.id,
      variantId: selected?.id ?? null,
      size: selected?.size ?? null,
      color: selected?.color ?? null,
      quantity,
      unitPrice: product.price.value,
      name: product.name.value,
      image: product.images[0] ?? null,
    };
  }

  function guard(): boolean {
    if (needsSelection) {
      setError('옵션을 선택해 주세요.');
      return false;
    }
    if (soldOut) {
      setError('품절된 옵션입니다.');
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <div className="w-full rounded-card bg-paper p-5 lg:p-7">
      <div className="overflow-hidden rounded-lg bg-mist">
        {product.model3D || !product.images[0] ? (
          <ProductViewer
            className="aspect-square w-full"
            modelUrl={product.model3D}
            hotspots={[]}
            selectedHotspotId={null}
            onSelectHotspot={() => {}}
            showControls={false}
          />
        ) : (
          <img
            src={product.images[0]}
            alt={product.name.value ?? 'LAGI 제품'}
            className="aspect-square w-full object-cover"
          />
        )}
      </div>

      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{product.category.value ?? 'LAGI'}</p>
          <p className="mt-1 font-heading text-xl font-extrabold">
            {product.name.value ?? <span className="text-stone">이름 미등록</span>}
          </p>
        </div>
        <p className="shrink-0 text-right font-heading text-lg font-extrabold">
          {product.price.value != null ? (
            `${product.price.value.toLocaleString('ko-KR')}원`
          ) : (
            <span className="text-sm font-bold text-stone">가격 미등록</span>
          )}
        </p>
      </div>

      {colors.length > 0 && (
        <fieldset className="mt-5">
          <legend className="eyebrow mb-2">색상</legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-pressed={color === c}
                className={`rounded-input border px-4 py-2 font-heading text-sm font-extrabold focus-ring ${
                  color === c ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {sizes.length > 0 && (
        <fieldset className="mt-4">
          <legend className="eyebrow mb-2">사이즈</legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                aria-pressed={size === s}
                className={`rounded-input border px-4 py-2 font-heading text-sm font-extrabold focus-ring ${
                  size === s ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-4 flex items-center gap-3">
        <span className="eyebrow">수량</span>
        <div className="flex items-center rounded-input border border-line">
          <button
            type="button"
            aria-label="수량 줄이기"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-4 py-2 focus-ring"
          >
            −
          </button>
          <span className="min-w-8 text-center font-heading font-extrabold">{quantity}</span>
          <button
            type="button"
            aria-label="수량 늘리기"
            onClick={() => setQuantity((q) => q + 1)}
            className="px-4 py-2 focus-ring"
          >
            +
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-clay">{error}</p>}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button
          variant="primary"
          disabled={soldOut}
          onClick={() => {
            if (!guard()) return;
            add(line());
            navigate('/checkout');
          }}
        >
          {soldOut ? '품절' : '바로 구매'}
        </Button>
        <Button
          variant="tertiary"
          disabled={soldOut}
          onClick={() => {
            if (!guard()) return;
            add(line());
          }}
        >
          장바구니
        </Button>
      </div>

      {canUseAR(product) && (
        <ButtonLink to={`/ar/${product.id}`} variant="secondary" className="mt-2 w-full">
          내 공간에서 AR로 보기
        </ButtonLink>
      )}

      {product.price.value === null && (
        <p className="mt-4 text-xs leading-relaxed text-stone">
          판매가가 아직 등록되지 않았습니다. 결제 단계에서 공식 스마트스토어의 실제 판매가를 확인해
          주세요.
        </p>
      )}
    </div>
  );
}
