"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/utils/format-date";
import { useToast } from "@/providers/toast-provider";
import type { ReportAction } from "@/types/report";
import { takeReportAction } from "../api/reports";
import { TakeActionDialog } from "../dialogs/take-action-dialog";
import { ACTION_DONE, ACTION_LABELS, ACTION_REASON_MAX, actionOptionsFor, reportedItemName } from "../schemas/reports";
import type { ReportDetail } from "../types/reports";

type Props = {
  report: ReportDetail;
  className?: string;
};

type Open = { kind: "action"; initial?: ReportAction } | { kind: "restore" } | null;

// The decision on a report (RP-04 → RP-05): while it is open, "Choose action…" and "Dismiss report", which both
// open the action dialog since every action needs a reason; once resolved, what was decided, by whom and why, and
// Restore content when what was removed can be put back. The page is rendered again after each action, so the
// sidebar's count and this card follow what the API now says.
export function ReportDecision({ report, className }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<Open>(null);

  const decision = report.report_action;
  const content = report.content_preview.comment ?? report.content_preview.post;
  const options = actionOptionsFor(report);
  const itemName = reportedItemName(report);

  function settled(message: string, tone: "success" | "info" = "success") {
    router.refresh();
    toast.show(message, { tone });
  }

  async function restore(reason: string) {
    try {
      await takeReportAction(api, report.id, { action: "restore_content", reason });
    } catch (failure) {
      // Someone restored it already: the page shows it as it stands, and the dialog closes.
      if (isApiError(failure) && failure.kind === "conflict") return settled(failure.message, "info");
      throw failure;
    }
    settled(ACTION_DONE.restore_content);
  }

  return (
    <>
      {report.status === "open" ? (
        <Card title="Take action" className={className}>
          <div className="flex flex-col gap-3">
            <Button variant="primary" block onClick={() => setOpen({ kind: "action" })}>
              Choose action…
            </Button>
            <Button block onClick={() => setOpen({ kind: "action", initial: "dismiss" })}>
              Dismiss report
            </Button>
            <p className="text-sm text-ink-muted">
              {options.some((option) => option.value === "remove_content")
                ? "Removing hides the content for everyone. It can be restored later from Resolved."
                : "A profile or an account has nothing to remove: suspend the account, or dismiss the report."}
            </p>
          </div>
        </Card>
      ) : (
        <Card title="Action taken" className={className}>
          {decision ? (
            <div className="flex flex-col gap-3">
              <dl className="flex flex-col gap-2 text-sm">
                <div>
                  <dt className="text-ink-muted">Action</dt>
                  <dd className="font-bold">{ACTION_LABELS[decision.action]}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Decided</dt>
                  <dd>
                    <time dateTime={decision.created_at}>{formatDateTime(decision.created_at)}</time>
                    {decision.performed_by && ` by ${decision.performed_by}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Reason</dt>
                  <dd className="wrap-break-word whitespace-pre-line">{decision.reason}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Reporters</dt>
                  <dd>{decision.notify_reporters ? "Told that it was reviewed" : "Not told"}</dd>
                </div>
              </dl>
              {content?.is_removed && (
                <>
                  <Button block onClick={() => setOpen({ kind: "restore" })}>
                    Restore content
                  </Button>
                  <p className="text-sm text-ink-muted">Restoring makes it visible to everyone again. The report stays resolved.</p>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">This report is resolved.</p>
          )}
        </Card>
      )}

      <TakeActionDialog
        open={open?.kind === "action"}
        onClose={() => setOpen(null)}
        reportId={report.id}
        itemName={itemName}
        reportsCount={report.reports_count}
        options={options}
        initialAction={open?.kind === "action" ? open.initial : undefined}
        onApplied={(_, action) => settled(ACTION_DONE[action])}
        onAlreadyResolved={(message) => settled(message, "info")}
      />

      <ConfirmDialog
        open={open?.kind === "restore"}
        onClose={() => setOpen(null)}
        title="Restore this content?"
        subtitle={`${itemName} becomes visible to everyone again.`}
        confirmLabel="Restore content"
        consequences={["It returns to the feed and to its own page, with its likes and comments.", "The report stays resolved, and the restore is written to the activity log."]}
        reason={{ label: "Why restore it?", hint: "Required. Kept in the activity log.", placeholder: "e.g. Removed by mistake.", maxLength: ACTION_REASON_MAX }}
        onConfirm={({ reason }) => restore(reason ?? "")}
      />
    </>
  );
}
