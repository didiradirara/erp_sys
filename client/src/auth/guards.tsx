import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { Role } from "./roles";

export const RequireAuth: React.FC = () => {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div style={{ padding:24 }}>로딩 중…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  return <Outlet />;
};

export const RequireRole: React.FC<{ allowed: Role[] }> = ({ allowed }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed.includes(user.role)) return <Navigate to="/forbidden" replace />;
  return <Outlet />;
};
