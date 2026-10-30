import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { LagiLogo } from '@/components/LagiLogo';
import { lookupOrder, myOrders, type OrderSummary } from '../reviews';
import { price } from '../data';

/** Login / sign-up / account / order lookup — same AuthContext and Worker endpoints, a centred card layout. */
function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        {...rest}
        placeholder={label}
        className="t-body kr block h-12 w-full border border-black/15 bg-white px-4 outline-none transition-colors placeholder:text-[#9a9a9a] focus:border-[var(--c-ink)]"
      />
    </label>
  );
}

function Card({ children, title, en }: { children: React.ReactNode; title: string; en: string }) {
  return (
    <div className="flex justify-center px-page pb-32 pt-page">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center text-center">
          <LagiLogo className="h-16 w-auto text-[var(--c-blue)]" title="LAGI" />
          <p className="t-label t-mark mt-6 text-[var(--c-mute)]">{en}</p>
          <h1 className="t-h1 kr mt-1 !font-bold">{title}</h1>
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </div>
  );
}

function Divider({ label = '또는' }: { label?: string }) {
  return (
    <div className="t-caption kr my-6 flex items-center gap-4 text-[var(--c-mute)]">
      <span className="h-px flex-1 bg-black/10" />
      {label}
      <span className="h-px flex-1 bg-black/10" />
    </div>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const back = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (user) return <Navigate to="/account" replace />;
  return (
    <Card title="로그인" en="Log in">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await login(f.email, f.password);
            nav(back);
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="-space-y-px">
          <Field label="이메일" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Field label="비밀번호" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
        <p className="t-caption kr mt-3 text-[var(--c-mute)]">로그인 상태는 이 기기에서 30일 동안 유지됩니다.</p>
        {err && (
          <p className="t-caption kr mt-3 text-[var(--c-blue)]" role="alert">
            {err}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn btn-primary mt-5 w-full">
          {busy ? '확인 중…' : '로그인'}
        </button>
        <div className="t-caption kr mt-4 flex justify-between">
          <Link to="/signup" className="underline-offset-4 hover:underline">
            회원가입
          </Link>
          <a href="https://www.instagram.com/lagi.official/" target="_blank" rel="noopener noreferrer" className="text-[var(--c-mute)] underline-offset-4 hover:underline">
            비밀번호 찾기 문의 ↗
          </a>
        </div>
      </form>
      <Divider />
      <Link to="/order" className="btn btn-line w-full">
        비회원 주문 조회
      </Link>
    </Card>
  );
}

export function SignupPage() {
  const { user, signup } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', password2: '' });
  const [agree, setAgree] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (user) return <Navigate to="/account" replace />;
  return (
    <Card title="회원가입" en="Sign up">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (f.password.length < 8) return setErr('비밀번호는 8자 이상으로 입력해 주세요.');
          if (f.password !== f.password2) return setErr('비밀번호가 서로 다릅니다.');
          if (!agree) return setErr('필수 약관에 동의해 주세요.');
          setBusy(true);
          setErr(null);
          try {
            await signup({ name: f.name.trim(), email: f.email, password: f.password, agree, marketing });
            nav('/');
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="이름" autoComplete="name" required maxLength={30} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field label="이메일" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Field label="비밀번호 (8자 이상)" type="password" autoComplete="new-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <Field label="비밀번호 확인" type="password" autoComplete="new-password" required value={f.password2} onChange={(e) => setF({ ...f, password2: e.target.value })} />
        <div className="t-caption kr space-y-3 rounded-[var(--radius-card)] bg-[var(--c-gray)] p-4">
          <label className="flex gap-2">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            <span>
              [필수] 이용약관 및 개인정보 수집·이용에 동의합니다.{' '}
              <span className="text-[var(--c-mute)]">수집 항목: 이름, 이메일, 비밀번호(암호화) · 목적: 회원 식별 · 보관: 탈퇴 시까지</span>
            </span>
          </label>
          <label className="flex gap-2">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5" />
            <span>[선택] 새 제품 소식을 이메일로 받겠습니다.</span>
          </label>
        </div>
        {err && (
          <p className="t-caption kr text-[var(--c-blue)]" role="alert">
            {err}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? '가입 중…' : '가입하기'}
        </button>
        <p className="t-caption kr text-center text-[var(--c-mute)]">
          이미 회원이신가요?{' '}
          <Link to="/login" className="text-[var(--c-ink)] underline underline-offset-4">
            로그인
          </Link>
        </p>
      </form>
    </Card>
  );
}

const STATUS: Record<OrderSummary['status'], string> = { PAID: '결제 완료', PENDING: '결제 대기', FAILED: '결제 실패' };

function OrderCard({ o }: { o: OrderSummary }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-black/15 p-5" data-testid="order-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="t-value kr">{o.orderName}</p>
        <span className={`t-label kr rounded-full px-2.5 py-1 ${o.status === 'PAID' ? 'bg-[var(--c-blue)] text-white' : 'bg-[var(--c-gray)]'}`}>{STATUS[o.status]}</span>
      </div>
      <p className="t-caption mt-1 tabular-nums text-[var(--c-mute)]">주문 번호 {o.orderId}</p>
      <ul className="t-caption kr mt-4 space-y-1 border-t border-black/10 pt-3">
        {o.lines.map((l) => (
          <li key={l.productId} className="flex justify-between gap-4">
            <span>
              {l.name} × {l.quantity}
            </span>
            <span className="tabular-nums">{price(l.unitPrice * l.quantity)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-4 text-[var(--c-mute)]">
          <span>배송비</span>
          <span className="tabular-nums">{o.shippingFee ? price(o.shippingFee) : '무료'}</span>
        </li>
        <li className="flex justify-between gap-4 pt-1 font-semibold">
          <span>결제 금액</span>
          <span className="tabular-nums">{price(o.amount)}</span>
        </li>
      </ul>
      <p className="t-caption kr mt-3 text-[var(--c-mute)]">
        받는 분 {o.shipping.recipient} · ({o.shipping.zonecode}) {o.shipping.address} {o.shipping.addressDetail}
      </p>
      {o.payment?.receiptUrl && (
        <a href={o.payment.receiptUrl} target="_blank" rel="noopener noreferrer" className="t-caption kr mt-2 inline-block underline underline-offset-4">
          영수증 보기 ↗
        </a>
      )}
    </div>
  );
}

/** Guest order lookup: order number + the phone number given at checkout. */
export function OrderLookupPage() {
  const [f, setF] = useState({ orderId: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  return (
    <Card title="주문 조회" en="Order lookup">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          setOrder(null);
          try {
            setOrder(await lookupOrder(f.orderId.trim(), f.phone));
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="-space-y-px">
          <Field label="주문 번호 (예: LAGI-20261030-…)" required value={f.orderId} onChange={(e) => setF({ ...f, orderId: e.target.value })} />
          <Field label="주문할 때 입력한 휴대폰 번호" type="tel" inputMode="numeric" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        {err && (
          <p className="t-caption kr mt-3 text-[var(--c-blue)]" role="alert">
            {err}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn btn-primary mt-5 w-full">
          {busy ? '조회 중…' : '주문 조회'}
        </button>
        <p className="t-caption kr mt-3 text-center text-[var(--c-mute)]">주문 번호는 결제 완료 화면과 안내 메일에서 확인할 수 있습니다.</p>
      </form>
      {order && (
        <div className="mt-8">
          <OrderCard o={order} />
        </div>
      )}
    </Card>
  );
}

export function AccountPage() {
  const { user, ready, logout } = useAuth();
  const nav = useNavigate();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (user) myOrders().then((d) => setOrders(d.orders), (e) => setErr((e as Error).message));
  }, [user]);
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="px-page pb-32 pt-page">
      <div className="mx-auto max-w-3xl">
        <p className="t-label t-mark text-[var(--c-mute)]">My page</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <h1 className="t-h1 kr !font-bold">{user.name}님</h1>
          <div className="flex gap-2">
            <Link to="/cart" className="btn btn-line !min-h-[40px]">
              장바구니
            </Link>
            <button
              type="button"
              className="btn btn-line !min-h-[40px]"
              onClick={async () => {
                await logout();
                nav('/');
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
        <p className="t-caption kr mt-1 text-[var(--c-mute)]">{user.email}</p>

        <h2 className="t-h3 kr mt-12 border-t-2 border-[var(--c-ink)] pt-4">주문 내역</h2>
        {err && <p className="t-caption kr mt-4 text-[var(--c-mute)]">{err}</p>}
        {orders && orders.length === 0 && (
          <div className="mt-4 rounded-[var(--radius-card)] bg-[var(--c-gray)] px-6 py-10 text-center">
            <p className="t-value kr">아직 주문이 없습니다.</p>
            <Link to="/discover" className="btn btn-primary mt-4">
              제품 보러 가기
            </Link>
          </div>
        )}
        <div className="mt-4 space-y-3" data-testid="my-orders">
          {orders?.map((o) => (
            <OrderCard key={o.orderId} o={o} />
          ))}
        </div>
      </div>
    </div>
  );
}
