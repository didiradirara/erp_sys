// src/EmployeePage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PageShell } from "../components/hr/Shared";
import EmployeeLeavePage from "./EmployeeLeavePage";
import WorkLogFormMini from "./WorkLogFormMini";

export default function EmployeePage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate("/login"); };
  const [tab, setTab] = React.useState<"leave" | "worklog">("leave");

  return (
    <PageShell
      title="직원 페이지"
      tabs={[
        { key: "leave",   label: "연차작성" },
        { key: "worklog", label: "근무일지 작성" },
      ]}
      activeTab={tab}
      onChangeTab={(k)=>setTab(k as any)}
      right={<button className="btn-ghost" onClick={handleLogout}>로그아웃</button>}
    >
      {tab === "leave"   && <EmployeeLeavePage />}
      {tab === "worklog" && <WorkLogFormMini />}
    </PageShell>
  );
}
