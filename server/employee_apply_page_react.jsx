import React, { useEffect, useMemo, useState } from "react";

// --- Types ---------------------------------------------------------------
type LeaveType = "연차" | "반차" | "병가" | "경조사";

interface LeaveRequest {
  RequestID: string;
  DateRequested: string;
  EmpID: string;
  Name: string;
  Dept: string;
  Position: string;
  LeaveType: LeaveType;
  StartDate: string; // 신청일(시작)
  EndDate: string;   // 마지막일(종료)
  Note?: string;     // 사유
}

// --- Helpers -------------------------------------------------------------
const LS_KEY = "employee_apply_requests";
const todayStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

function loadRequests(): LeaveRequest[] {
  try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
}
function saveRequests(reqs: LeaveRequest[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(reqs));
}

// --- Minimal styles injected on mount -----------------------------------
function useBasicStyles(){
  useEffect(()=>{
    const style = document.createElement('style');
    style.innerHTML = `
      .wrap{max-width:720px;margin:24px auto;padding:16px}
      .card{background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,0.04)}
      .title{font-weight:700;margin-bottom:12px}
      .input{display:block;width:100%;margin:6px 0;padding:10px;border:1px solid #d1d5db;border-radius:8px}
      .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;padding:10px 14px}
      .btn-primary{background:#2563eb;color:#fff}
      .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .muted{color:#6b7280;font-size:12px}
      .table{width:100%;font-size:14px;border-collapse:collapse}
      .table th,.table td{padding:8px;border-bottom:1px solid #eee;text-align:left}
      .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:50}
      .modal{background:#fff;border-radius:14px;padding:18px;min-width:300px;max-width:90vw}
    `;
    document.head.appendChild(style);
    return ()=>{ try{style.remove();}catch{} };
  },[]);
}

// --- Validation ----------------------------------------------------------
function validateForm(f: Partial<LeaveRequest>): string[] {
  const errs: string[] = [];
  if (!f.EmpID) errs.push("사번은 필수입니다.");
  if (!f.Name) errs.push("이름은 필수입니다.");
  if (!f.Position) errs.push("직급은 필수입니다.");
  if (!f.Dept) errs.push("부서는 필수입니다.");
  if (!f.LeaveType) errs.push("연차종류는 필수입니다.");
  if (!f.StartDate) errs.push("신청일(시작일)은 필수입니다.");
  if (!f.EndDate) errs.push("마지막일(종료일)은 필수입니다.");
  if (f.StartDate && f.EndDate) {
    const s = new Date(f.StartDate as string).getTime();
    const e = new Date(f.EndDate as string).getTime();
    if (!isNaN(s) && !isNaN(e) && e < s) errs.push("마지막일은 신청일보다 빠를 수 없습니다.");
  }
  if (!f.Note) errs.push("사유는 필수입니다.");
  return errs;
}

// --- Page ----------------------------------------------------------------
export default function EmployeeApplyPage(){
  useBasicStyles();

  const [requests, setRequests] = useState<LeaveRequest[]>(()=>loadRequests());
  useEffect(()=>{ saveRequests(requests); }, [requests]);

  const [form, setForm] = useState<Partial<LeaveRequest>>({
    RequestID: `R-${String((requests.length+1)).padStart(4,'0')}`,
    DateRequested: todayStr(),
    LeaveType: "연차",
    StartDate: todayStr(),
    EndDate: todayStr(),
    EmpID: "",
    Name: "",
    Position: "",
    Dept: "",
    Note: "개인사유",
  });

  const [dialog, setDialog] = useState<null | {type:'success'|'error'; title:string; message:React.ReactNode}>(null);

  const handleSubmit = () => {
    const errs = validateForm(form);
    if (errs.length){
      setDialog({ type:'error', title:'신청 실패', message:(<ul style={{paddingLeft:18}}>{errs.map((e,i)=>(<li key={i}>• {e}</li>))}</ul>) });
      return;
    }

    try{
      const req: LeaveRequest = {
        RequestID: form.RequestID!,
        DateRequested: todayStr(),
        EmpID: form.EmpID!,
        Name: form.Name!,
        Dept: form.Dept!,
        Position: form.Position!,
        LeaveType: form.LeaveType as LeaveType,
        StartDate: form.StartDate!,
        EndDate: form.EndDate!, // 마지막일까지
        Note: form.Note || "",
      };
      setRequests(prev => [req, ...prev]);
      setForm({
        RequestID: `R-${String((requests.length+2)).padStart(4,'0')}`,
        DateRequested: todayStr(),
        LeaveType: "연차",
        StartDate: todayStr(),
        EndDate: todayStr(),
        EmpID: "",
        Name: "",
        Position: "",
        Dept: "",
        Note: "개인사유",
      });
      setDialog({ type:'success', title:'신청 완료', message:'연차 신청이 접수되었습니다.' });
    }catch{
      setDialog({ type:'error', title:'신청 실패', message:'저장 중 오류가 발생했습니다.' });
    }
  };

  return (
    <div className="wrap">
      <div className="card">
        <div className="title">연차 신청 (직원 페이지)</div>
        <div className="row">
          <input className="input" placeholder="사번(EmpID)" value={form.EmpID||""} onChange={e=>setForm(f=>({...f, EmpID:e.target.value}))}/>
          <input className="input" placeholder="이름(Name)" value={form.Name||""} onChange={e=>setForm(f=>({...f, Name:e.target.value}))}/>
        </div>
        <div className="row">
          <input className="input" placeholder="직급(Position)" value={form.Position||""} onChange={e=>setForm(f=>({...f, Position:e.target.value}))}/>
          <input className="input" placeholder="부서(Dept)" value={form.Dept||""} onChange={e=>setForm(f=>({...f, Dept:e.target.value}))}/>
        </div>
        <div className="row">
          <select className="input" value={form.LeaveType} onChange={e=>setForm(f=>({...f, LeaveType:e.target.value as LeaveType}))}>
            <option value="연차">연차</option>
            <option value="반차">반차</option>
            <option value="병가">병가</option>
            <option value="경조사">경조사</option>
          </select>
          <input className="input" type="date" value={form.StartDate} onChange={e=>setForm(f=>({...f, StartDate:e.target.value}))}/>
        </div>
        <div className="row">
          <input className="input" type="date" value={form.EndDate} onChange={e=>setForm(f=>({...f, EndDate:e.target.value}))}/>
          <input className="input" placeholder="사유(Reason)" value={form.Note||""} onChange={e=>setForm(f=>({...f, Note:e.target.value}))}/>
        </div>
        <button className="btn btn-primary" onClick={handleSubmit}>신청</button>
        <div className="muted" style={{marginTop:8}}>필수: 사번·이름·직급·부서·연차종류·신청일·마지막일·사유</div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <div className="title">최근 신청</div>
        <div style={{overflowX:'auto'}}>
          <table className="table">
            <thead>
              <tr>
                <th>요청ID</th><th>사번</th><th>이름</th><th>부서</th><th>직급</th><th>종류</th><th>기간</th><th>사유</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r=> (
                <tr key={r.RequestID}>
                  <td>{r.RequestID}</td>
                  <td>{r.EmpID}</td>
                  <td>{r.Name}</td>
                  <td>{r.Dept}</td>
                  <td>{r.Position}</td>
                  <td>{r.LeaveType}</td>
                  <td>{r.StartDate} ~ {r.EndDate}</td>
                  <td>{r.Note}</td>
                </tr>
              ))}
              {requests.length===0 && (
                <tr><td colSpan={8}>아직 신청 내역이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {dialog && (
        <div className="modal-backdrop" onClick={()=>setDialog(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3 style={{fontWeight:700, marginBottom:8}}>{dialog.title}</h3>
            <div style={{marginBottom:12}}>{dialog.message}</div>
            <button className="btn btn-primary" onClick={()=>setDialog(null)}>확인</button>
          </div>
        </div>
      )}

      <Diagnostics />
    </div>
  );
}

// --- Diagnostics (light runtime tests) ----------------------------------
function Diagnostics(){
  const results = useMemo(runSelfTests, []);
  const pass = results.filter(r=>r.pass).length;
  return (
    <details className="card" style={{marginTop:16}}>
      <summary className="title">셀프테스트: {pass}/{results.length} 통과</summary>
      <ul className="muted" style={{paddingLeft:18}}>
        {results.map((r,i)=> <li key={i} style={{color:r.pass?'#166534':'#991b1b'}}>{r.name}: {r.pass?'PASS':'FAIL'} (got {String(r.got)} / want {String(r.want)})</li>)}
      </ul>
    </details>
  );
}

function runSelfTests(){
  type Res = {name:string; pass:boolean; got:any; want:any};
  const T: Res[] = [];
  const f: Partial<LeaveRequest> = { EmpID: '', Name: '', Position: '', Dept: '', LeaveType: '연차', StartDate: '', EndDate: '', Note: '' };
  const errs = validateForm(f);
  T.push({name:'필수값 검증 동작', pass: errs.length>=7, got: errs.length, want: '>=7'});
  // T2: 종료일이 시작일보다 빠른 경우 오류
  const f2: Partial<LeaveRequest> = { EmpID:'1', Name:'n', Position:'p', Dept:'d', LeaveType:'연차', StartDate:'2025-09-10', EndDate:'2025-09-09', Note:'개인사유' };
  const errs2 = validateForm(f2);
  T.push({name:'종료일 < 시작일 에러', pass: errs2.includes('마지막일은 신청일보다 빠를 수 없습니다.'), got: errs2.join('|'), want: 'contains rule'});
  // T3: 사유 기본값이 있을 때 사유 누락 에러가 없어야 함
  const f3: Partial<LeaveRequest> = { EmpID:'1', Name:'n', Position:'p', Dept:'d', LeaveType:'연차', StartDate:'2025-09-10', EndDate:'2025-09-10', Note:'개인사유' };
  const errs3 = validateForm(f3);
  T.push({name:'사유 기본값 허용', pass: !errs3.includes('사유는 필수입니다.'), got: errs3.join('|') || 'no-error-for-note', want: 'no "사유는 필수입니다."'});
  return T;
}
