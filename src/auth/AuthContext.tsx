import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AI_TRYON_URL } from '@/tryon/aiTryOn';

/** Members are kept by the same Cloudflare Worker as the AI fitting (server/tryon-worker). */
const API = AI_TRYON_URL.replace(/\/+$/, '');
const TOKEN_KEY = 'lagi-session';

export interface Member {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface AuthState {
  user: Member | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: { email: string; password: string; name: string; agree: boolean; marketing: boolean }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the session simply lasts for this page view.
  }
}

async function call<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  }).catch(() => {
    throw new Error('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? '요청을 처리하지 못했습니다.');
  return body;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Member | null>(null);
  const [token, setToken] = useState<string | null>(readToken);
  const [ready, setReady] = useState(!token);

  useEffect(() => {
    if (!token) return;
    call<{ user: Member }>('/auth/me', { method: 'GET' }, token)
      .then((r) => setUser(r.user))
      .catch(() => {
        writeToken(null);
        setToken(null);
      })
      .finally(() => setReady(true));
    // Only the stored token on first load needs checking; later tokens come with their user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback((r: { token: string; user: Member }) => {
    writeToken(r.token);
    setToken(r.token);
    setUser(r.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => start(await call('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })),
    [start]
  );

  const signup = useCallback<AuthState['signup']>(
    async (input) => start(await call('/auth/signup', { method: 'POST', body: JSON.stringify(input) })),
    [start]
  );

  const logout = useCallback(async () => {
    await call('/auth/logout', { method: 'POST' }, token).catch(() => undefined);
    writeToken(null);
    setToken(null);
    setUser(null);
  }, [token]);

  return <AuthContext.Provider value={{ user, ready, login, signup, logout }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
