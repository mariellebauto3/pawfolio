import type { Metadata } from "next";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Home" };

// Placeholder so sign-in has somewhere to land (ROUTES.memberHome). The home feed (FD-01, FD-02) replaces it.
export default function FeedPage() {
  return (
    <>
      <PageHeader title="Home" />
      <EmptyState icon="paw" title="Your feed is on its way" description="Posts from pets and homes will show up here." />
    </>
  );
}
