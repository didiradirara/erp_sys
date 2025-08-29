// src/pages/EmployeeLeavePage.tsx
import React, { useEffect, useState } from "react";
import {
  API_BASE, STATUS_KO, Status, LeaveRequestAPI, jsonFetch
} from "../components/hr/Shared";

export default function EmployeeLeavePage() {
  const [rows, setRows] = useState<LeaveRequestAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);

  // 폼 상태 (예시)
  const [form, setForm] = useState({
    leaveType: "연차",
    startDate: "",
    endDate: "",
    note: ""
  });

  async function loadMyRequests() {
    setLoading(true); setErr(null);
    try {
      const { ok, status, data } = await jsonFetch(`${API_BASE}/api/requests/mine`);
      if (!ok || (data as any)?.ok === false) {
        const msg = typeof data === "string" ? data : (data as any)?.error || `HTTP ${status}`;
        throw new Error(msg);
      }
      setRows((data as any).data as LeaveRequestAPI[]);
    } catch (e:any) {
      setErr(e?.message || "목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{ loadMyRequests(); }, []);

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { ok, status, data } = await jsonFetch(`${API_BASE}/api/requests`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(form)
      });
      if (!ok || (data as any)?.ok === false) {
        const msg = typeof data === "string" ? data : (data as any)?.error || `HTTP ${status}`;
        throw new Error(msg);
      }
      await loadMyRequests();
      alert("연차 신청이 접수되었습니다.");
    } catch(e:any) {
      alert(e?.message || "신청 실패");
    }
  }

  return (
      <form className="card" onSubmit={submitLeave} style={{marginBottom:16}}>
        <div className="card-body" style={{display:"grid", gap:10}}>
          <select className="sel" value={form.leaveType} onChange={e=>setForm(s=>({...s, leaveType:e.target.value}))}>
            {["연차","반차","병가","경조사"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="inp" type="date" value={form.startDate} onChange={e=>setForm(s=>({...s, startDate:e.target.value}))} />
          <input className="inp" type="date" value={form.endDate} onChange={e=>setForm(s=>({...s, endDate:e.target.value}))} />
          <input
            className="inp"
            placeholder="사유"
            required
            value={form.note}
            onChange={e=>setForm(s=>({...s, note:e.target.value}))}
          />
          <button className="btn btn-primary">신청</button>
        </div>
      </form>
      <div className="card">
        <div className="card-body">
          {loading ? <div style={{color:"#94a3b8"}}>불러오는 중…</div> : err ? (
            <div className="badge" style={{borderColor:"#fecaca", color:"#b91c1c"}}>오류: {err}</div>
          ): (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>신청일</th><th>종류</th><th>기간</th><th>상태</th><th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length===0 ? (
                    <tr><td colSpan={5} style={{padding:12, color:"#94a3b8"}}>내 신청이 없습니다.</td></tr>
                  ) : rows.map(r=>(
                    <tr key={r.requestId}>
                      <td>{r.dateRequested}</td>
                      <td>{r.leaveType}</td>
                      <td>{r.startDate} ~ {r.endDate}</td>
                      <td>{STATUS_KO[r.status as Status]}</td>
                      <td>{r.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
