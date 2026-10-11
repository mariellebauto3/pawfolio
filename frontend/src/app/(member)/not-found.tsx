import type { Metadata } from "next";
import { PageNotFound } from "@/components/feedback/page-not-found";

export const metadata: Metadata = { title: "Page not found" };

// GN-02 inside the member shell, for pages that call notFound(): hidden, suspended and deactivated profiles too.
export default function MemberNotFound() {
  return <PageNotFound area="member" />;
}
