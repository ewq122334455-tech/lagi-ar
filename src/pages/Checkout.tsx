import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '@/commerce/CartContext';
import { formatKRW, lineKey } from '@/commerce/cartTypes';

const SMART_STORE_URL = 'https://smartstore.naver.com/lagi_official';

/**
 * Checkout.
 *
 * This site is statically hosted and has no payment backend, so it does not pretend to take
 * card details. It assembles the order and hands off to LAGI's official Smart Store, which is
 * where payment, shipping and order history actually live. The handoff is stated plainly
 * rather than disguised as an on-site payment step.
 */
export default function Checkout() {
  const { lines, subtotal, count } = useCart();
  const [copied, setCopied] = useState(false);

  const orderText = useMemo(
    () =>
      lines
        .map((l) => {
          const options = [l.color, l.size].filter(Boolean).join(' / ');
          return `· ${l.name ?? '이름 미등록 제품'}${options ? ` (${options})` : ''} × ${l.quantity}`;
        })
        .join('\n'),
    [lines],
  );

  async function copyOrder() {
    try {
      await navigator.clipboard.writeText(orderText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center lg:px-10">
        <h1 className="font-display text-4xl">주문할 제품이 없습니다</h1>
        <Link
          to="/products"
          className="mt-8 inline-block rounded-full bg-ink px-8 py-4 font-heading text-sm font-extrabold text-paper focus-ring"
        >
          제품 보러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:px-10">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone">CHECKOUT</p>
      <h1 className="mt-3 font-display text-5xl leading-none lg:text-6xl">주문하기</h1>

      <section className="mt-12 border-y border-line py-6">
        <h2 className="font-heading text-lg font-extrabold">주문 내역</h2>
        <ul className="mt-5 space-y-4">
          {lines.map((line) => (
            <li key={lineKey(line)} className="flex items-baseline justify-between gap-4 text-sm">
              <span className="min-w-0">
                <span className="font-bold">{line.name ?? '이름 미등록 제품'}</span>
                {(line.color || line.size) && (
                  <span className="text-stone">
                    {' '}
                    {[line.color, line.size].filter(Boolean).join(' / ')}
                  </span>
                )}
                <span className="text-stone"> × {line.quantity}</span>
              </span>
              <span className="shrink-0">
                {line.unitPrice === null ? (
                  <span className="text-stone">가격 미등록</span>
                ) : (
                  formatKRW(line.unitPrice * line.quantity)
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex items-baseline justify-between border-t border-line pt-5">
          <span className="font-heading font-extrabold">합계 ({count}개)</span>
          <span className="font-heading text-xl font-extrabold">{formatKRW(subtotal.amount)}</span>
        </div>
        {!subtotal.complete && (
          <p className="mt-3 text-xs text-stone">
            가격이 등록되지 않은 제품은 합계에서 빠져 있습니다.
          </p>
        )}
      </section>

      <section className="mt-10 rounded-3xl border-2 border-ink p-7">
        <h2 className="font-heading text-lg font-extrabold">결제는 스마트스토어에서 진행됩니다</h2>
        <p className="mt-3 text-sm leading-relaxed text-graphite">
          이 사이트는 제품을 가까이 들여다보는 공간이고, 실제 결제·배송·주문조회는 LAGI 공식
          스마트스토어에서 처리됩니다. 아래 버튼으로 이동한 뒤 같은 구성으로 주문해 주세요.
        </p>

        <div className="mt-6 rounded-2xl bg-mist p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone">주문 메모</p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">{orderText}</pre>
          <button
            type="button"
            onClick={copyOrder}
            className="mt-4 rounded-full border-2 border-ink px-5 py-2 font-heading text-sm font-extrabold focus-ring hover:bg-ink hover:text-paper"
          >
            {copied ? '복사됨' : '주문 내역 복사'}
          </button>
        </div>

        <a
          href={SMART_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 block rounded-full bg-ink px-6 py-4 text-center font-heading text-sm font-extrabold text-paper focus-ring"
        >
          스마트스토어에서 결제하기 →
        </a>
        <Link
          to="/cart"
          className="mt-3 block py-2 text-center text-sm text-graphite underline underline-offset-4 focus-ring"
        >
          장바구니로 돌아가기
        </Link>
      </section>
    </div>
  );
}
