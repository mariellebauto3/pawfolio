import type { ReactNode } from "react";
import { MemberTopBar } from "@/components/navigation/member-top-bar";
import type { MemberNavCounts } from "@/components/navigation/nav-config";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/navigation/skip-link";

type Props = {
  children: ReactNode;
  /** Unread counts for Requests and Alerts in the top bar. */
  counts?: MemberNavCounts;
};

// Pet and Human pages: the role-aware top bar (GN-01) over content up to 1128 px wide. Pages lay out their own
// columns (feed side rails, résumé, request detail) inside it.
export function MemberShell({ children, counts }: Props) {
  return (
    <>
      <SkipLink />
      <MemberTopBar counts={counts} />
      <main id={MAIN_CONTENT_ID} className="mx-auto w-full max-w-content flex-1 px-gutter py-6 lg:py-8">
        {children}
      </main>
    </>
  );
}
