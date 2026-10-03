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
// columns (feed side rails, resume, request detail) inside it. Below lg the page's end is padded clear of the tab bar
// fixed to the bottom of the screen.
export function MemberShell({ children, counts }: Props) {
  return (
    <>
      <SkipLink />
      <MemberTopBar counts={counts} />
      <main
        id={MAIN_CONTENT_ID}
        className="mx-auto w-full max-w-content flex-1 px-gutter pt-6 pb-[calc(var(--pf-bottom-offset)+1.5rem)] lg:py-8"
      >
        {children}
      </main>
    </>
  );
}
