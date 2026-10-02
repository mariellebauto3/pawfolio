import type { ReactNode } from "react";
import { AccountStatusShell } from "@/components/layout/account-status-shell";

// Pending, Denied and Suspended accounts (AU-18…AU-21).
export default function AccountStatusLayout({ children }: { children: ReactNode }) {
  return <AccountStatusShell>{children}</AccountStatusShell>;
}
