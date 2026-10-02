import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/admin-shell";

// Admin pages. proxy.ts sends non-admins away first, as a convenience only: every /api/v1/admin endpoint checks the
// admin role itself (SEC-AUTHZ-07, SEC-FE-06).
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
