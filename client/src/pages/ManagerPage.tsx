// src/pages/ManagerPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  API_BASE, Status, STATUS_KO, LeaveRequestAPI, WorklogRow,
  jsonFetch, StatusBadge, SignaturePad, PageShell
} from "../components/hr/Shared";

export default function ManagerPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate("/login"); };

  const [tab, setTab] = useState<"requests"|"worklogs">("requests");

  // 연차
  const [rows, setRows] = useState<LeaveRequestAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);
  const [statusFilter, setStatusFilter] = useState<"전체"|Status>("Pending");

  async function loadRequests(){
    setLoading(true); setErr(null);
    try {
      const { ok, status, data } = await jsonFetch(`${API_BASE}/api/requests`);
      if (!ok || (data as any)?.ok === false) {
        const msg = typeof data === "string" ? data : (data as any)?.error || `HTTP ${status}`;
        throw new Error(msg);
      }
      setRows((data as any).data as LeaveRequestAPI[]);
    } catch(e:any){
      setErr(e?.message || "목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{ loadRequests(); }, []);

  const filtered = useMemo(()=>{
    let list = rows.slice();
    if (statusFilter !== "전체") list = list.filter(r=>r.status === statusFilter);
    list.sort((a,b)=>(a.dateRequested < b.dateRequested ? 1 : -1));
    return list;
  }, [rows, statusFilter]);

  async function reject(id:string){
    try {
      const { ok, status, data } = await jsonFetch(`${API_BASE}/api/requests/${id}/status`, {
        method:"PUT",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ status:"Rejected" })
      });
      if (!ok || (data as any)?.ok === false) {
        const msg = typeof data === "string" ? data : (data as any)?.error || `HTTP ${status}`;
        throw new Error(msg);
      }
      await loadRequests();
    } catch(e:any){
      alert(e?.message || "거절 실패");
    }
  }

  // 승인 서명
  const [signOpen, setSignOpen] = useState(false);
  const [signTargetId, setSignTargetId] = useState<string | null>(null);
  const [signDataUrl, setSignDataUrl] = useState<string | null>(null);
  const [signBusy, setSignBusy] = useState(false);
  const [signErr, setSignErr] = useState<string | null>(null);

  const openApproveWithSign = (id: string) => {
    setSignTargetId(id); setSignDataUrl(null); setSignErr(null); setSignOpen(true);
  };
  const submitApproval = async () => {
    if (!signTargetId) return;
    if (!signDataUrl) { setSignErr("서명을 입력하세요."); return; }
    setSignBusy(true); setSignErr(null);
    try {
      const { ok, status, data } = await jsonFetch(`${API_BASE}/api/requests/${signTargetId}/approve`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ signatureDataUrl: signDataUrl })
      });
      if (!ok || (data as any)?.ok === false) {
        const msg = typeof data === "string" ? data : (data as any)?.error || `HTTP ${status}`;
        throw new Error(msg);
      }
      setSignOpen(false);
      await loadRequests();
    } catch(e:any){
      setSignErr(e?.message || "승인 실패");
    } finally {
      setSignBusy(false);
    }
  };

  // 근무일지
  const [wls, setWls] = useState<WorklogRow[]>([]);
  const [wlErr, setWlErr] = useState<string|null>(null);
  const [wlLoading, setWlLoading] = useState(false);
  const [wlStatus, setWlStatus] = useState<"전체"|"Pending"|"Approved"|"Rejected">("전체");

  async function loadWorklogs(){
    setWlLoading(true); setWlErr(null);
    try {
      const { ok, status, data } = await jsonFetch(`${API_BASE}/api/worklogs`);
      if (!ok || (data as any)?.ok === false) {
        const msg = typeof data === "string" ? data : (data as any)?.error || `HTTP ${status}`;
        throw new Error(msg);
      }
      setWls((data as any).data as WorklogRow[]);
    } catch(e:any){
      setWlErr(e?.message || "근무일지 조회 실패");
    } finally {
      setWlLoading(false);
    }
  }
  useEffect(()=>{ if (tab==="worklogs") loadWorklogs(); }, [tab]);

  const filteredWl = useMemo(()=>{
    let list = wls.slice();
    if (wlStatus !== "전체") list = list.filter(x=>x.status === wlStatus);
    return list;
  }, [wls, wlStatus]);

  async function updateWorklogStatus(id: string, status: "Approved" | "Rejected") {
    try {
      const { ok, status: sc, data } = await jsonFetch(`${API_BASE}/api/worklogs/${id}/status`, {
        method:"PUT",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ status })
      });
      if (!ok || (data as any)?.ok === false) {
        const msg = typeof data === "string" ? data : (data as any)?.error || `HTTP ${sc}`;
        throw new Error(msg);
      }
      await loadWorklogs();
    } catch(e:any){
      alert(e?.message || "상태 변경 실패");
    }
  }

  return (
    <PageShell
      title="상사 검토"
      tabs={[
        { key: "requests", label: "연차 신청" },
        { key: "worklogs", label: "근무일지" }
      ]}
      activeTab={tab}
      onChangeTab={(k)=>setTab(k as any)}
      right={<button className="btn-ghost" onClick={handleLogout}>로그아웃</button>}
    >
      {tab==="requests" ? (
        <>
          <div className="toolbar">
            <span className="chip">상태</span>
            <select className="sel" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)}>
              {(["전체","Pending","Approved","Rejected","Canceled"] as const).map(s =>
                <option key={s} value={s}>{s==="전체" ? "전체" : STATUS_KO[s as Status]}</option>
              )}
            </select>
            <button className="btn btn-primary" onClick={loadRequests}>새로고침</button>
            {err && <span className="badge" style={{borderColor:"#fecaca", color:"#b91c1c"}}>오류: {err}</span>}
          </div>
          <div className="card">
            <div className="card-body">
              {loading ? <div style={{color:"#94a3b8"}}>불러오는 중…</div> : (
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>신청일</th><th>사번</th><th>이름</th><th>부서</th><th>직급</th>
                        <th>연차종류</th><th>기간</th><th>상태</th><th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length===0 ? (
                        <tr><td colSpan={9} style={{padding:12, color:"#94a3b8"}}>표시할 데이터가 없습니다.</td></tr>
                      ) : filtered.map(r=>{
                        const pending = r.status === "Pending";
                        return (
                          <tr key={r.requestId}>
                            <td>{r.dateRequested}</td>
                            <td>{r.empId}</td>
                            <td>{r.name}</td>
                            <td>{r.dept}</td>
                            <td>{r.position}</td>
                            <td>{r.leaveType}</td>
                            <td>{r.startDate} ~ {r.endDate}</td>
                            <td><StatusBadge s={r.status as Status} /></td>
                            <td style={{display:"flex", gap:8}}>
                              {pending ? (
                                <>
                                  <button className="btn btn-blue" onClick={()=>openApproveWithSign(r.requestId)}>승인</button>
                                  <button className="btn btn-red" onClick={()=>reject(r.requestId)}>거절</button>
                                </>
                              ) : <span style={{color:"#64748b"}}>-</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="toolbar">
            <select className="sel" value={wlStatus} onChange={e=>setWlStatus(e.target.value as any)}>
              {(["전체","Pending","Approved","Rejected"] as const).map(s =>
                <option key={s} value={s}>{s==="전체" ? "전체" : STATUS_KO[s as Status]}</option>
              )}
            </select>
            <button className="btn btn-primary" onClick={loadWorklogs}>새로고침</button>
            {wlErr && <span className="badge" style={{borderColor:"#fecaca", color:"#b91c1c"}}>오류: {wlErr}</span>}
          </div>

          <div className="card">
            <div className="card-body">
              {wlLoading ? <div style={{color:"#94a3b8"}}>불러오는 중…</div> : (
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>작성일</th><th>이름</th><th>파일</th><th>서명</th><th>상태</th><th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWl.length===0 ? (
                        <tr><td colSpan={6} style={{padding:12, color:"#94a3b8"}}>표시할 근무일지가 없습니다.</td></tr>
                      ) : filteredWl.map(w=>(
                        <tr key={w.id}>
                          <td>{w.date || w.createdAt?.slice(0,10)}</td>
                          <td>{w.name}</td>
                          <td><a className="btn-ghost" href={`${API_BASE}/static/${w.filePath}`} target="_blank" rel="noreferrer">열기</a></td>
                          <td>{w.signature ? <img className="sig-thumb" src={w.signature} alt="sign" /> : <span style={{ color: "#94a3b8" }}>없음</span>}</td>
                          <td><StatusBadge s={w.status as Status} /></td>
                          <td style={{display:"flex", gap:8}}>
                            {w.status==="Pending" ? (
                              <>
                                <button className="btn btn-blue" onClick={()=>updateWorklogStatus(w.id,"Approved")}>승인</button>
                                <button className="btn btn-red" onClick={()=>updateWorklogStatus(w.id,"Rejected")}>거절</button>
                              </>
                            ) : <span style={{color:"#64748b"}}>-</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {signOpen && (
        <div className="modal" onClick={() => !signBusy && setSignOpen(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <div className="modal-head">승인 서명</div>
            <div className="modal-sub">승인을 위해 서명을 입력하세요.</div>
            <SignaturePad onChange={setSignDataUrl} />
            {signErr && <p style={{ color: "#dc2626", marginTop: 8 }}>{signErr}</p>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button className="btn btn-ghost" disabled={signBusy} onClick={()=>setSignOpen(false)}>취소</button>
              <button className="btn btn-blue" disabled={signBusy} onClick={submitApproval}>
                {signBusy ? "승인 중…" : "서명하고 승인"}
              </button>
            </div>
          </div>
        </div>
      )}

    </PageShell>
  );
}
