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
      <h1 className="t-display">LOG IN</h1>
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
        <Field label="Email" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Field label="Password" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        {err && <p className="t-label text-[var(--c-blue)]">{err}</p>}
        <div className="t-nav flex items-center gap-4">
          <button type="submit" disabled={busy} className="tag tag-ink px-5 py-3 disabled:opacity-40">
            Log in
          </button>
          <Link to="/signup" className="tag">
            Create account
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
      <h1 className="t-display">SIGN UP</h1>
      <form
        className="rule mt-16 max-w-md space-y-8 pt-8"
        onSubmit={async (e) => {
          e.preventDefault();
          if (f.password.length < 8) return setErr('Password must be at least 8 characters.');
          if (f.password !== f.password2) return setErr('Passwords do not match.');
          if (!agree) return setErr('Please agree to the required terms.');
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
        <Field label="Name" autoComplete="name" required maxLength={30} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field label="Email" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Field label="Password (8+ characters)" type="password" autoComplete="new-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <Field label="Confirm password" type="password" autoComplete="new-password" required value={f.password2} onChange={(e) => setF({ ...f, password2: e.target.value })} />
        <div className="t-caption space-y-3">
          <label className="flex gap-2">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              [Required] I agree to the terms and to the collection and use of my personal data.{' '}
              <span className="text-[var(--c-mute)]">Collected: name, email, password (encrypted) · Purpose: identifying members · Kept: until you delete your account</span>
            </span>
          </label>
          <label className="flex gap-2">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            <span>[Optional] Send me news about new products by email.</span>
          </label>
        </div>
        {err && <p className="t-label text-[var(--c-blue)]">{err}</p>}
        <button type="submit" disabled={busy} className="t-nav tag tag-ink px-5 py-3 disabled:opacity-40">
          Create account
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
      <h1 className="t-display">{user.name}</h1>
      <div className="rule mt-16 max-w-md pt-6">
        <p className="t-label text-[var(--c-mute)]">Email</p>
        <p className="t-value mt-1">{user.email}</p>
        <div className="t-nav mt-10 flex gap-2">
          <Link to="/cart" className="tag bg-[var(--c-label)] px-4 py-3">
            Cart
          </Link>
          <button
            type="button"
            className="tag px-4 py-3"
            onClick={async () => {
              await logout();
              nav('/');
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
