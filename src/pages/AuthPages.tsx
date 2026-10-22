import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { LagiLogo } from '@/components/LagiLogo';
import { Motif } from '@/components/Motif';

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden px-4 py-14 lg:py-24">
      <Motif index={1} className="pointer-events-none absolute -left-10 top-10 hidden h-40 w-auto opacity-90 lg:block" />
      <Motif index={10} className="pointer-events-none absolute -right-6 bottom-16 hidden h-24 w-auto lg:block" />
      <div className="relative mx-auto w-full max-w-[420px] animate-[lagi-rise_0.7s_cubic-bezier(.2,.7,.2,1)_both]">
        <LagiLogo className="mx-auto h-16 w-auto text-[#1D5198]" />
        <h1 className="mt-8 text-center text-2xl font-bold tracking-[-0.03em]">{title}</h1>
        <p className="mt-2 text-center text-sm text-stone">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-graphite">{label}</span>
      <input
        {...rest}
        className="h-12 w-full rounded-md border border-line bg-paper px-4 text-[15px] transition-colors placeholder:text-stone focus:border-ink focus:outline-none"
      />
    </label>
  );
}

function Submit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="h-12 w-full rounded-md bg-ink text-[15px] font-bold text-paper transition-colors hover:bg-blue focus-ring disabled:opacity-50"
    >
      {busy ? '잠시만요…' : children}
    </button>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={next} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="로그인" subtitle="다시 만나서 반가워요.">
      <form onSubmit={submit} className="space-y-4">
        <Input label="이메일" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-orange">{error}</p>}
        <Submit busy={busy}>로그인</Submit>
      </form>
      <p className="mt-6 text-center text-sm text-stone">
        아직 회원이 아니신가요?{' '}
        <Link to={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-ink underline underline-offset-4">
          회원가입
        </Link>
      </p>
    </AuthShell>
  );
}

export function SignupPage() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const [form, setForm] = useState({ name: '', email: '', password: '', password2: '' });
  const [agree, setAgree] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={next} replace />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) return setError('비밀번호는 8자 이상으로 입력해 주세요.');
    if (form.password !== form.password2) return setError('비밀번호가 서로 다릅니다.');
    if (!agree) return setError('필수 약관에 동의해 주세요.');
    setBusy(true);
    setError(null);
    try {
      await signup({ name: form.name.trim(), email: form.email, password: form.password, agree, marketing });
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="회원가입" subtitle="LAGI IN AGING — 오래 쓰고, 다시 고르는 사람들.">
      <form onSubmit={submit} className="space-y-4">
        <Input label="이름" autoComplete="name" required maxLength={30} value={form.name} onChange={set('name')} />
        <Input label="이메일" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        <Input
          label="비밀번호 (8자 이상)"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={set('password')}
        />
        <Input label="비밀번호 확인" type="password" autoComplete="new-password" required value={form.password2} onChange={set('password2')} />

        <div className="space-y-2.5 rounded-md bg-mist p-4 text-[13px]">
          <label className="flex items-start gap-2.5">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-ink" />
            <span>
              <b>[필수]</b> 이용약관 및 개인정보 수집·이용에 동의합니다.
              <span className="mt-1 block text-xs text-stone">
                수집 항목: 이름, 이메일, 비밀번호(암호화 저장) · 목적: 회원 식별과 로그인 · 보관: 회원 탈퇴 시까지
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2.5">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-4 w-4 accent-ink" />
            <span>[선택] 신상품·이벤트 소식을 이메일로 받겠습니다.</span>
          </label>
        </div>

        {error && <p className="text-sm text-orange">{error}</p>}
        <Submit busy={busy}>가입하기</Submit>
      </form>
      <p className="mt-6 text-center text-sm text-stone">
        이미 회원이신가요?{' '}
        <Link to="/login" className="font-semibold text-ink underline underline-offset-4">
          로그인
        </Link>
      </p>
    </AuthShell>
  );
}

export function AccountPage() {
  const { user, ready, logout } = useAuth();
  const navigate = useNavigate();
  if (!ready) return null;
  if (!user) return <Navigate to="/login?next=/account" replace />;

  return (
    <AuthShell title={`${user.name}님, 반가워요`} subtitle={user.email}>
      <div className="space-y-2">
        <Link to="/products" className="flex h-12 items-center justify-between rounded-md border border-line px-4 text-sm font-semibold hover:border-ink focus-ring">
          쇼핑 계속하기 <span aria-hidden="true">→</span>
        </Link>
        <Link to="/cart" className="flex h-12 items-center justify-between rounded-md border border-line px-4 text-sm font-semibold hover:border-ink focus-ring">
          장바구니 <span aria-hidden="true">→</span>
        </Link>
        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate('/');
          }}
          className="mt-4 h-12 w-full rounded-md bg-mist text-sm font-semibold text-graphite hover:text-ink focus-ring"
        >
          로그아웃
        </button>
      </div>
      <p className="mt-6 text-center text-xs text-stone">가입일 {new Date(user.createdAt).toLocaleDateString('ko-KR')}</p>
    </AuthShell>
  );
}
