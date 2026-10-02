import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Dashboard" };

// Placeholder so admin sign-in has somewhere to land (ROUTES.adminHome). The dashboard (AN-03) replaces it.
export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <EmptyState icon="inbox" title="The dashboard is on its way" description="Platform numbers will show up here." />
    </>
  );
}
