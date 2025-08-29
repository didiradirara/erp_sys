import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { tabsForRole } from "../auth/roles";
import { injectCleanTheme } from "../components/hr/Shared";

const TabsBar: React.FC = () => {
  const { user, logout } = useAuth();
  const tabs = tabsForRole(user?.role || null);
  if (tabs.length <= 1) return null;

  return (
    <div className="mgr" style={{ borderBottom: "1px solid #e5e7eb", background:"#fff" }}>
      <div className="page-wrap" style={{ display:"flex", gap:12, alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", gap:8 }}>
          {tabs.map(t => (
            <NavLink
              key={t.path}
              to={t.path}
              className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
              style={({ isActive }) => ({
                textDecoration: "none",
                padding: "10px 14px",
                borderRadius: 999,
                border: "2px solid #e5e7eb",
                fontWeight: 800,
                color: isActive ? "#fff" : "#334155",
                background: isActive ? "#2563eb" : "#fff",
                boxShadow: isActive ? "0 2px 10px rgba(37,99,235,.25)" : "none"
              })}
            >
              {t.label}
            </NavLink>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ color:"#475569", fontWeight:700 }}>{user?.name || user?.id}</span>
          <button className="btn-ghost" onClick={logout}>로그아웃</button>
        </div>
      </div>
    </div>
  );
};

const ProtectedLayout: React.FC = () => {
  React.useEffect(() => { injectCleanTheme(); }, []);
  return (
    <>
      <TabsBar />
      <Outlet />
    </>
  );
};
export default ProtectedLayout;
