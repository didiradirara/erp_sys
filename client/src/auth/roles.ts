export type Role = "employee" | "manager" | "hr" | "admin";

export type AppTab = { path: string; label: string };

// 역할별 탭(접근 가능한 페이지)
export function tabsForRole(role: Role | null): AppTab[] {
  if (!role) return [];
  if (role === "admin") {
    return [
      { path: "/employee", label: "직원" },
      { path: "/manager",  label: "상사 검토" },
      { path: "/hr",       label: "인사 관리자" },
    ];
  }
  if (role === "hr")       return [{ path: "/hr", label: "인사 관리자" }];
  if (role === "manager")  return [{ path: "/manager", label: "상사 검토" }];
  return [{ path: "/employee", label: "직원" }]; // employee
}

// 로그인 직후의 기본 경로
export function defaultPathForRole(role: Role | null): string {
  if (!role) return "/login";
  if (role === "admin")   return "/employee"; // 탭 보이므로 어떤 걸로 시작해도 OK
  if (role === "hr")      return "/hr";
  if (role === "manager") return "/manager";
  return "/employee";
}
