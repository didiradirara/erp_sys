// src/pages/HRAdminPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { useAuth } from "../auth/AuthContext";
import {
  API_BASE, STATUS_KO, Status, LeaveRequestAPI, WorklogRow,
  dataUrlToUint8, fmtReqDate, fmtStart, fmtEnd,
  jsonFetch, injectCleanTheme, StatusBadge
} from "../components/hr/Shared";

export default function HRAdminPage() {
  injectCleanTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate("/login"); };

  const [activeTab, setActiveTab] = useState<"leave"|"worklog">("leave");

  // 연차
  const [rows, setRows] = useState<LeaveRequestAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  const deptList = ["전체", "개발팀", "생산지원팀", "생산팀", "공무팀"] as const;
  const statusList: ("전체"|Status)[] = ["전체","Pending","Approved","Rejected","Canceled"];

  const [dept, setDept] = useState<(typeof deptList)[number]>("전체");
  const [status, setStatus] = useState<(typeof statusList)[number]>("전체");
  const [q, setQ] = useState("");

  // 템플릿
  const [templates, setTemplates] = useState<string[]>([]);
  const [tpl, setTpl] = useState<string>("");

  // 근무일지
  const [wls, setWls] = useState<WorklogRow[]>([]);
  const [wlLoading, setWlLoading] = useState(false);
  const [wlErr, setWlErr] = useState<string|null>(null);
  const [wlStatus, setWlStatus] = useState<"전체"|"Pending"|"Approved"|"Rejected">("전체");

  useEffect(()=>{ loadLeaveRecent(); }, []);
  useEffect(()=>{ loadTemplates(); }, []);
  useEffect(()=>{ if (activeTab==="worklog") loadWorklogs(); }, [activeTab]);

  async function loadLeaveRecent() {
    setLoading(true); setError(null);
    try {
      const { ok, status, data } = await jsonFetch(`${API_BASE}/api/requests/recent`);
      if (!ok || (data as any)?.ok === false) {
        const msg = typeof data === "string" ? data : (data as any)?.error || `HTTP ${status}`;
        throw new Error(msg);
      }
      setRows((data as any).data as LeaveRequestAPI[]);
    } catch(e:any){
      setError(e?.message || "목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates() {
    try {
      const { ok, status, data } = await jsonFetch(`${API_BASE}/api/templates`, { cache: "no-store" as any });
      if (!ok || (data as any)?.ok === false) {
        const msg = typeof data === "string" ? data : (data as any)?.error || `HTTP ${status}`;
        throw new Error(msg);
      }
      const list = (data as any).data as string[];
      setTemplates(list);
      if (list.length) setTpl(list[0]);
    } catch {
      setTemplates([]); setTpl("");
    }
  }

  async function fetchTemplateBuffer(templateName: string): Promise<ArrayBuffer> {
    const url = `${API_BASE}/api/templates/${encodeURIComponent(templateName)}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`템플릿 다운로드 실패: HTTP ${r.status}`);
    return r.arrayBuffer();
  }

  const filteredLeaves = useMemo(()=>{
    return rows.filter(r=>{
      if (dept !== "전체" && r.dept !== dept) return false;
      if (status !== "전체" && r.status !== status) return false;
      if (q.trim()) {
        const key = q.trim().toLowerCase();
        const hay = `${r.empId} ${r.name}`.toLowerCase();
        if (!hay.includes(key)) return false;
      }
      return true;
    });
  }, [rows, dept, status, q]);

  async function makeExcelForRowFromTemplate(r: LeaveRequestAPI) {
    const wb = new ExcelJS.Workbook();

    if (tpl) {
      const buf = await fetchTemplateBuffer(tpl);
      await wb.xlsx.load(new Uint8Array(buf));
    } else {
      const ws0 = wb.addWorksheet("Leave Request");
      ws0.addRows([
        ["신청일", r.dateRequested],
        ["사번", r.empId],
        ["이름", r.name],
        ["부서", r.dept],
        ["직급", r.position],
        ["연차종류", r.leaveType],
        ["기간", `${r.startDate} ~ ${r.endDate}`],
        ["상태", STATUS_KO[r.status]],
        ["비고", r.note ?? ""],
        ["업무인수자", r.handoverPerson ?? ""],
        ["연락처", r.contact ?? ""]
      ]);
    }

    const ws = wb.worksheets[0] ?? wb.addWorksheet("인사계출");
    const set = (addr: string, v?: string) => { ws.getCell(addr).value = v ?? ""; };

    set("K21", fmtReqDate(r.dateRequested));
    set("C11", fmtStart(r.startDate));
    set("C13", fmtEnd(r.endDate));
    set("K5", r.empId);
    set("K4", r.name);
    set("T23", r.name);
    set("B4", r.dept);
    set("W4", r.position);
    set("AE4", r.leaveType);
    set("B16", r.note ?? "");
    set("B17", r.handoverPerson ?? "");
    set("P17", r.contact ?? "");

    try {
      if (r.signature) {
        const img1 = wb.addImage({
          buffer: dataUrlToUint8(r.signature),
          extension: r.signature.startsWith("data:image/jpeg") ? "jpeg" : "png",
        });
        ws.addImage(img1, { tl: { col: 8.8, row: 26.1 }, ext: { width: 80, height: 40 } });
        ws.addImage(img1, { tl: { col: 25.2, row: 21.8 }, ext: { width: 60, height: 35 } });
      }
      if (r.managerSignature) {
        const img2 = wb.addImage({
          buffer: dataUrlToUint8(r.managerSignature),
          extension: r.managerSignature.startsWith("data:image/jpeg") ? "jpeg" : "png",
        });
        ws.addImage(img2, { tl: { col: 23.8, row: 26.1 }, ext: { width: 80, height: 40 } });
      }
    } catch {}

    const filename = `HR_${r.empId}_${r.name}_${r.dateRequested}.xlsx`;
    const out = await wb.xlsx.writeBuffer();
    saveAs(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
  }

  async function loadWorklogs() {
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
    <div className="page-wrap mgr">
      <div className="shell">
        <div className="header">
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div className="title">인사 관리자</div>
            <div className="tabs">
              <button className="tab" aria-pressed={activeTab==="leave"} onClick={()=>setActiveTab("leave")}>연차관리</button>
              <button className="tab" aria-pressed={activeTab==="worklog"} onClick={()=>setActiveTab("worklog")}>근무일지</button>
            </div>
          </div>
          <button className="btn-ghost" onClick={handleLogout}>로그아웃</button>
        </div>

        {activeTab==="leave" ? (
          <>
            <div className="toolbar">
              <select className="sel" value={dept} onChange={e=>setDept(e.target.value as any)}>
                {deptList.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="sel" value={status} onChange={e=>setStatus(e.target.value as any)}>
                {statusList.map(s => <option key={s} value={s}>{s === "전체" ? "전체" : STATUS_KO[s]}</option>)}
              </select>
              <input className="inp" placeholder="이름/사번 검색" value={q} onChange={e=>setQ(e.target.value)} />
              <select className="sel" value={tpl} onChange={e=>setTpl(e.target.value)}>
                {templates.length === 0
                  ? <option value="">(서버 템플릿 없음)</option>
                  : templates.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <button className="btn btn-primary" onClick={loadTemplates}>템플릿 새로고침</button>
              <button className="btn btn-ghost" onClick={loadLeaveRecent}>새로고침</button>
              <span className="badge">표시 {filteredLeaves.length}건</span>
            </div>

            <div className="card">
              <div className="card-body">
                {loading ? <div style={{color:"#94a3b8"}}>불러오는 중…</div> : error ? (
                  <div className="badge" style={{borderColor:"#fecaca", color:"#b91c1c"}}>오류: {error}</div>
                ) : (
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>신청일</th><th>사번</th><th>이름</th><th>부서</th><th>직급</th>
                          <th>연차종류</th><th>기간</th><th>상태</th><th>파일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeaves.length===0 ? (
                          <tr><td colSpan={9} style={{padding:12, color:"#94a3b8"}}>표시할 데이터가 없습니다.</td></tr>
                        ) : filteredLeaves.map(r=>(
                          <tr key={r.requestId}>
                            <td>{r.dateRequested}</td>
                            <td>{r.empId}</td>
                            <td>{r.name}</td>
                            <td>{r.dept}</td>
                            <td>{r.position}</td>
                            <td>{r.leaveType}</td>
                            <td>{r.startDate} ~ {r.endDate}</td>
                            <td><StatusBadge s={r.status as Status} /></td>
                            <td><button className="btn btn-blue" onClick={()=>makeExcelForRowFromTemplate(r)}>파일 만들기</button></td>
                          </tr>
                        ))}
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
              <button className="btn btn-ghost" onClick={loadWorklogs}>새로고침</button>
              {wlErr && <span className="badge" style={{borderColor:'#fecaca', color:'#b91c1c'}}>오류: {wlErr}</span>}
              <span className="badge">표시 {filteredWl.length}건</span>
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

      </div>
    </div>
  );
}
