import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../components/hr/Shared";
import type { Role } from "./roles";

function parseJwt<T = any>(token: string | null): T | null {
  try {
    if (!token) return null;
    const [_, payload] = token.split(".");
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}

type User = { id: string; name?: string; role: Role } | null;

type AuthCtx = {
  user: User;
  token: string | null;
  loading: boolean;
  login: (t: string, u: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  token: null,
  loading: true,
  login: (_t: string, _u: User) => {},
  logout: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("lm_token"));
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!token) { setUser(null); setLoading(false); return; }
      const p = parseJwt<{ sub?: string; name?: string; role?: Role }>(token);
      if (p?.role) {
        setUser({ id: p.sub || "me", name: p.name, role: p.role });
        setLoading(false);
        return;
      }
      // 토큰에 role이 없으면 서버에서 보강 (선택)
      try {
        const r = await fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json();
        if (r.ok && j?.ok) setUser({ id: j.data?.id, name: j.data?.name, role: j.data?.role });
        else setUser(null);
      } catch { setUser(null); }
      setLoading(false);
    })();
  }, [token]);

  const login  = (t: string, u: User) => {
    localStorage.setItem("lm_token", t);
    setToken(t);
    setUser(u);
  };
  const logout = () => { localStorage.removeItem("lm_token"); setToken(null); setUser(null); };

  const value = useMemo(() => ({ user, token, loading, login, logout }), [user, token, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
