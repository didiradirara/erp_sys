// src/EmployeePage.tsx
import React from "react";
import { PageShell } from "../components/hr/Shared";
import EmployeeLeavePage from "./EmployeeLeavePage";
import WorkLogFormMini from "./WorkLogFormMini";

export default function EmployeePage() {
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
    >
      {tab === "leave"   && <EmployeeLeavePage />}
      {tab === "worklog" && <WorkLogFormMini />}
    </PageShell>
  );
}
