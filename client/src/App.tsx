import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth, RequireRole } from "./auth/guards";
import ProtectedLayout from "./layouts/ProtectedLayout";

// 페이지들
import LoginPage from "./pages/LoginPage";
import EmployeePage from "./pages/EmployeePage";
import EmployeeLeavePage from "./pages/EmployeeLeavePage";
import WorkLogFormMini from "./pages/WorkLogFormMini";
import ManagerPage from "./pages/ManagerPage";
import HRAdminPage from "./pages/HRAdminPage";

const Forbidden = () => <div style={{ padding: 24 }}>접근 권한이 없습니다.</div>;
const NotFound =  () => <div style={{ padding: 24 }}>페이지를 찾을 수 없습니다.</div>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 첫 화면 → 로그인 */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forbidden" element={<Forbidden />} />

          {/* 인증 필수 + 탭 레이아웃 */}
          <Route element={<RequireAuth />}>
            <Route element={<ProtectedLayout />}>
              {/* 직원 */}
              <Route element={<RequireRole allowed={["employee","admin","manager","hr"]} />}>
                <Route path="/employee" element={<EmployeePage />} />
                <Route path="/employee/leave" element={<EmployeeLeavePage />} />
                <Route path="/employee/worklog" element={<WorkLogFormMini />} />
              </Route>

              {/* 상사 */}
              <Route element={<RequireRole allowed={["manager","admin"]} />}>
                <Route path="/manager" element={<ManagerPage />} />
              </Route>

              {/* HR */}
              <Route element={<RequireRole allowed={["hr","admin"]} />}>
                <Route path="/hr" element={<HRAdminPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
