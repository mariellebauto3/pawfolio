import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Account status" };

// Placeholder so blocked accounts have somewhere to land (ROUTES.accountStatus). The status screens (AU-18, AU-20,
// AU-21) replace it.
export default function AccountStatusPage() {
  return (
    <>
      <PageHeader title="Your account" />
      <EmptyState icon="info" title="Your account isn't active yet" description="You'll see its status and what to do next here." />
    </>
  );
}
