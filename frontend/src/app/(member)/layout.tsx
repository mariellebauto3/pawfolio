import { requireAccount } from "@/lib/auth/require-account";
import { ROUTES } from "@/constants/routes";
import type { ReactNode } from "react";
import { MemberShell } from "@/components/layout/member-shell";
import { AlertsFeed } from "@/features/notifications/components/alerts-feed";
import { ReportHost } from "@/features/reports/components/report-host";

// Pet and Human pages. proxy.ts sends signed-out and non-Active visitors away first, as a convenience only: the API
// refuses their requests on its own (SEC-FE-06). AlertsFeed keeps the top bar's Alerts count and dropdown (NT-01)
// current for as long as the visitor stays on these pages, and ReportHost holds the one report dialog (RP-01) that
// the feed's menus and the profile pages open.
export default async function MemberLayout({ children }: { children: ReactNode }) {
  await requireAccount(ROUTES.memberHome);
  return (
    <AlertsFeed>
      <ReportHost>
        <MemberShell>{children}</MemberShell>
      </ReportHost>
    </AlertsFeed>
  );
}
