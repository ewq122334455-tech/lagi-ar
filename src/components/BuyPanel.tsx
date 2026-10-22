import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Product } from '@/data/productTypes';
import { useCart } from '@/commerce/CartContext';
import { canUseTryOn } from '@/utils/tryOnAvailability';
import { aiTryOnEnabled } from '@/tryon/aiTryOn';

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
    <div className="mt-6">
      {colors.length > 0 && (
        <fieldset className="mb-6">
          <legend className="mb-2 text-[13px] text-stone">
            색상
          </legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-pressed={color === c}
                className={`rounded-md border px-4 py-2 text-sm font-semibold focus-ring ${
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
          <legend className="mb-2 text-[13px] text-stone">
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
                  className={`rounded-md border px-4 py-2 text-sm font-semibold focus-ring ${
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
        <p className="mb-2 text-[13px] text-stone">수량</p>
        <div className="flex w-fit items-center rounded-md border border-line">
          <button
            type="button"
            aria-label="수량 줄이기"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-5 py-2 focus-ring"
          >
            −
          </button>
          <span className="min-w-10 text-center font-heading font-semibold">{quantity}</span>
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

      <div className="flex flex-col gap-2">
        {aiTryOnEnabled(product) && (
          <Link
            to={`/ai-fit/${product.id}`}
            className="flex h-12 items-center justify-center gap-2 rounded-md bg-ink text-sm font-bold text-paper hover:bg-[#2a2a2a] focus-ring"
          >
            ✦ AI로 입어보기 <span className="text-xs font-medium text-paper/60">내 사진으로</span>
          </Link>
        )}
        {canUseTryOn(product) && (
          <Link
            to={`/try-on/${product.id}`}
            className="flex h-12 items-center justify-center gap-2 rounded-md bg-lime text-sm font-bold text-ink hover:brightness-95 focus-ring"
          >
            카메라로 메어보기
          </Link>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={addToCart}
            disabled={soldOut}
            className="h-12 rounded-md border border-ink text-sm font-bold hover:bg-mist focus-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            장바구니
          </button>
          <button
            type="button"
            onClick={buyNow}
            disabled={soldOut}
            className="h-12 rounded-md bg-blue text-sm font-bold text-paper hover:bg-[#244789] focus-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            {soldOut ? '품절' : '구매하기'}
          </button>
        </div>
      </div>

    </div>
  );
}
