import { Link } from 'react-router-dom';
import { useCart } from '@/commerce/CartContext';
import { formatKRW, lineKey } from '@/commerce/cartTypes';

export default function Cart() {
  const { lines, setQuantity, remove, subtotal, count, clear } = useCart();

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone">CART</p>
      <h1 className="mt-3 font-display text-5xl leading-none lg:text-6xl">장바구니</h1>

      {lines.length === 0 ? (
        <div className="mt-16 border-t border-line py-20 text-center">
          <p className="text-graphite">장바구니가 비어 있습니다.</p>
          <Link
            to="/products"
            className="mt-6 inline-block rounded-full bg-ink px-8 py-4 font-heading text-sm font-extrabold text-paper focus-ring"
          >
            제품 보러 가기
          </Link>
        </div>
      ) : (
        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_20rem]">
          <ul className="divide-y divide-line border-y border-line">
            {lines.map((line) => {
              const key = lineKey(line);
              return (
                <li key={key} className="flex gap-5 py-6">
                  <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-mist">
                    {line.image ? (
                      <img src={line.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-display text-stone">
                        LAGI
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/product/${line.productId}`}
                      className="font-heading font-extrabold hover:text-blue"
                    >
                      {line.name ?? '이름 미등록 제품'}
                    </Link>
                    {(line.size || line.color) && (
                      <p className="mt-1 text-sm text-stone">
                        {[line.color, line.size].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="mt-2">
                      {line.unitPrice === null ? (
                        <span className="text-sm text-stone">가격 미등록</span>
                      ) : (
                        formatKRW(line.unitPrice)
                      )}
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                      <div className="flex items-center rounded-full border border-line">
                        <button
                          type="button"
                          aria-label="수량 줄이기"
                          onClick={() => setQuantity(key, line.quantity - 1)}
                          className="px-4 py-1.5 focus-ring"
                        >
                          −
                        </button>
                        <span className="min-w-8 text-center text-sm">{line.quantity}</span>
                        <button
                          type="button"
                          aria-label="수량 늘리기"
                          onClick={() => setQuantity(key, line.quantity + 1)}
                          className="px-4 py-1.5 focus-ring"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(key)}
                        className="text-sm text-stone underline underline-offset-4 focus-ring hover:text-ink"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="h-fit rounded-3xl border-2 border-ink p-7">
            <h2 className="font-heading text-lg font-extrabold">주문 요약</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-graphite">상품 수</dt>
                <dd>{count}개</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-graphite">주문금액</dt>
                <dd className="font-heading font-extrabold">{formatKRW(subtotal.amount)}</dd>
              </div>
            </dl>
            {!subtotal.complete && (
              <p className="mt-4 rounded-xl bg-mist p-3 text-xs leading-relaxed text-graphite">
                가격이 등록되지 않은 제품이 있어 합계에 포함되지 않았습니다. 결제 단계에서
                스마트스토어의 실제 판매가를 확인해 주세요.
              </p>
            )}
            <Link
              to="/checkout"
              className="mt-6 block rounded-full bg-ink px-6 py-4 text-center font-heading text-sm font-extrabold text-paper focus-ring"
            >
              주문하기
            </Link>
            <button
              type="button"
              onClick={clear}
              className="mt-3 w-full py-2 text-center text-sm text-stone underline underline-offset-4 focus-ring hover:text-ink"
            >
              장바구니 비우기
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
