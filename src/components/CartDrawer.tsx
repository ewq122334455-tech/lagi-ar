import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '@/commerce/CartContext';
import { formatKRW, lineKey } from '@/commerce/cartTypes';

/** Slide-over cart, opened from the nav or after adding an item. */
export function CartDrawer() {
  const { lines, isOpen, close, setQuantity, remove, subtotal, count } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="장바구니 닫기"
        onClick={close}
        className="absolute inset-0 bg-ink/40"
      />
      <aside
        role="dialog"
        aria-label="장바구니"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-paper shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-heading text-lg font-extrabold">
            장바구니 <span className="text-stone">{count}</span>
          </h2>
          <button
            type="button"
            onClick={close}
            className="rounded-full border border-line px-4 py-2 text-sm font-bold focus-ring hover:bg-mist"
          >
            닫기
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-sm text-graphite">장바구니가 비어 있습니다.</p>
            <Link
              to="/products"
              onClick={close}
              className="rounded-full bg-ink px-6 py-3 font-heading text-sm font-extrabold text-paper focus-ring"
            >
              제품 보러 가기
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto">
              {lines.map((line) => {
                const key = lineKey(line);
                return (
                  <li key={key} className="flex gap-4 px-6 py-5">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-mist">
                      {line.image ? (
                        <img src={line.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-display text-sm text-stone">
                          LAGI
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/product/${line.productId}`}
                        onClick={close}
                        className="block truncate font-heading text-sm font-extrabold hover:text-blue"
                      >
                        {line.name ?? '이름 미등록 제품'}
                      </Link>
                      {(line.size || line.color) && (
                        <p className="mt-1 text-xs text-stone">
                          {[line.color, line.size].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="mt-1 text-sm">
                        {line.unitPrice === null ? (
                          <span className="text-stone">가격 미등록</span>
                        ) : (
                          formatKRW(line.unitPrice)
                        )}
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex items-center rounded-full border border-line">
                          <button
                            type="button"
                            aria-label="수량 줄이기"
                            onClick={() => setQuantity(key, line.quantity - 1)}
                            className="px-3 py-1 text-sm focus-ring"
                          >
                            −
                          </button>
                          <span className="min-w-8 text-center text-sm">{line.quantity}</span>
                          <button
                            type="button"
                            aria-label="수량 늘리기"
                            onClick={() => setQuantity(key, line.quantity + 1)}
                            className="px-3 py-1 text-sm focus-ring"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(key)}
                          className="text-xs text-stone underline underline-offset-4 focus-ring hover:text-ink"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <footer className="border-t border-line px-6 py-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-graphite">주문금액</span>
                <span className="font-heading text-lg font-extrabold">
                  {formatKRW(subtotal.amount)}
                </span>
              </div>
              {!subtotal.complete && (
                <p className="mt-2 text-xs text-stone">
                  가격이 등록되지 않은 제품이 있어 합계에 포함되지 않았습니다.
                </p>
              )}
              <Link
                to="/checkout"
                onClick={close}
                className="mt-4 block rounded-full bg-ink px-6 py-4 text-center font-heading text-sm font-extrabold text-paper focus-ring"
              >
                주문하기
              </Link>
              <Link
                to="/cart"
                onClick={close}
                className="mt-2 block py-2 text-center text-sm text-graphite underline underline-offset-4 focus-ring"
              >
                장바구니 전체보기
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
