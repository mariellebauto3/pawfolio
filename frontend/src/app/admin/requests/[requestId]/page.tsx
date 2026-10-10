import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMonitoredRequest } from "@/features/adoption-requests/api/admin-requests";
import { AdminRequestScreen } from "@/features/adoption-requests/components/admin-request-screen";
import { requestIdFromUrl } from "@/features/adoption-requests/schemas/admin-requests";
import { readBooking } from "@/features/meet-and-greet/api/meetings";
import { isApiError } from "@/lib/api/errors";
import { getServerApi } from "@/lib/api/server";

// The pet's and the human's names stay out of the tab title and the browser history.
export const metadata: Metadata = { title: "Adoption request" };

type Props = {
  params: Promise<{ requestId: string }>;
};

// RQ-19 Request detail: a read-only record of one request, with Send reminder and the way to Resolve adoption issue
// (AL-07). The API checks the admin role and loads the record itself (SEC-AUTHZ-02, SEC-AUTHZ-07).
export default async function AdminRequestPage({ params }: Props) {
  // Only a plain request id goes to the API (SEC-FE-08); anything else is a page that doesn't exist.
  const id = requestIdFromUrl((await params).requestId);
  if (id === null) notFound();

  const request = await getMonitoredRequest(await getServerApi(), id, readBooking).catch((error: unknown) => {
    if (isApiError(error) && error.kind === "not_found") notFound();
    throw error;
  });

  return <AdminRequestScreen request={request} />;
}
