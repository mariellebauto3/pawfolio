import type { Metadata } from "next";
import { PageNotFound } from "@/components/feedback/page-not-found";

export const metadata: Metadata = { title: "Page not found" };

export default function AdminNotFound() {
  return <PageNotFound area="admin" />;
}
