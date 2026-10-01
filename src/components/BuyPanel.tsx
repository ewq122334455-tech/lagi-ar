import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Product } from '@/data/productTypes';
import { useCart } from '@/commerce/CartContext';
import { canUseAR } from '@/utils/arAvailability';

function uniq(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}

/** Size/colour selection, quantity and add-to-cart for one product. */
export function BuyPanel({ product }: { product: Product }) {
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

  function buildLine() {
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

  function addToCart() {
    if (needsSelection) {
      setError('옵션을 선택해 주세요.');
      return;
    }
    if (soldOut) {
      setError('품절된 옵션입니다.');
      return;
    }
    setError(null);
    add(buildLine());
  }

  function buyNow() {
    if (needsSelection) {
      setError('옵션을 선택해 주세요.');
      return;
    }
    if (soldOut) {
      setError('품절된 옵션입니다.');
      return;
    }
    setError(null);
    add(buildLine());
    navigate('/checkout');
  }

  return (
    <div className="mt-10">
      {colors.length > 0 && (
        <fieldset className="mb-6">
          <legend className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-stone">
            색상
          </legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-pressed={color === c}
                className={`rounded-full border-2 px-5 py-2 font-heading text-sm font-extrabold focus-ring ${
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
        <fieldset className="mb-6">
          <legend className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-stone">
            사이즈
          </legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const out = variants.some(
                (v) => v.size === s && (colors.length === 0 || v.color === color) && v.stock === 0,
              );
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                  className={`rounded-full border-2 px-5 py-2 font-heading text-sm font-extrabold focus-ring ${
                    size === s ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink'
                  } ${out ? 'text-stone line-through' : ''}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="mb-6">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-stone">수량</p>
        <div className="flex w-fit items-center rounded-full border-2 border-line">
          <button
            type="button"
            aria-label="수량 줄이기"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-5 py-2 focus-ring"
          >
            −
          </button>
          <span className="min-w-10 text-center font-heading font-extrabold">{quantity}</span>
          <button
            type="button"
            aria-label="수량 늘리기"
            onClick={() => setQuantity((q) => q + 1)}
            className="px-5 py-2 focus-ring"
          >
            +
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-orange">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={buyNow}
          disabled={soldOut}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 font-heading text-sm font-extrabold text-paper transition-transform hover:-translate-y-0.5 focus-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          {soldOut ? '품절' : '바로 구매'}
        </button>
        <button
          type="button"
          onClick={addToCart}
          disabled={soldOut}
          className="inline-flex items-center gap-2 rounded-full border-2 border-ink px-8 py-4 font-heading text-sm font-extrabold transition-transform hover:-translate-y-0.5 focus-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          장바구니
        </button>
        {canUseAR(product) && (
          <Link
            to={`/ar/${product.id}`}
            className="inline-flex items-center gap-2 rounded-full border-2 border-blue px-8 py-4 font-heading text-sm font-extrabold text-blue transition-transform hover:-translate-y-0.5 focus-ring"
          >
            AR로 보기
          </Link>
        )}
      </div>

      {product.price.value === null && (
        <p className="mt-4 text-xs leading-relaxed text-stone">
          판매가가 아직 등록되지 않았습니다. 결제 단계에서 공식 스마트스토어의 실제 판매가를
          확인해 주세요.
        </p>
      )}
    </div>
  );
}
