// src/pages/LoginPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, jsonFetch, injectCleanTheme } from "../components/hr/Shared";
import { useAuth } from "../auth/AuthContext";

import { defaultPathForRole } from "../auth/roles";


export default function LoginPage() {
  injectCleanTheme();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { ok, status, data } = await jsonFetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!ok) {
        const msg = typeof data === "string" ? data : (data as any)?.error || `HTTP ${status}`;
        throw new Error(msg);
      }
      const j = data as any; // { ok:true, token, user }
      if (!j?.ok || !j?.token || !j?.user) throw new Error((j && j.error) || "로그인 실패");
      login(j.token, j.user);
      navigate(defaultPathForRole(j.user.role || null));

    } catch (e: any) {
      setErr(e?.message || "로그인 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-wrap mgr">
      <div className="shell">
        <div className="card" style={{maxWidth:420, margin:"60px auto"}}>
          <div className="card-body">
            <div className="title" style={{textAlign:"center"}}>로그인</div>
            <form onSubmit={doLogin}>
              <div style={{display:"grid", gap:10}}>
                <input className="inp" placeholder="아이디" value={username} onChange={e=>setUsername(e.target.value)} />
                <input className="inp" placeholder="비밀번호" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
                <button className="btn btn-primary" disabled={busy}>{busy ? "로그인 중…" : "로그인"}</button>
                {err && <div className="badge" style={{borderColor:"#fecaca", color:"#b91c1c"}}>오류: {err}</div>}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
