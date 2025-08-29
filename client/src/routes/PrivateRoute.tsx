// src/routes/PrivateRoute.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function PrivateRoute({ children }: { children: JSX.Element }) {
  const loc = useLocation();
  const token = localStorage.getItem("lm_token");
  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  return children;
}
