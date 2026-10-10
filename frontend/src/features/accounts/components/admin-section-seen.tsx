"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { countedAdminSection } from "@/components/navigation/nav-config";
import { api } from "@/lib/api/client";
import { markAdminSectionSeen } from "../api/admin-sidebar";

// Mounted once by the admin layout, so it outlives every page: when the admin opens Verification, Reports or
// Requests & Meets (any page of it), the API is told, and the layout's counts are loaded again once it has
// answered. The sidebar itself already hides the count of a section the moment it is opened; this is what keeps it
// cleared after a reload and on the admin's other devices. It doesn't stop when the admin moves on to another page
// before the answer is back. Renders nothing; if the call fails, the count simply shows again on the next load.
export function AdminSectionSeen() {
  const pathname = usePathname();
  const router = useRouter();
  const section = countedAdminSection(pathname);

  useEffect(() => {
    if (!section) return;
    markAdminSectionSeen(api, section)
      .then(() => router.refresh())
      .catch(() => {});
  }, [section, router]);

  return null;
}
