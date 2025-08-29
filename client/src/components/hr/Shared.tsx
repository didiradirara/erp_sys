// src/components/hr/Shared.ts
import React from "react";

export const API_BASE = "http://localhost:4000";

/* ---------- Types ---------- */
export type LeaveType = "연차" | "반차" | "병가" | "경조사";
export type Status = "Pending" | "Approved" | "Rejected" | "Canceled";

export type WorklogRow = {
  id: string;
  date?: string;
  empId?: string;
  name?: string;
  dept?: string;
  position?: string;
  note?: string;
  fileName?: string;
  filePath: string;
  signature?: string; // data URL
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
  signature?: string;
  managerSignature?: string;
  managerSignerId?: string;
  managerSignedAt?: string;
  handoverPerson?: string;
  contact?: string;
}

/* ---------- i18n / UI ---------- */
export const STATUS_KO: Record<Status, string> = {
  Pending: "대기",
  Approved: "승인",
  Rejected: "거절",
  Canceled: "취소",
};

export function StatusBadge({ s }: { s: Status }) {
  const label = STATUS_KO[s];
  const cls =
    s === "Approved" ? "status-badge status-approved" :
    s === "Rejected" ? "status-badge status-rejected" :
    s === "Canceled" ? "status-badge status-canceled" :
    "status-badge status-pending";
  return <span className={cls}>{label}</span>;
}

/* ---------- helpers ---------- */
// atob 대체(브라우저/Node 모두)
function safeAtob(b64: string): string {
  if (typeof atob === "function") return atob(b64);
  return Buffer.from(b64, "base64").toString("binary");
}

/* ---------- Excel helpers (옵션) ---------- */
export function dataUrlToUint8(dataUrl: string): Uint8Array {
  const m = /^data:image\/(png|jpeg);base64,/.exec(dataUrl);
  if (!m) throw new Error("Invalid image data URL");
  const b64 = dataUrl.split(",")[1];
  const bin = safeAtob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

export function fmtReqDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  const SP10 = "          ";
  return `${y}년${SP10}${m}월${SP10}${d}일`;
}
export function fmtStart(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  const SP8 = "        ", SP4 = "    ", SP6 = "      ", SP3 = "   ";
  return `${y} 년${SP8}${m}${SP4} 월${SP6}${d}${SP3} 일   부터`;
}
export function fmtEnd(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  const SP8 = "        ", SP4 = "    ", SP6 = "      ", SP3 = "   ";
  return `${y} 년${SP8}${m}${SP4} 월${SP6}${d}${SP3} 일   까지`;
}

/* ---------- fetch with token ---------- */
export async function authFetch(input: string | URL, init: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("lm_token") : null;
  const headers = new Headers(init.headers || {});
  const url = typeof input === "string" ? input : String(input);
  if (token && url.startsWith(API_BASE)) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers }); // ✅ 스프레드 오타 고침
}

/* ---------- Theme (한 번만 주입) ---------- */
export function injectCleanTheme() {
  const id = "__mgr_clean_theme__";
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.innerHTML = `
  .page-wrap{max-width:1200px;margin:0 auto;padding:24px}
  .mgr{--bg:#fff;--ink:#0f172a;--muted:#64748b;--line:#e5e7eb;--chip:#f8fafc}
  .mgr *{box-sizing:border-box}
  .mgr .shell{background:var(--bg);min-height:calc(100vh - 3rem)}
  .mgr .header{display:flex;justify-content:space-between;align-items:center;margin:0 0 16px}
  .mgr .title{font-size:22px;font-weight:800;color:var(--ink);letter-spacing:.2px}
  .mgr .tabs{display:flex;gap:8px}
  .mgr .tab{border:2px solid var(--line);background:#fff;border-radius:999px;padding:12px 18px;font-weight:800;font-size:15px;color:#334155;cursor:pointer}
  .mgr .tab[aria-pressed="true"]{background:#2563eb;border-color:#2563eb;color:#fff;box-shadow:0 2px 10px rgba(37,99,235,.25)}
  .mgr .toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0 14px}
  .mgr .sel,.mgr .inp{border:2px solid var(--line);border-radius:12px;padding:12px 16px;background:#fff;font-weight:700;color:#0f172a}
  .mgr .inp{width:100%;max-width:320px}
  .mgr .badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:2px solid var(--line);border-radius:999px;background:#fff;font-weight:800;color:#1e293b}
  .mgr .chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:2px solid var(--line);border-radius:999px;background:var(--chip);color:#334155;font-weight:800}
  .mgr .card{border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.05)}
  .mgr .card-body{padding:12px}
  .mgr .field{display:flex;flex-direction:column;gap:4px}
  .mgr .field-label{font-weight:700;font-size:14px;color:#334155}
  .mgr .tbl-wrap{overflow:auto;border-radius:14px}
  .mgr table{width:100%;border-collapse:separate;border-spacing:0;background:#fff}
  .mgr thead th{position:sticky;top:0;background:#f8fafc;color:#0f172a;font-weight:900;font-size:14px;letter-spacing:.2px;padding:12px 14px;border-bottom:1px solid var(--line);white-space:nowrap;z-index:1}
  .mgr tbody td{padding:12px 14px;border-top:1px solid #f1f5f9;font-size:14px;color:#1e293b;vertical-align:middle;white-space:nowrap}
  .mgr tbody tr:hover{background:#fafafa}
  .mgr .td-ellipsis{max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .status-badge{display:inline-block;min-width:110px;text-align:center;padding:8px 16px;font-size:14px;font-weight:900;border-radius:999px;letter-spacing:.2px}
  .status-pending  {background:#ffedd5;color:#ea580c;border:2px solid #ea580c}
  .status-approved {background:#dbeafe;color:#2563eb;border:2px solid #2563eb}
  .status-rejected {background:#fee2e2;color:#dc2626;border:2px solid #dc2626}
  .status-canceled {background:#e2e8f0;color:#475569;border:2px solid #475569}
  .sig-thumb{width:96px;height:56px;object-fit:contain;border:1px solid #cbd5e1;border-radius:10px;background:#fff}
  .btn{appearance:none;border:0;padding:10px 14px;border-radius:12px;font-weight:900;font-size:14px;cursor:pointer;user-select:none;transition:transform .05s ease,box-shadow .18s ease,opacity .15s ease}
  .btn:active{transform:translateY(1px)}
  .btn-primary{background:#111827;color:#fff;box-shadow:0 2px 8px rgba(17,24,39,.15)}
  .btn-ghost{background:#fff;color:#0f172a;border:2px solid var(--line)}
  .btn-ghost:hover{background:#f8fafc}
  .btn-blue{background:#2563eb;color:#fff;box-shadow:0 4px 12px rgba(37,99,235,.25)}
  .btn-red{background:#dc2626;color:#fff;box-shadow:0 4px 12px rgba(220,38,38,.25)}
  .btn-grey{background:#475569;color:#fff}
  .modal{position:fixed;inset:0;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;padding:24px;z-index:50}
  .modal-card{background:#fff;border-radius:18px;max-width:90vw;max-height:90vh;overflow:auto;padding:20px 22px;box-shadow:0 16px 40px rgba(0,0,0,.25)}
  .modal-head{font-weight:900;font-size:18px;color:#0f172a;margin-bottom:8px}
  .modal-sub{color:#334155;font-size:14px;margin-bottom:12px}
  `;
  document.head.appendChild(s);
}

/* ---------- Signature Pad ---------- */
export function SignaturePad({
  onChange,
  targetCssHeight = 60,
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

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const cvs = ref.current!;
    const ctx = cvs.getContext("2d")!;
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    cvs.width = Math.floor(padCssWidth * dpr);
    cvs.height = Math.floor(padCssHeight * dpr);
    cvs.style.width = padCssWidth + "px";
    cvs.style.height = padCssHeight + "px";
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
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
    ctx.fillStyle = "#fff";
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

function trimSignatureCanvas(sourceCanvas: HTMLCanvasElement, targetCssHeight = 60): string | null {
  const sCtx = sourceCanvas.getContext("2d")!;
  const sw = sourceCanvas.width, sh = sourceCanvas.height;
  const img = sCtx.getImageData(0, 0, sw, sh);
  const data = img.data;
  const WHITE_THR = 245;
  const hasInk = (i: number) => {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a === 0) return false;
    return !(r >= WHITE_THR && g >= WHITE_THR && b >= WHITE_THR);
  };
  let top = sh, left = sw, right = -1, bottom = -1;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const idx = (y * sw + x) * 4;
    if (hasInk(idx)) { if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y; }
  }
  if (right < 0 || bottom < 0) return null;
  const PAD = Math.round(Math.min(sw, sh) * 0.03);
  left = Math.max(0, left - PAD); top = Math.max(0, top - PAD);
  right = Math.min(sw - 1, right + PAD); bottom = Math.min(sh - 1, bottom + PAD);
  const tw = right - left + 1, th = bottom - top + 1;
  const tmp = document.createElement("canvas"); tmp.width = tw; tmp.height = th;
  const tCtx = tmp.getContext("2d")!; tCtx.fillStyle = "#fff"; tCtx.fillRect(0, 0, tw, th);
  tCtx.drawImage(sourceCanvas, left, top, tw, th, 0, 0, tw, th);
  const scale = targetCssHeight / th; const outW = Math.max(1, Math.round(tw * scale)); const outH = Math.max(1, Math.round(th * scale));
  const out = document.createElement("canvas"); out.width = outW; out.height = outH;
  const oCtx = out.getContext("2d")!; oCtx.imageSmoothingEnabled = true; oCtx.imageSmoothingQuality = "high";
  oCtx.fillStyle = "#fff"; oCtx.fillRect(0, 0, outW, outH); oCtx.drawImage(tmp, 0, 0, outW, outH);
  return out.toDataURL("image/png");
}

// src/components/hr/Shared.ts (맨 아래 쪽에 추가)
export async function fetchJson<T = any>(input: string | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  // 토큰 포함 요청
  const res = await authFetch(input, { ...init, headers });

  // 텍스트로 먼저 읽기 (HTML이면 여기서 감지 가능)
  const text = await res.text();

  // 상태가 실패면 JSON/텍스트 순서로 파싱 시도
  if (!res.ok) {
    try {
      const j = JSON.parse(text);
      const msg = j?.error || j?.message || `${res.status} ${res.statusText}`;
      throw new Error(msg);
    } catch {
      const snippet = text.slice(0, 200).replace(/\s+/g, " ");
      throw new Error(`${res.status} ${res.statusText} - ${snippet}`);
    }
  }

  // 성공이어도 HTML일 수 있으므로 JSON 파싱 예외 처리
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`서버가 JSON이 아닌 응답을 보냈습니다: ${snippet}`);
  }
}

/* ---------- 공통 페이지 프레임 ---------- */
type TabItem = { key: string; label: string };

export function PageShell({
  title,
  tabs = [],
  activeTab,
  onChangeTab,
  right,
  children,
}: {
  title: string;
  tabs?: TabItem[];
  activeTab?: string;
  onChangeTab?: (k: string) => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  React.useEffect(() => { injectCleanTheme(); }, []);
  return (
    <div className="mgr">
      <div className="page-wrap">
        <div className="shell">
          <div className="header">
            <div className="title">{title}</div>
            <div className="tabs">
              {tabs.map(t => (
                <button
                  key={t.key}
                  className="tab"
                  aria-pressed={activeTab === t.key}
                  onClick={() => onChangeTab?.(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 헤더 오른쪽 부가영역 (필요시) */}
          {right && (
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
              {right}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

// Shared.ts (하단 근처에 추가)
type JFetchResult<T = any> = {
  ok: boolean;
  status: number;
  data: T | string | null;
  res?: Response;
};

export async function jsonFetch<T = any>(
  input: string | URL,
  init: RequestInit = {}
): Promise<JFetchResult<T>> {
  const r = await authFetch(input, init);

  // axios 같은 다른 클라이언트가 섞였을 때 방어
  // (axios 응답엔 json()이 없고 data 필드가 있음)
  if (typeof (r as any)?.json !== "function") {
    const maybeAxios = r as any;
    if (maybeAxios && "data" in maybeAxios && "status" in maybeAxios) {
      return {
        ok: (maybeAxios.status >= 200 && maybeAxios.status < 300),
        status: maybeAxios.status,
        data: maybeAxios.data
      };
    }
    // 정말 예상 밖 타입이면 문자열로 반환
    return { ok: false, status: 0, data: String(r) };
  }

  // 정상 fetch Response 처리
  const res = r as Response;
  const status = res.status;
  const ctype = res.headers.get("content-type") || "";

  // JSON이 아닐 수도 있으니 먼저 text로 안전하게 읽고, 가능하면 JSON 파싱
  const text = await res.text();
  let data: any = null;
  if (ctype.includes("application/json")) {
    try { data = JSON.parse(text); } catch { data = text; }
  } else {
    // 서버가 에러시 HTML/텍스트를 줄 수 있음 (<!DOCTYPE ...>)
    data = text;
  }

  return { ok: res.ok, status, data, res };
}