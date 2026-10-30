import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '@/commerce/CartContext';
import { lineKey } from '@/commerce/cartTypes';
import {
  type OrderInput,
  type OrderSummary,
  type TossWidgets,
  TOSS_CLIENT_KEY,
  confirmPayment,
  createOrder,
  loadPostcode,
  loadToss,
  paymentsEnabled,
  pendingOrder,
  rememberPending,
  routeUrl,
} from '@/commerce/payments';
import { OFFICIAL_LINKS, price } from '../data';

/** Cart — same cart state as before (localStorage, CartContext). */
export function CartPage() {
  const { lines, setQuantity, remove, subtotal, count } = useCart();
  return (
    <div className="px-page pb-32 pt-page">
      <p className="t-label t-mark text-[var(--c-mute)]">Cart</p>
      <h1 className="t-h1 kr mt-2 !font-bold">장바구니</h1>
      {lines.length === 0 ? (
        <div className="rule mt-12 pt-6">
          <p className="t-body kr">장바구니가 비어 있습니다.</p>
          <Link to="/discover" className="t-nav tag tag-ink kr mt-6 px-4 py-3">
            제품 보러 가기
          </Link>
        </div>
      ) : (
        <>
          <ul className="rule mt-12">
            {lines.map((l) => (
              <li key={lineKey(l)} className="grid grid-cols-[88px_1fr_auto] items-center gap-4 border-b border-[var(--c-ink)]/15 py-5 lg:grid-cols-[120px_1fr_auto_auto]">
                {l.image ? <img src={l.image} alt="" className="aspect-square w-full rounded-[var(--radius-card)] object-cover" /> : <span />}
                <div>
                  <Link to={`/product/${l.productId}`} className="t-value kr hover:text-[var(--c-blue)]">
                    {l.name}
                  </Link>
                  <div className="t-caption mt-2 inline-flex items-center gap-1">
                    <button type="button" className="h-9 w-9 rounded-full border border-black/15 hover:bg-[var(--c-label)]" aria-label="수량 줄이기" onClick={() => setQuantity(lineKey(l), l.quantity - 1)}>
                      −
                    </button>
                    <span className="w-8 text-center tabular-nums">{l.quantity}</span>
                    <button type="button" className="h-9 w-9 rounded-full border border-black/15 hover:bg-[var(--c-label)]" aria-label="수량 늘리기" onClick={() => setQuantity(lineKey(l), Math.min(20, l.quantity + 1))}>
                      +
                    </button>
                  </div>
                </div>
                <p className="t-value kr tabular-nums">{l.unitPrice == null ? '' : price(l.unitPrice * l.quantity)}</p>
                <button type="button" className="t-caption kr tag col-start-3 justify-self-end text-[var(--c-mute)] lg:col-start-auto" onClick={() => remove(lineKey(l))}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-6">
            <p className="t-h3 kr">
              상품 금액 <span className="tabular-nums">{price(subtotal.amount)}</span>
              <span className="t-caption ml-3 text-[var(--c-mute)]">{count}개</span>
            </p>
            <Link to="/checkout" className="t-nav tag tag-ink kr px-5 py-3.5">
              주문하기
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

const MEMOS = ['', '문 앞에 놓아 주세요', '경비실에 맡겨 주세요', '배송 전에 연락 주세요'];

const field = 't-body kr w-full rounded-[var(--radius-card)] border border-[var(--c-ink)]/25 bg-[var(--c-white)] px-3 py-2.5 focus:border-[var(--c-ink)] focus:outline-none';

/**
 * Checkout: orderer and delivery address (with Korean address search), then on-site payment.
 * The Worker prices the order from the published product data; the visitor pays that amount
 * through the Toss Payments widget and the success page confirms it on the server.
 */
export function CheckoutPage() {
  const { lines, subtotal, count } = useCart();
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [ship, setShip] = useState({ recipient: '', phone: '', zonecode: '', address: '', addressDetail: '', memo: '' });
  const [same, setSame] = useState(true);
  const [agree, setAgree] = useState(false);
  const [finder, setFinder] = useState(false);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const finderRef = useRef<HTMLDivElement>(null);
  const widgets = useRef<TossWidgets | null>(null);
  const enabled = paymentsEnabled();

  const recipient = same ? { recipient: customer.name, phone: customer.phone } : { recipient: ship.recipient, phone: ship.phone };
  const digits = (v: string) => v.replace(/[^0-9]/g, '');

  // Address search panel (Kakao postcode), embedded so it works the same on phones.
  useEffect(() => {
    if (!finder || !finderRef.current) return;
    let alive = true;
    loadPostcode()
      .then((Postcode) => {
        if (!alive || !finderRef.current) return;
        new Postcode({
          width: '100%',
          height: '100%',
          oncomplete: (d) => {
            setShip((s) => ({ ...s, zonecode: d.zonecode, address: (d.roadAddress || d.jibunAddress) + (d.buildingName ? ` (${d.buildingName})` : '') }));
            setFinder(false);
          },
        }).embed(finderRef.current);
      })
      .catch((e: Error) => {
        setError(e.message);
        setFinder(false);
        setManual(true);
      });
    return () => {
      alive = false;
    };
  }, [finder]);

  function problem(): string | null {
    if (!customer.name.trim()) return '주문자 이름을 입력해 주세요.';
    if (!/^01[0-9]{8,9}$/.test(digits(customer.phone))) return '주문자 휴대폰 번호를 확인해 주세요.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) return '이메일 주소를 확인해 주세요.';
    if (!recipient.recipient.trim()) return '받는 분 이름을 입력해 주세요.';
    if (!/^0[0-9]{8,10}$/.test(digits(recipient.phone))) return '받는 분 연락처를 확인해 주세요.';
    if (!/^[0-9]{5}$/.test(ship.zonecode) || !ship.address.trim()) return '주소 검색으로 우편번호와 주소를 입력해 주세요.';
    if (!ship.addressDetail.trim()) return '상세 주소를 입력해 주세요.';
    if (!agree) return '주문 내용 확인 및 결제 진행에 동의해 주세요.';
    return null;
  }

  async function toPayment() {
    const p = problem();
    if (p) return setError(p);
    setError(null);
    setBusy(true);
    try {
      const input: OrderInput = {
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        customer: { name: customer.name.trim(), phone: digits(customer.phone), email: customer.email.trim() },
        shipping: { ...ship, recipient: recipient.recipient.trim(), phone: digits(recipient.phone) },
        agree,
      };
      const created = await createOrder(input);
      const Toss = await loadToss();
      const w = Toss(TOSS_CLIENT_KEY).widgets({ customerKey: Toss.ANONYMOUS });
      await w.setAmount({ currency: 'KRW', value: created.amount });
      setOrder(created);
      widgets.current = w;
      // Containers render after `order` is set.
      await new Promise((r) => requestAnimationFrame(r));
      await Promise.all([w.renderPaymentMethods({ selector: '#toss-methods', variantKey: 'DEFAULT' }), w.renderAgreement({ selector: '#toss-agreement', variantKey: 'AGREEMENT' })]);
      setWidgetReady(true);
      rememberPending(created);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!order || !widgets.current) return;
    setBusy(true);
    setError(null);
    try {
      await widgets.current.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName,
        successUrl: routeUrl('/checkout/success'),
        failUrl: routeUrl('/checkout/fail'),
        customerEmail: customer.email.trim(),
        customerName: customer.name.trim(),
        customerMobilePhone: digits(customer.phone),
      });
    } catch (e) {
      // Closing the payment window is not an error worth shouting about.
      const msg = (e as { code?: string; message?: string }).code === 'USER_CANCEL' ? '결제를 취소했습니다.' : (e as Error).message;
      setError(msg || '결제를 진행하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  if (!lines.length && !order)
    return (
      <div className="px-page pb-32 pt-page">
        <h1 className="t-h1 kr !font-bold">주문서</h1>
        <p className="t-body kr rule mt-12 pt-6">장바구니가 비어 있습니다.</p>
        <Link to="/discover" className="t-nav tag tag-ink kr mt-6 px-4 py-3">
          제품 보러 가기
        </Link>
      </div>
    );

  const locked = !!order;

  return (
    <div className="px-page pb-32 pt-page">
      <p className="t-label t-mark text-[var(--c-mute)]">Checkout</p>
      <h1 className="t-h1 kr mt-2 !font-bold">주문서</h1>

      <div className="mt-12 grid grid-cols-1 gap-x-[var(--gap)] gap-y-12 lg:grid-cols-12">
        <form className="space-y-12 lg:col-span-7" onSubmit={(e) => e.preventDefault()} aria-label="주문 정보">
          <fieldset disabled={locked} className="rule">
            <legend className="t-h3 kr float-left w-full pt-4">주문자</legend>
            <div className="clear-both grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2">
              <label className="t-caption kr block">
                이름
                <input className={`${field} mt-1`} autoComplete="name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
              </label>
              <label className="t-caption kr block">
                휴대폰 번호
                <input className={`${field} mt-1`} inputMode="numeric" autoComplete="tel" placeholder="01012345678" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
              </label>
              <label className="t-caption kr block sm:col-span-2">
                이메일 <span className="text-[var(--c-mute)]">(결제 안내를 받습니다)</span>
                <input className={`${field} mt-1`} type="email" autoComplete="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
              </label>
            </div>
          </fieldset>

          <fieldset disabled={locked} className="rule">
            <legend className="t-h3 kr float-left w-full pt-4">배송지</legend>
            <label className="t-caption kr clear-both flex items-center gap-2 pt-5">
              <input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} />
              주문자와 같아요
            </label>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {!same && (
                <>
                  <label className="t-caption kr block">
                    받는 분
                    <input className={`${field} mt-1`} value={ship.recipient} onChange={(e) => setShip({ ...ship, recipient: e.target.value })} />
                  </label>
                  <label className="t-caption kr block">
                    받는 분 연락처
                    <input className={`${field} mt-1`} inputMode="numeric" value={ship.phone} onChange={(e) => setShip({ ...ship, phone: e.target.value })} />
                  </label>
                </>
              )}
              <div className="sm:col-span-2">
                <span className="t-caption kr block">주소</span>
                <div className="mt-1 flex gap-2">
                  <input
                    className={`${field} max-w-[9rem]`}
                    aria-label="우편번호"
                    placeholder="우편번호"
                    inputMode="numeric"
                    readOnly={!manual}
                    value={ship.zonecode}
                    onChange={(e) => setShip({ ...ship, zonecode: digits(e.target.value).slice(0, 5) })}
                    onClick={() => !manual && setFinder(true)}
                  />
                  <button type="button" className="t-nav tag tag-ink kr shrink-0 px-4" onClick={() => setFinder((v) => !v)}>
                    주소 검색
                  </button>
                </div>
                {finder && <div ref={finderRef} className="mt-2 h-[420px] w-full border border-[var(--c-ink)]/25" data-testid="postcode" />}
                <input
                  className={`${field} mt-2`}
                  aria-label="기본 주소"
                  placeholder="기본 주소"
                  readOnly={!manual}
                  value={ship.address}
                  onChange={(e) => setShip({ ...ship, address: e.target.value })}
                  onClick={() => !manual && !ship.address && setFinder(true)}
                />
                <input
                  className={`${field} mt-2`}
                  aria-label="상세 주소"
                  placeholder="상세 주소 (동, 호수 등)"
                  autoComplete="address-line2"
                  value={ship.addressDetail}
                  onChange={(e) => setShip({ ...ship, addressDetail: e.target.value })}
                />
                {!manual && (
                  <button type="button" className="t-caption kr mt-2 text-[var(--c-mute)] underline underline-offset-2" onClick={() => setManual(true)}>
                    직접 입력하기
                  </button>
                )}
              </div>
              <label className="t-caption kr block sm:col-span-2">
                배송 메모
                <select className={`${field} mt-1`} value={MEMOS.includes(ship.memo) ? ship.memo : 'custom'} onChange={(e) => setShip({ ...ship, memo: e.target.value === 'custom' ? ' ' : e.target.value })}>
                  {MEMOS.map((m) => (
                    <option key={m} value={m}>
                      {m || '선택 안 함'}
                    </option>
                  ))}
                  <option value="custom">직접 입력</option>
                </select>
                {!MEMOS.includes(ship.memo) && (
                  <input className={`${field} mt-2`} aria-label="배송 메모 직접 입력" maxLength={100} value={ship.memo.trimStart()} onChange={(e) => setShip({ ...ship, memo: e.target.value || ' ' })} />
                )}
              </label>
            </div>
          </fieldset>
        </form>

        <aside className="lg:col-span-5 lg:col-start-8" aria-label="주문 요약">
          <div className="rounded-[var(--radius-card)] bg-[var(--c-gray)] p-5 lg:sticky lg:top-24 lg:p-7">
            <p className="t-h3 kr">주문 상품 {count}개</p>
            <ul className="mt-4 space-y-2">
              {(order?.lines ?? lines.map((l) => ({ productId: l.productId, name: l.name ?? '', unitPrice: l.unitPrice ?? 0, quantity: l.quantity }))).map((l) => (
                <li key={l.productId} className="t-caption kr flex justify-between gap-4">
                  <span>
                    {l.name} × {l.quantity}
                  </span>
                  <span className="tabular-nums">{price(l.unitPrice * l.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="rule-1 mt-5 space-y-1 pt-4">
              <div className="t-caption kr flex justify-between">
                <dt>상품 금액</dt>
                <dd className="tabular-nums">{price(order?.itemsTotal ?? subtotal.amount)}</dd>
              </div>
              <div className="t-caption kr flex justify-between">
                <dt>배송비</dt>
                <dd className="tabular-nums">{order ? (order.shippingFee ? price(order.shippingFee) : '무료') : '다음 단계에서 계산'}</dd>
              </div>
              <div className="t-h3 kr flex justify-between pt-2">
                <dt>결제 금액</dt>
                <dd className="tabular-nums" data-testid="order-amount">
                  {order ? price(order.amount) : '—'}
                </dd>
              </div>
            </dl>

            {!enabled ? (
              <div className="mt-6 border-t border-[var(--c-ink)]/20 pt-5">
                <p className="t-body kr">온라인 결제 연결을 준비하고 있습니다. 지금은 라기 공식 스마트스토어에서 결제할 수 있습니다.</p>
                <a href={OFFICIAL_LINKS.store} target="_blank" rel="noopener noreferrer" className="t-nav tag tag-ink kr mt-4 px-4 py-3">
                  스마트스토어에서 결제 ↗
                </a>
              </div>
            ) : !order ? (
              <>
                <label className="t-caption kr mt-6 flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>주문 상품, 금액, 배송 정보를 확인했으며 결제 진행에 동의합니다.</span>
                </label>
                <button type="button" onClick={toPayment} disabled={busy} className="btn btn-primary mt-5 w-full">
                  {busy ? '주문서 만드는 중…' : '결제 수단 선택'}
                </button>
              </>
            ) : (
              <>
                <p className="t-caption kr mt-6 text-[var(--c-mute)]">주문번호 {order.orderId}</p>
                <div id="toss-methods" className="mt-3 bg-[var(--c-white)]" />
                <div id="toss-agreement" className="bg-[var(--c-white)]" />
                <button type="button" onClick={pay} disabled={busy || !widgetReady} className="btn btn-primary mt-4 w-full">
                  {price(order.amount)} 결제하기
                </button>
                <button
                  type="button"
                  className="t-caption kr mt-3 text-[var(--c-mute)] underline underline-offset-2"
                  onClick={() => {
                    setOrder(null);
                    setWidgetReady(false);
                    widgets.current = null;
                  }}
                >
                  주문 정보 고치기
                </button>
              </>
            )}
            {error && (
              <p className="t-caption kr mt-4 text-[var(--c-blue)]" role="alert">
                {error}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Reads Toss's return values, whether they were put before or after the # of this HashRouter URL. */
function useReturnParams() {
  const [hashParams] = useSearchParams();
  const outer = new URLSearchParams(window.location.search);
  return (k: string) => hashParams.get(k) ?? outer.get(k);
}

function clearOuterQuery() {
  if (window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
}

/** Toss sends the visitor here after they pay; the Worker then confirms the payment. */
export function CheckoutSuccessPage() {
  const get = useReturnParams();
  const { clear } = useCart();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const once = useRef(false);
  const paymentKey = get('paymentKey');
  const orderId = get('orderId');
  const amount = Number(get('amount'));

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (!paymentKey || !orderId || !amount) {
      setError('결제 정보를 찾을 수 없습니다.');
      return;
    }
    confirmPayment({ paymentKey, orderId, amount })
      .then((o) => {
        // The return values stay in the address: reloading re-confirms, which the server answers idempotently.
        setOrder(o);
        clear();
      })
      .catch((e: Error) => setError(e.message));
  }, [paymentKey, orderId, amount, clear]);

  if (error)
    return (
      <div className="px-page pb-32 pt-page">
        <h1 className="t-h1 kr !font-bold">결제를 완료하지 못했습니다</h1>
        <p className="t-body kr mt-4" role="alert">
          {error}
        </p>
        <p className="t-caption kr mt-2 text-[var(--c-mute)]">승인이 끝나지 않은 결제는 청구되지 않습니다. 장바구니는 그대로 남아 있습니다.</p>
        <Link to="/checkout" className="t-nav tag tag-ink kr mt-6 px-4 py-3">
          주문서로 돌아가기
        </Link>
      </div>
    );
  if (!order) return <p className="t-body kr px-page pt-page">결제를 확인하고 있습니다…</p>;

  const s = order.shipping;
  return (
    <div className="px-page pb-32 pt-page">
      <p className="t-label t-mark text-[var(--c-mute)]">Order complete</p>
      <h1 className="t-h1 kr mt-2 !font-bold" data-testid="paid">
        결제가 완료되었습니다
      </h1>
      <p className="t-body kr mt-3">{order.customer.name}님, 주문해 주셔서 감사합니다.</p>
      <dl className="rule mt-10 max-w-2xl">
        {(
          [
            ['주문번호', order.orderId],
            ['주문 상품', order.lines.map((l) => `${l.name} × ${l.quantity}`).join(', ')],
            ['결제 금액', `${price(order.amount)} (배송비 ${order.shippingFee ? price(order.shippingFee) : '무료'})`],
            ['결제 수단', order.payment?.method ?? ''],
            ['배송지', `(${s.zonecode}) ${s.address} ${s.addressDetail} · ${s.recipient}`],
          ] as [string, string][]
        )
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="rule-1 grid grid-cols-[7rem_1fr] gap-4 py-3">
              <dt className="t-caption kr text-[var(--c-mute)]">{k}</dt>
              <dd className="t-body kr">{v}</dd>
            </div>
          ))}
      </dl>
      <p className="t-caption kr mt-4 max-w-2xl rounded-[var(--radius-card)] bg-[var(--c-gray)] p-4">
        주문번호 <b className="tabular-nums">{order.orderId}</b>를 메모해 두세요. 비회원도 <Link to="/order" className="underline underline-offset-2">주문 조회</Link>에서 주문번호와 휴대폰 번호로 확인할 수 있습니다.
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        {order.payment?.receiptUrl && (
          <a href={order.payment.receiptUrl} target="_blank" rel="noopener noreferrer" className="btn btn-line">
            영수증 ↗
          </a>
        )}
        <Link to={`/product/${order.lines[0]?.productId ?? ''}`} className="btn btn-line">
          구매평 쓰기
        </Link>
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </div>
    </div>
  );
}

/** Toss sends the visitor here when the payment was cancelled or declined. The cart is kept. */
export function CheckoutFailPage() {
  const get = useReturnParams();
  const code = get('code');
  const message = get('message');
  const pending = pendingOrder();
  useEffect(clearOuterQuery, []);
  return (
    <div className="px-page pb-32 pt-page">
      <h1 className="t-h1 kr !font-bold">{code === 'PAY_PROCESS_CANCELED' ? '결제를 취소했습니다' : '결제가 완료되지 않았습니다'}</h1>
      {message && <p className="t-body kr mt-4">{message}</p>}
      {pending && <p className="t-caption kr mt-2 text-[var(--c-mute)]">주문번호 {pending.orderId} · 결제되지 않은 주문은 하루 뒤 자동으로 지워집니다.</p>}
      <div className="t-nav kr mt-6 flex gap-2">
        <Link to="/checkout" className="tag tag-ink px-4 py-3">
          다시 결제하기
        </Link>
        <Link to="/cart" className="btn btn-line">
          장바구니
        </Link>
      </div>
    </div>
  );
}
