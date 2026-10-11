import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/navigation/admin-sidebar";
import type { AdminNavCounts } from "@/components/navigation/nav-config";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/navigation/skip-link";

type Props = {
  children: ReactNode;
  /** Queue sizes next to the sidebar items. */
  counts?: AdminNavCounts;
};

// Admin pages: sidebar on desktop, a top bar with a menu drawer below `lg`, content filling the rest so tables get the room.
export function AdminShell({ children, counts }: Props) {
  return (
    <>
      <SkipLink />
      <div className="flex flex-1 flex-col lg:flex-row">
        <AdminSidebar counts={counts} />
        <main id={MAIN_CONTENT_ID} className="min-w-0 flex-1 px-gutter py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </>
  );
}
