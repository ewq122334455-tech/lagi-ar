import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '@/commerce/CartContext';
import { formatKRW, lineKey } from '@/commerce/cartTypes';
import { OFFICIAL_LINKS } from '../data';

/** Cart — same cart state as before (localStorage, CartContext), new layout. */
export function CartPage() {
  const { lines, setQuantity, remove, subtotal, count } = useCart();
  return (
    <div className="px-page pb-32 pt-page">
      <h1 className="t-display">장바구니</h1>
      {lines.length === 0 ? (
        <div className="rule mt-16 pt-6">
          <p className="t-body">담긴 제품이 없어요.</p>
          <Link to="/discover" className="t-nav tag tag-ink mt-6">
            제품 보러 가기
          </Link>
        </div>
      ) : (
        <>
          <ul className="rule mt-16">
            {lines.map((l) => (
              <li key={lineKey(l)} className="grid grid-cols-[88px_1fr_auto] items-center gap-4 border-b border-[var(--c-ink)]/15 py-5 lg:grid-cols-[120px_1fr_auto_auto]">
                {l.image ? <img src={l.image} alt="" className="w-full rounded-[var(--radius-card)] object-cover" /> : <span />}
                <div>
                  <Link to={`/product/${l.productId}`} className="t-value hover:text-[var(--c-blue)]">
                    {l.name}
                  </Link>
                  <div className="t-label mt-2 inline-flex items-center gap-1">
                    <button type="button" className="tag" aria-label="수량 줄이기" onClick={() => setQuantity(lineKey(l), l.quantity - 1)}>
                      −
                    </button>
                    <span className="w-8 text-center tabular-nums">{l.quantity}</span>
                    <button type="button" className="tag" aria-label="수량 늘리기" onClick={() => setQuantity(lineKey(l), l.quantity + 1)}>
                      +
                    </button>
                  </div>
                </div>
                <p className="t-value tabular-nums">{l.unitPrice == null ? '' : formatKRW(l.unitPrice * l.quantity)}</p>
                <button type="button" className="t-label tag col-start-3 justify-self-end text-[var(--c-mute)] lg:col-start-auto" onClick={() => remove(lineKey(l))}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-6">
            <p className="t-h3">
              합계 <span className="tabular-nums">{formatKRW(subtotal.amount)}</span>
              <span className="t-label ml-3 text-[var(--c-mute)]">{count}개</span>
            </p>
            <Link to="/checkout" className="t-nav tag tag-ink px-5 py-3">
              주문하기
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/** Checkout — no on-site payment: hands the order over to the official Smart Store, as before. */
export function CheckoutPage() {
  const { lines, subtotal, count } = useCart();
  const [copied, setCopied] = useState(false);
  const orderText = useMemo(() => lines.map((l) => `· ${l.name ?? ''} × ${l.quantity}`).join('\n'), [lines]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(orderText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="px-page pb-32 pt-page">
      <h1 className="t-display">주문</h1>
      <div className="rule mt-16 grid grid-cols-1 gap-12 pt-6 md:grid-cols-2">
        <div>
          <p className="t-label text-[var(--c-mute)]">주문 내역 · {count}개</p>
          <pre className="t-body mt-3 whitespace-pre-wrap font-[inherit]">{orderText || '담긴 제품이 없어요.'}</pre>
          <p className="t-h3 mt-6 tabular-nums">{formatKRW(subtotal.amount)}</p>
        </div>
        <div>
          <p className="t-body">결제와 배송은 라기 공식 스마트스토어에서 진행됩니다. 주문 내역을 복사한 뒤 스토어에서 같은 구성으로 주문해 주세요.</p>
          <div className="t-nav mt-8 flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="tag bg-[var(--c-label)] px-4 py-3" disabled={!lines.length}>
              {copied ? '복사했어요' : '주문 내역 복사'}
            </button>
            <a href={OFFICIAL_LINKS.store} target="_blank" rel="noopener noreferrer" className="tag tag-ink px-4 py-3">
              스마트스토어에서 결제 ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
