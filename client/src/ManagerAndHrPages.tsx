// ManagerAndHrPages.tsx — cleaned & consolidated
import React, { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { exportTightSignatureDataURL } from './signatureTrim';
const API_BASE = "http://localhost:4000";


/* ---------------- Types ---------------- */
type LeaveType = "연차" | "반차" | "병가" | "경조사";
type Status = "Pending" | "Approved" | "Rejected" | "Canceled";
// HRAdminPage.tsx (발췌)
type TemplateName = string;

/* ---------------- HR Admin Page — Tabs: 연차관리 / 근무일지 ---------------- */
type WorklogRow = {
  id: string;
  date: string;
  empId: string;
  name: string;
  dept: string;
  position: string;
  note?: string;
  fileName: string;
  filePath: string;     // 예: "doc_data/worklogs/xxx.xlsx" 또는 "worklogs/xxx.xlsx"
  signature: string;    // data URL
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
};



export interface LeaveRequestAPI {
  requestId: string;
  dateRequested: string;
  empId: string;
  name: string;
  dept: string;
  position: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  note?: string;
  status: Status;
  signature?: string;          // 직원 서명 (data URL)
  managerSignature?: string;   // 관리자 승인 서명 (data URL)
  managerSignerId?: string;
  managerSignedAt?: string;
  handoverPerson?: string;
  contact?: string;
}

/* ---------------- Utils ---------------- */
const STATUS_KO: Record<Status, string> = {
  Pending: "대기",
  Approved: "승인",
  Rejected: "거절",
  Canceled: "취소",
};

function StatusBadge({ s }: { s: Status }) {
  const label = STATUS_KO[s];
  const cls =
    s === "Approved" ? "status-badge status-approved" :
    s === "Rejected" ? "status-badge status-rejected" :
    s === "Canceled" ? "status-badge status-canceled" :
    "status-badge status-pending";
  return <span className={cls}>{label}</span>;
}

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const m = /^data:image\/(png|jpeg);base64,/.exec(dataUrl);
  if (!m) throw new Error("Invalid image data URL");
  const b64 = dataUrl.split(",")[1];
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

// 토큰 자동 부착 fetch (401 방지)
async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = localStorage.getItem("lm_token");
  const headers = new Headers(init.headers || {});
  const url = typeof input === "string" ? input : String(input);
  if (token && url.startsWith(API_BASE)) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

function fmtReqDate(dateStr: string) {
  // "XXXX년          XX월          XX일"  (년–월, 월–일 사이 공백 10칸)
  const [y, m, d] = dateStr.split("-");
  const SP10 = "          ";
  return `${y}년${SP10}${m}월${SP10}${d}일`;
}

function fmtStart(dateStr: string) {
  // "XXXX 년        XX    월      XX    일   부터"
  // 공백 개수를 요구사항대로 고정
  const [y, m, d] = dateStr.split("-");
  const SP8 = "        ";  // 년 뒤 8칸
  const SP4 = "    ";      // 월 앞/뒤 4칸 용도
  const SP6 = "      ";    // '월' 뒤 6칸
  const SP3 = "   ";       // '일' 뒤 3칸
  return `${y} 년${SP8}${m}${SP4} 월${SP6}${d}${SP3} 일   부터`;
}

function fmtEnd(dateStr: string) {
  // "XXXX 년        XX    월      XX    일   까지"
  const [y, m, d] = dateStr.split("-");
  const SP8 = "        ";
  const SP4 = "    ";
  const SP6 = "      ";
  const SP3 = "   ";
  return `${y} 년${SP8}${m}${SP4} 월${SP6}${d}${SP3} 일   까지`;
}

function injectCleanTheme() {
  const id = "__mgr_clean_theme__";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.innerHTML = `
  /* 기본 레이아웃 */
  .page-wrap{max-width:1200px;margin:0 auto;padding:24px}
  .mgr{--bg:#fff;--ink:#0f172a;--muted:#64748b;--line:#e5e7eb;--chip:#f8fafc}
  .mgr *{box-sizing:border-box}

  /* 헤더/탭 */
  .mgr .shell{background:var(--bg);min-height:calc(100vh - 3rem)}
  .mgr .header{display:flex;justify-content:space-between;align-items:center;margin:0 0 16px}
  .mgr .title{font-size:22px;font-weight:800;color:var(--ink);letter-spacing:.2px}
  .mgr .tabs{display:flex;gap:8px}
  .mgr .tab{border:2px solid var(--line);background:#fff;border-radius:999px;padding:10px 14px;font-weight:800;color:#334155;cursor:pointer}
  .mgr .tab[aria-pressed="true"]{background:#2563eb;border-color:#2563eb;color:#fff;box-shadow:0 2px 10px rgba(37,99,235,.25)}

  /* 툴바 */
  .mgr .toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0 14px}
  .mgr .sel,.mgr .inp{border:2px solid var(--line);border-radius:12px;padding:10px 12px;background:#fff;font-weight:700;color:#0f172a}
  .mgr .inp{min-width:200px}
  .mgr .badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:2px solid var(--line);border-radius:999px;background:#fff;font-weight:800;color:#1e293b}
  .mgr .chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:2px solid var(--line);border-radius:999px;background:var(--chip);color:#334155;font-weight:800}

  /* 카드 */
  .mgr .card{border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.05)}
  .mgr .card-body{padding:12px}

  /* 테이블 */
  .mgr .tbl-wrap{overflow:auto;border-radius:14px}
  .mgr table{width:100%;border-collapse:separate;border-spacing:0;background:#fff}
  .mgr thead th{position:sticky;top:0;background:#f8fafc;color:#0f172a;font-weight:900;font-size:14px;letter-spacing:.2px;padding:12px 14px;border-bottom:1px solid var(--line);white-space:nowrap;z-index:1}
  .mgr tbody td{padding:12px 14px;border-top:1px solid #f1f5f9;font-size:14px;color:#1e293b;vertical-align:middle;white-space:nowrap}
  .mgr tbody tr:hover{background:#fafafa}
  .mgr .td-ellipsis{max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

  /* 상태 배지 */
  .status-badge{display:inline-block;min-width:110px;text-align:center;padding:8px 16px;font-size:14px;font-weight:900;border-radius:999px;letter-spacing:.2px}
  .status-pending  {background:#ffedd5;color:#ea580c;border:2px solid #ea580c}
  .status-approved {background:#dbeafe;color:#2563eb;border:2px solid #2563eb}
  .status-rejected {background:#fee2e2;color:#dc2626;border:2px solid #dc2626}
  .status-canceled {background:#e2e8f0;color:#475569;border:2px solid #475569}

  /* 이미지 */
  .sig-thumb{width:96px;height:56px;object-fit:contain;border:1px solid #cbd5e1;border-radius:10px;background:#fff}

  /* 버튼 시스템 */
  .btn{appearance:none;border:0;padding:10px 14px;border-radius:12px;font-weight:900;font-size:14px;cursor:pointer;user-select:none;transition:transform .05s ease,box-shadow .18s ease,opacity .15s ease}
  .btn:active{transform:translateY(1px)}
  .btn-primary{background:#111827;color:#fff;box-shadow:0 2px 8px rgba(17,24,39,.15)}
  .btn-ghost{background:#fff;color:#0f172a;border:2px solid var(--line)}
  .btn-ghost:hover{background:#f8fafc}
  .btn-blue{background:#2563eb;color:#fff;box-shadow:0 4px 12px rgba(37,99,235,.25)}
  .btn-red{background:#dc2626;color:#fff;box-shadow:0 4px 12px rgba(220,38,38,.25)}
  .btn-grey{background:#475569;color:#fff}

  /* 모달 */
  .modal{position:fixed;inset:0;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;padding:24px;z-index:50}
  .modal-card{background:#fff;border-radius:18px;max-width:90vw;max-height:90vh;overflow:auto;padding:20px 22px;box-shadow:0 16px 40px rgba(0,0,0,.25)}
  .modal-head{font-weight:900;font-size:18px;color:#0f172a;margin-bottom:8px}
  .modal-sub{color:#334155;font-size:14px;margin-bottom:12px}
  `;
  document.head.appendChild(s);
}

/* ---------------- Signature Pad ---------------- */
function SignaturePad({
  onChange,
  targetCssHeight = 60,        // 저장 이미지 최종 높이(px, CSS 기준) — 필요시 조정
  padCssWidth = 520,
  padCssHeight = 180
}: {
  onChange: (dataUrl: string | null) => void;
  targetCssHeight?: number;
  padCssWidth?: number;
  padCssHeight?: number;
}) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const drawing = React.useRef(false);

  // 한번만 초기화 (DPR 스케일 포함)
  React.useEffect(() => {
    const cvs = ref.current!;
    const ctx = cvs.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    cvs.width = Math.floor(padCssWidth * dpr);
    cvs.height = Math.floor(padCssHeight * dpr);
    cvs.style.width = padCssWidth + "px";
    cvs.style.height = padCssHeight + "px";

    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";

    // 흰 배경
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, padCssWidth, padCssHeight);
  }, [padCssWidth, padCssHeight]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = ref.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);

    const cvs = ref.current!;
    const trimmed = trimSignatureCanvas(cvs, targetCssHeight);
    onChange(trimmed);
  };

  const clear = () => {
    const cvs = ref.current!;
    const ctx = cvs.getContext("2d")!;
    // transform 건들지 말고 흰 배경만 다시 칠함 (지워지는 버그 방지)
    ctx.fillStyle = "#fff";
    // 주의: 여긴 내부 픽셀 단위
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={ref}
        width={padCssWidth}
        height={padCssHeight}
        className="sig-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn-ghost" onClick={clear}>지우기</button>
      </div>
    </div>
  );
}

/** 
 * 캔버스의 흰색 여백을 자동으로 제거하고(트리밍), 배경은 흰색으로 유지한 채
 * targetCssHeight에 맞춰 비율 유지 리사이즈하여 PNG dataURL 반환.
 */
function trimSignatureCanvas(
  sourceCanvas: HTMLCanvasElement,
  targetCssHeight = 60
): string | null {
  const sCtx = sourceCanvas.getContext("2d")!;
  const sw = sourceCanvas.width;   // 내부 픽셀
  const sh = sourceCanvas.height;

  // 픽셀 데이터 가져오기
  const img = sCtx.getImageData(0, 0, sw, sh);
  const data = img.data;

  // 흰색 판정 임계값 (조금 회색도 흰색 취급)
  const WHITE_THR = 245; // 0~255, 클수록 더 엄격
  const hasInk = (i: number) => {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a === 0) return false;
    // 완전 흰색(또는 거의 흰색)이면 여백으로 간주
    return !(r >= WHITE_THR && g >= WHITE_THR && b >= WHITE_THR);
  };

  // 경계 찾기
  let top = sh, left = sw, right = -1, bottom = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      if (hasInk(idx)) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  // 아무것도 그려지지 않았다면 null
  if (right < 0 || bottom < 0) return null;

  // 패딩(내부 픽셀 기준) — 너무 딱 붙지 않게 여유
  const PAD = Math.round(Math.min(sw, sh) * 0.03);
  left = Math.max(0, left - PAD);
  top = Math.max(0, top - PAD);
  right = Math.min(sw - 1, right + PAD);
  bottom = Math.min(sh - 1, bottom + PAD);

  const tw = right - left + 1;
  const th = bottom - top + 1;

  // 잘라낸 결과를 임시 캔버스로 복사 (배경 흰색 유지)
  const tmp = document.createElement("canvas");
  tmp.width = tw;
  tmp.height = th;
  const tCtx = tmp.getContext("2d")!;
  tCtx.fillStyle = "#fff";
  tCtx.fillRect(0, 0, tw, th);
  tCtx.drawImage(sourceCanvas, left, top, tw, th, 0, 0, tw, th);

  // 요청한 CSS 높이에 맞추어 최종 리사이즈 (DPR 고려 없음: dataURL로 저장할 목적)
  const scale = targetCssHeight / th;
  const outW = Math.max(1, Math.round(tw * scale));
  const outH = Math.max(1, Math.round(th * scale));

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const oCtx = out.getContext("2d")!;
  oCtx.imageSmoothingEnabled = true;
  oCtx.imageSmoothingQuality = "high";
  oCtx.fillStyle = "#fff";
  oCtx.fillRect(0, 0, outW, outH);
  oCtx.drawImage(tmp, 0, 0, outW, outH);

  return out.toDataURL("image/png");
}


/* ---------------- Manager Review Page ---------------- */
/* ---------------- Manager Review Page — refined UI (same features) ---------------- */
export function ManagerReviewPage() {
  //injectWhiteTheme();   // ✅ 이걸 호출
  injectCleanTheme();

  // ── 탭 상태: requests | worklogs
  const [tab, setTab] = useState<'requests' | 'worklogs'>('requests');

  React.useEffect(() => {
  const id = "__mgr_light_style__";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.innerHTML = `
    .mgr * { box-sizing: border-box }

    /* 배경 전체 */
    .mgr .shell {
      background:#f9fafb;
      min-height:calc(100vh - 4rem);
      padding:20px;
      border-radius:12px;
      color:#1e293b;
    }

    /* 제목 */
    .mgr .title{
      font-weight:800;
      font-size:22px;
      color:#0f172a;
      margin-bottom:16px;
    }

    /* 테이블 */
    .mgr table{
      border-collapse:collapse;
      width:100%;
      background:#fff;
      border-radius:12px;
      overflow:hidden;
      box-shadow:0 2px 6px rgba(0,0,0,0.05);
    }
    .mgr thead th{
      background:#f1f5f9;
      color:#0f172a;
      font-weight:700;
      font-size:14px;
      padding:14px;
      border-bottom:1px solid #e2e8f0;
    }
    .mgr tbody td{
      padding:14px;
      border-top:1px solid #f1f5f9;
      font-size:15px;
      font-weight:500;
      color:#1e293b;
    }
    .mgr .row:hover{ background:#f9fafb }

    /* 서명 썸네일 */
    .mgr .sig-thumb{
      width:90px;height:54px;
      object-fit:contain;
      border:1px solid #cbd5e1;
      border-radius:6px;
      background:#fff;
    }

    /* 상태 배지 */
    .mgr .status-badge{
      display:inline-block;
      min-width:80px;
      text-align:center;
      padding:6px 14px;
      font-size:15px;
      font-weight:700;
      border-radius:999px;
    }
    .mgr .status-pending{ background:#ffedd5; color:#ea580c; border:1px solid #ea580c }
    .mgr .status-approved{ background:#dcfce7; color:#16a34a; border:1px solid #16a34a }
    .mgr .status-rejected{ background:#fee2e2; color:#dc2626; border:1px solid #dc2626 }
    .mgr .status-canceled{ background:#e2e8f0; color:#475569; border:1px solid #475569 }

    /* 버튼 */
    .mgr .btn{
      padding:8px 14px;
      border-radius:8px;
      font-weight:600;
      font-size:14px;
      cursor:pointer;
      transition: all .2s;
    }
    .mgr .btn:hover{ opacity:.9 }
    .mgr .btn-approve{ background:#16a34a; color:#fff; border:0 }
    .mgr .btn-reject{ background:#dc2626; color:#fff; border:0 }
    .mgr .btn-primary{ background:#2563eb; color:#fff; border:0 }
    .mgr .btn-ghost{ background:#fff; color:#334155; border:1px solid #cbd5e1 }
    
    /* 모달 */
    .mgr .modal{position:fixed;inset:0;background:rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;padding:24px;z-index:50}
    .mgr .modal-card{background:#fff;border-radius:12px;
      max-width:90vw;max-height:90vh;overflow:auto;padding:20px;
      box-shadow:0 4px 12px rgba(0,0,0,.15)}
    .mgr .modal-head{font-weight:700;font-size:18px;color:#0f172a;margin-bottom:8px}
    .mgr .modal-sub{color:#334155;font-size:14px;margin-bottom:12px}
  `;
  document.head.appendChild(s);
  return () => { try { s.remove(); } catch {} };
}, []);
  const [rows, setRows] = useState<LeaveRequestAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 상태 필터: "전체" | 실제 Status
  const statusOptions: ("전체" | Status)[] = ["전체", "Pending", "Approved", "Rejected", "Canceled"];
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>("Pending");

  // 승인 서명 모달 상태
  const [signOpen, setSignOpen] = useState(false);
  const [signTargetId, setSignTargetId] = useState<string | null>(null);
  const [signDataUrl, setSignDataUrl] = useState<string | null>(null);
  const [signBusy, setSignBusy] = useState(false);
  const [signErr, setSignErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await authFetch(`${API_BASE}/api/requests`, { method: "GET" });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "목록 조회 실패");
      setRows(j.data as LeaveRequestAPI[]);
    } catch (e: any) {
      setErr(e?.message || "목록 조회 실패");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = rows.slice();
    if (statusFilter !== "전체") list = list.filter(r => r.status === statusFilter);
    list.sort((a, b) => (a.dateRequested < b.dateRequested ? 1 : -1));
    return list;
  }, [rows, statusFilter]);

  async function reject(id: string) {
    try {
      const r = await authFetch(`${API_BASE}/api/requests/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Rejected" })
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "거절 실패");
      await load();
    } catch (e: any) {
      alert(e?.message || "거절 실패");
    }
  }

  // ── 근무일지 목록 상태/로직 추가 ─────────────────────────────
  const [wls, setWls] = useState<WorklogRow[]>([]);
  const [wlErr, setWlErr] = useState<string|null>(null);
  const [wlLoading, setWlLoading] = useState(false);
  const [wlStatus, setWlStatus] = useState<'전체'|'Pending'|'Approved'|'Rejected'>('전체');

  async function loadWorklogs(){
    setWlLoading(true); setWlErr(null);
    try{
      const r = await authFetch(`${API_BASE}/api/worklogs`, { method:'GET' });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || '근무일지 조회 실패');
      setWls(j.data as WorklogRow[]);
    }catch(e:any){
      setWlErr(e?.message || '근무일지 조회 실패');
    }finally{
      setWlLoading(false);
    }
  }

  useEffect(()=>{ 
    // 초기엔 연차 탭 로딩, 근무일지 탭으로 바꾸면 로드
    if (tab === 'worklogs') loadWorklogs();
  }, [tab]);

  const filteredWl = useMemo(()=>{
    let list = wls.slice();
    if (wlStatus !== '전체') list = list.filter(x=>x.status === wlStatus);
    return list;
  }, [wls, wlStatus]);

  async function updateWorklogStatus(id:string, status:'Approved'|'Rejected'){
    try{
      const r = await authFetch(`${API_BASE}/api/worklogs/${id}/status`, {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status })
      });
      const j = await r.json();
      if(!r.ok || !j?.ok) throw new Error(j?.error || '상태 변경 실패');
      await loadWorklogs();
    }catch(e:any){
      alert(e?.message || '상태 변경 실패');
    }
  }
  const openApproveWithSign = (id: string) => {
    setSignTargetId(id);
    setSignDataUrl(null);
    setSignErr(null);
    setSignOpen(true);
  };

  const submitApproval = async () => {
    if (!signTargetId) return;
    if (!signDataUrl || !/^data:image\/(png|jpeg);base64,/.test(signDataUrl)) {
      setSignErr("서명을 입력하세요.");
      return;
    }
    setSignBusy(true); setSignErr(null);
    try {
      const r = await authFetch(`${API_BASE}/api/requests/${signTargetId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl: signDataUrl })
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "승인 실패");
      setSignOpen(false);
      await load();
    } catch (e: any) {
      setSignErr(e?.message || "승인 실패");
    } finally {
      setSignBusy(false);
    }
  };

  return (
    <div className="page-wrap">
      <div className="mgr">
        <div className="shell">
          <div className="header">
            <div className="title">상사 검토</div>
            <div className="tabs">
              <button className="tab" onClick={()=>setTab('requests')} aria-pressed={tab==='requests'}>연차 신청</button>
              <button className="tab" onClick={()=>setTab('worklogs')} aria-pressed={tab==='worklogs'}>근무일지</button>
            </div>
          </div>

          {tab==='requests' && (
            <div className="toolbar">
              <span className="chip">상태</span>
              <select className="sel" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                {statusOptions.map(s => <option key={s} value={s}>{s === "전체" ? "전체" : STATUS_KO[s]}</option>)}
              </select>
              <button className="btn btn-primary" onClick={load}>새로고침</button>
              {err && <span className="badge">오류: {err}</span>}
            </div>
          )}

          {tab==='requests' && (
            <div className="card">
              <div className="card-body">
                {loading ? (
                  <div className="td-ellipsis" style={{color:"#94a3b8"}}>불러오는 중…</div>
                ) : (
                  <div className="tbl-wrap">
                    <table>
                      <thead> ... </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr><td colSpan={11} style={{padding:16,color:"#93a3af"}}>표시할 데이터가 없습니다.</td></tr>
                        ) : filtered.map(r => {
                          const isPending = r.status === "Pending";
                          return (
                            <tr key={r.requestId}>
                              ...
                              <td style={{display:"flex",gap:8}}>
                                {isPending ? (
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
          )}

          {tab==='worklogs' && (
            <div className="toolbar">
              <select className="sel" value={wlStatus} onChange={e=>setWlStatus(e.target.value as any)}>
                {(['전체','Pending','Approved','Rejected'] as const).map(s =>
                  <option key={s} value={s}>{s==='전체' ? '전체' : STATUS_KO[s as Status]}</option>
                )}
              </select>
              <button className="btn btn-primary" onClick={loadWorklogs}>새로고침</button>
              {wlErr && <span className="badge">오류: {wlErr}</span>}
            </div>
          )}

          {tab==='worklogs' && (
            <div className="card">
              <div className="card-body">
                {wlLoading ? (
                  <div style={{color:"#94a3b8"}}>불러오는 중…</div>
                ) : (
                  <div className="tbl-wrap">
                    <table>
                      <thead> ... </thead>
                      <tbody>
                        {filteredWl.length===0 ? (
                          <tr><td colSpan={6} style={{padding:16,color:"#93a3af"}}>표시할 근무일지가 없습니다.</td></tr>
                        ) : filteredWl.map(w=>(
                          <tr key={w.id}>
                            ...
                            <td style={{display:'flex',gap:8}}>
                              {w.status==='Pending' ? (
                                <>
                                  <button className="btn btn-blue" onClick={()=>updateWorklogStatus(w.id,'Approved')}>승인</button>
                                  <button className="btn btn-red"  onClick={()=>updateWorklogStatus(w.id,'Rejected')}>거절</button>
                                </>
                              ) : <span style={{color:'#64748b'}}>-</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {signOpen && (
            <div className="modal" onClick={() => !signBusy && setSignOpen(false)}>
              <div className="modal-card" onClick={e => e.stopPropagation()}>
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
        </div>
      </div>
    </div>
  );
}



/* ---------------- HR Admin Page ---------------- */
export function HRAdminPage() {
  // 화이트 테마
  injectCleanTheme();

  // ───────────────────────── 공통 상태
  const [activeTab, setActiveTab] = useState<"leave" | "worklog">("leave");

  // ───────────────────────── 연차관리 상태
  const [rows, setRows] = useState<LeaveRequestAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const deptList = ["전체", "개발팀", "생산지원팀", "생산팀", "공무팀"] as const;
  const statusList: ("전체" | Status)[] = ["전체", "Pending", "Approved", "Rejected", "Canceled"];
  const [dept, setDept] = useState<(typeof deptList)[number]>("전체");
  const [status, setStatus] = useState<(typeof statusList)[number]>("전체");
  const [q, setQ] = useState("");

  // 서버 템플릿
  const [templates, setTemplates] = useState<string[]>([]);
  const [tpl, setTpl] = useState<string>("");

  // ───────────────────────── 근무일지 상태
  const [wls, setWls] = useState<WorklogRow[]>([]);
  const [wlLoading, setWlLoading] = useState(false);
  const [wlErr, setWlErr] = useState<string | null>(null);
  const [wlStatus, setWlStatus] = useState<"전체" | "Pending" | "Approved" | "Rejected">("전체");

  /* ========== 초기 로드 ========== */
  useEffect(() => { loadLeaveRecent(); }, []);
  useEffect(() => { loadTemplates(); }, []);
  useEffect(() => {
    if (activeTab === "worklog") loadWorklogs();
  }, [activeTab]);

  /* ========== 연차: 데이터/템플릿 로드 ========== */
  async function loadLeaveRecent() {
    setLoading(true); setError(null);
    try {
      const r = await authFetch(`${API_BASE}/api/requests/recent`);
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "목록 조회 실패");
      setRows(j.data as LeaveRequestAPI[]);
    } catch (e: any) {
      setError(e?.message || "목록 조회 실패");
    } finally { setLoading(false); }
  }

  async function loadTemplates() {
    try {
      const r = await authFetch(`${API_BASE}/api/templates`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setTemplates(j.data as string[]);
      if ((j.data as string[]).length > 0) setTpl(j.data[0]);
    } catch (e) {
      // 템플릿이 없을 수도 있으므로 조용히 무시
      setTemplates([]);
      setTpl("");
    }
  }

  async function fetchTemplateBuffer(templateName: string): Promise<ArrayBuffer> {
    const url = `${API_BASE}/api/templates/${encodeURIComponent(templateName)}`;
    const r = await authFetch(url, { cache: "no-store" });
    if (!r.ok) {
      const tx = await r.text().catch(() => "");
      throw new Error(`템플릿 다운로드 실패: ${r.status} ${tx}`);
    }
    return r.arrayBuffer();
  }

  const filteredLeaves = useMemo(() => {
    return rows.filter(r => {
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

  /* ========== 연차: 엑셀 생성 ========== */
  async function handleMakeFile(r: LeaveRequestAPI) {
    try {
      await makeExcelForRowFromTemplate(r);
      alert("엑셀 파일을 생성했습니다.");
    } catch (e: any) {
      console.error("[HR] make file error:", e);
      alert(`파일 생성에 실패했습니다: ${e?.message || e}`);
    }
  }

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
    } catch (e) {
      console.warn("이미지 삽입 실패:", e);
    }

    const filename = `HR_${r.empId}_${r.name}_${r.dateRequested}.xlsx`;
    const out = await wb.xlsx.writeBuffer();
    saveAs(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
  }

  /* ========== 근무일지: 목록/상태 변경 ========== */
  async function loadWorklogs() {
    setWlLoading(true); setWlErr(null);
    try {
      const r = await authFetch(`${API_BASE}/api/worklogs`);
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "근무일지 조회 실패");
      setWls(j.data as WorklogRow[]);
    } catch (e: any) {
      setWlErr(e?.message || "근무일지 조회 실패");
    } finally {
      setWlLoading(false);
    }
  }

  const filteredWl = useMemo(() => {
    let list = wls.slice();
    if (wlStatus !== "전체") list = list.filter(x => x.status === wlStatus);
    return list;
  }, [wls, wlStatus]);

  async function updateWorklogStatus(id: string, status: "Approved" | "Rejected") {
    try {
      const r = await authFetch(`${API_BASE}/api/worklogs/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "상태 변경 실패");
      await loadWorklogs();
    } catch (e: any) {
      alert(e?.message || "상태 변경 실패");
    }
  }

  /* ========== 렌더링 ========== */
  return (
    <div className="mgr">
      <div className="shell">
        {/* 탭 헤더 */}
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12}}>
          <div className="title">인사 관리자</div>
          <div style={{display:"flex", gap:8}}>
            <button
              className="btn-ghost"
              aria-pressed={activeTab==='leave'}
              onClick={()=>setActiveTab('leave')}
            >연차관리</button>
            <button
              className="btn-ghost"
              aria-pressed={activeTab==='worklog'}
              onClick={()=>setActiveTab('worklog')}
            >근무일지</button>
          </div>
        </div>

        {/* 툴바 */}
        {activeTab === "leave" ? (
          <div className="toolbar">
            <select className="sel" value={dept} onChange={e => setDept(e.target.value as any)}>
              {deptList.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="sel" value={status} onChange={e => setStatus(e.target.value as any)}>
              {statusList.map(s => <option key={s} value={s}>{s === "전체" ? "전체" : STATUS_KO[s]}</option>)}
            </select>
            <input className="inp" placeholder="이름/사번 검색" value={q} onChange={e => setQ(e.target.value)} />
            <select className="sel" value={tpl} onChange={e => setTpl(e.target.value)}>
              {templates.length === 0
                ? <option value="">(서버 템플릿 없음)</option>
                : templates.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <button className="btn btn-primary" onClick={loadTemplates}>템플릿 새로고침</button>
            <button className="btn btn-ghost" onClick={loadLeaveRecent}>새로고침</button>
            <span className="badge">표시 {filteredLeaves.length}건</span>
          </div>
        ) : (
          <div className="toolbar">
            <select className="sel" value={wlStatus} onChange={e=>setWlStatus(e.target.value as any)}>
              {(['전체','Pending','Approved','Rejected'] as const).map(s =>
                <option key={s} value={s}>{s==='전체' ? '전체' : STATUS_KO[s as Status]}</option>
              )}
            </select>
            <button className="btn btn-ghost" onClick={loadWorklogs}>새로고침</button>
            {wlErr && <span className="badge" style={{borderColor:'#fecaca', color:'#b91c1c'}}>오류: {wlErr}</span>}
            <span className="badge">표시 {filteredWl.length}건</span>
          </div>
        )}

        {/* 콘텐츠 */}
        {activeTab === "leave" ? (
          <div className="card">
            {loading ? (
              <div style={{padding:18, color:"#94a3b8"}}>불러오는 중…</div>
            ) : error ? (
              <div style={{padding:18, color:"#b91c1c"}}>오류: {error}</div>
            ) : (
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>신청일</th><th>사번</th><th>이름</th><th>부서</th><th>직급</th>
                      <th>연차종류</th><th>기간</th><th>상태</th><th>직원 서명</th><th>관리자 서명</th><th>파일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaves.length === 0 ? (
                      <tr><td colSpan={11} style={{padding:16, color:"#93a3af"}}>표시할 데이터가 없습니다.</td></tr>
                    ) : filteredLeaves.map(r => (
                      <tr key={r.requestId} className="row">
                        <td>{r.dateRequested}</td>
                        <td>{r.empId}</td>
                        <td>{r.name}</td>
                        <td>{r.dept}</td>
                        <td>{r.position}</td>
                        <td>{r.leaveType}</td>
                        <td>{r.startDate} ~ {r.endDate}</td>
                        <td><StatusBadge s={r.status} /></td>
                        <td>{r.signature ? <img className="sig-thumb" src={r.signature} alt="signature" /> : <span style={{ color: "#94a3b8" }}>없음</span>}</td>
                        <td>{r.managerSignature ? <img className="sig-thumb" src={r.managerSignature} alt="mgr-signature" /> : <span style={{ color: "#94a3b8" }}>없음</span>}</td>
                        <td>
                          <button className="btn btn-approve-blue" onClick={() => handleMakeFile(r)}>파일 만들기</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="card">
            {wlLoading ? (
              <div style={{padding:18, color:"#94a3b8"}}>불러오는 중…</div>
            ) : (
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>작성일</th><th>사번</th><th>이름</th><th>부서</th><th>직급</th>
                      <th>비고</th><th>파일</th><th>서명</th><th>상태</th><th>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWl.length === 0 ? (
                      <tr><td colSpan={10} style={{padding:16, color:"#93a3af"}}>표시할 근무일지가 없습니다.</td></tr>
                    ) : filteredWl.map(w => (
                      <tr key={w.id} className="row">
                        <td>{w.date || w.createdAt?.slice(0,10)}</td>
                        <td>{w.empId}</td>
                        <td>{w.name}</td>
                        <td>{w.dept}</td>
                        <td>{w.position}</td>
                        <td>{w.note || "-"}</td>
                        <td>
                          <a className="btn-ghost" href={`${API_BASE}/static/${w.filePath}`} target="_blank" rel="noreferrer">열기</a>
                        </td>
                        <td>
                          {w.signature
                            ? <img className="sig-thumb" src={w.signature} alt="sign" />
                            : <span style={{ color: "#94a3b8" }}>없음</span>}
                        </td>
                        <td><StatusBadge s={w.status as Status} /></td>
                        <td style={{display:"flex", gap:8}}>
                          {w.status === "Pending" ? (
                            <>
                              <button className="btn btn-approve-blue" onClick={()=>updateWorklogStatus(w.id, "Approved")}>승인</button>
                              <button className="btn btn-reject-red" onClick={()=>updateWorklogStatus(w.id, "Rejected")}>거절</button>
                            </>
                          ) : <span style={{ color:"#64748b" }}>-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
