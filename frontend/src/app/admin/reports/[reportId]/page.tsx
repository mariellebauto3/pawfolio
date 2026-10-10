import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getReport } from "@/features/reports/api/reports";
import { ReportReviewScreen } from "@/features/reports/components/report-review-screen";
import { reportIdFromUrl } from "@/features/reports/schemas/reports";
import { isApiError } from "@/lib/api/errors";
import { getServerApi } from "@/lib/api/server";

// The reported account's name stays out of the tab title and the browser history.
export const metadata: Metadata = { title: "Review report" };

type Props = {
  params: Promise<{ reportId: string }>;
};

// RP-04 Review report, with the Take action dialog (RP-05) on it, and the same page once resolved. The API checks
// the admin role and loads the record itself (SEC-AUTHZ-02, SEC-AUTHZ-07).
export default async function ReportReviewPage({ params }: Props) {
  // Only a plain report id goes to the API (SEC-FE-08); anything else is a page that doesn't exist.
  const id = reportIdFromUrl((await params).reportId);
  if (id === null) notFound();

  const report = await getReport(await getServerApi(), id).catch((error: unknown) => {
    if (isApiError(error) && error.kind === "not_found") notFound();
    throw error;
  });

  return <ReportReviewScreen report={report} />;
}
