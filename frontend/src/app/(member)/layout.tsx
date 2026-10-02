import type { ReactNode } from "react";
import { MemberShell } from "@/components/layout/member-shell";

// Pet and Human pages. proxy.ts sends signed-out and non-Active visitors away first, as a convenience only: the API
// refuses their requests on its own (SEC-FE-06).
export default function MemberLayout({ children }: { children: ReactNode }) {
  return <MemberShell>{children}</MemberShell>;
}
