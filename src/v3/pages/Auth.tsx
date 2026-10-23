import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

/** Login / sign-up / account — same AuthContext and Worker endpoints as before, new layout. */
function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="t-label text-[var(--c-mute)]">{label}</span>
      <input {...rest} className="t-value mt-1 block w-full border-0 border-b-2 border-[var(--c-ink)] bg-transparent py-2 outline-none focus:border-[var(--c-blue)]" />
    </label>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (user) return <Navigate to="/account" replace />;
  return (
    <div className="px-page pb-32 pt-page">
      <h1 className="t-display">로그인</h1>
      <form
        className="rule mt-16 max-w-md space-y-8 pt-8"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await login(f.email, f.password);
            nav('/');
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="이메일" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Field label="비밀번호" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        {err && <p className="t-label text-[var(--c-blue)]">{err}</p>}
        <div className="t-nav flex items-center gap-4">
          <button type="submit" disabled={busy} className="tag tag-ink px-5 py-3 disabled:opacity-40">
            로그인
          </button>
          <Link to="/signup" className="tag">
            회원가입
          </Link>
        </div>
      </form>
    </div>
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
    <div className="px-page pb-32 pt-page">
      <h1 className="t-display">회원가입</h1>
      <form
        className="rule mt-16 max-w-md space-y-8 pt-8"
        onSubmit={async (e) => {
          e.preventDefault();
          if (f.password.length < 8) return setErr('비밀번호는 8자 이상으로 입력해 주세요.');
          if (f.password !== f.password2) return setErr('비밀번호가 서로 달라요.');
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
        <div className="t-caption space-y-3">
          <label className="flex gap-2">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              [필수] 이용약관 및 개인정보 수집·이용에 동의합니다. <span className="text-[var(--c-mute)]">수집: 이름, 이메일, 비밀번호(암호화) · 목적: 회원 식별 · 보관: 탈퇴 시까지</span>
            </span>
          </label>
          <label className="flex gap-2">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            <span>[선택] 새 제품 소식을 이메일로 받겠습니다.</span>
          </label>
        </div>
        {err && <p className="t-label text-[var(--c-blue)]">{err}</p>}
        <button type="submit" disabled={busy} className="t-nav tag tag-ink px-5 py-3 disabled:opacity-40">
          가입하기
        </button>
      </form>
    </div>
  );
}

export function AccountPage() {
  const { user, ready, logout } = useAuth();
  const nav = useNavigate();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="px-page pb-32 pt-page">
      <h1 className="t-display">{user.name}님</h1>
      <div className="rule mt-16 max-w-md pt-6">
        <p className="t-label text-[var(--c-mute)]">이메일</p>
        <p className="t-value mt-1">{user.email}</p>
        <div className="t-nav mt-10 flex gap-2">
          <Link to="/cart" className="tag bg-[var(--c-label)] px-4 py-3">
            장바구니
          </Link>
          <button
            type="button"
            className="tag px-4 py-3"
            onClick={async () => {
              await logout();
              nav('/');
            }}
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
