// src/components/WorkLogFormMini.tsx
import React, { useState } from "react";
import { API_BASE, jsonFetch, SignaturePad } from "../components/hr/Shared";

export default function WorkLogFormMini() {
  const [file, setFile] = useState<File | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !signature) {
      alert("파일 업로드와 서명은 필수입니다.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("signature", signature);

      const { ok, status, data } = await jsonFetch(`${API_BASE}/api/worklogs`, {
        method: "POST",
        body: fd
      });
      if (!ok || (data as any)?.ok === false) {
        const msg = typeof data === "string" ? data : (data as any)?.error || `HTTP ${status}`;
        throw new Error(msg);
      }
      alert("근무일지 제출 완료");
      setFile(null);
      setSignature(null);
    } catch (e:any) {
      alert(e?.message || "제출 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <div className="card-body" style={{display:"grid", gap:10}}>
        <input className="inp" type="file" onChange={e=>setFile(e.target.files?.[0] ?? null)} />
        <SignaturePad onChange={setSignature} />
        <button className="btn btn-primary" disabled={busy}>{busy ? "제출 중…" : "제출"}</button>
      </div>
    </form>
  );
}
