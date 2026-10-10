"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { DocumentViewer } from "@/components/overlays/document-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDocumentFile } from "@/hooks/use-document-file";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/utils/format-date";
import { useToast } from "@/providers/toast-provider";
import { getChangeRequestDocument, reviewChangeRequest } from "../api/admin-accounts";
import { ADMIN_REASON_MAX, CHANGE_STATUS_LABELS, LOCKED_FIELD_LABELS, formatLockedValue } from "../schemas/accounts";
import type { AdminChangeRequest } from "../types/accounts";

type Props = {
  /** The account's name, for the dialogs. */
  ownerName: string;
  /** Newest first. */
  requests: AdminChangeRequest[];
};

/** How many reviewed requests the card keeps in view under the ones still waiting. */
const SHOWN_REVIEWED = 3;

function PendingRequest({ request, ownerName }: { request: AdminChangeRequest; ownerName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<"approve" | "deny" | "document" | null>(null);
  const label = LOCKED_FIELD_LABELS[request.field];
  // The file is asked for only once the admin opens it, and released when the viewer closes.
  const load = useCallback((signal: AbortSignal) => getChangeRequestDocument(api, request.id, signal), [request.id]);
  const file = useDocumentFile(load, `change-request/${request.id}`, open === "document");

  async function review(decision: "approved" | "denied", reason?: string) {
    try {
      await reviewChangeRequest(api, request.id, decision === "denied" ? { decision, reason: reason ?? "" } : { decision });
    } catch (failure) {
      // Another admin reviewed it first: the page shows what they decided, and the dialog closes.
      if (isApiError(failure) && failure.kind === "conflict") {
        router.refresh();
        return toast.show(failure.message, { tone: "info" });
      }
      throw failure;
    }
    router.refresh();
    toast.show(decision === "approved" ? `${label} changed. ${ownerName} has been told.` : `Change denied. ${ownerName} can read your reason.`);
  }

  return (
    <li className="flex flex-col gap-3 rounded-card border border-line p-3">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-muted">{label} now</dt>
        <dd className="wrap-break-word">{formatLockedValue(request.field, request.current_value)}</dd>
        <dt className="text-ink-muted">Asked for</dt>
        <dd className="font-bold wrap-break-word">{formatLockedValue(request.field, request.new_value)}</dd>
        <dt className="text-ink-muted">Reason</dt>
        {/* The owner's own words, as text (SEC-FE-01). */}
        <dd className="wrap-break-word whitespace-pre-line">“{request.reason}”</dd>
        <dt className="text-ink-muted">Sent</dt>
        <dd>
          <time dateTime={request.created_at}>{formatDate(request.created_at)}</time>
        </dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => setOpen("approve")}>
          Approve<span className="sr-only"> the change to {label}</span>
        </Button>
        <Button size="sm" onClick={() => setOpen("deny")}>
          Deny<span className="sr-only"> the change to {label}</span>
        </Button>
        {request.has_document && (
          <Button size="sm" variant="tertiary" onClick={() => setOpen("document")}>
            View document
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={open === "approve"}
        onClose={() => setOpen(null)}
        title={`Change ${ownerName}’s ${label.toLowerCase()}?`}
        subtitle={`From “${formatLockedValue(request.field, request.current_value)}” to “${formatLockedValue(request.field, request.new_value)}”.`}
        confirmLabel="Approve change"
        consequences={["The new value shows on the profile right away.", "The owner is told, and the change is written to the activity log."]}
        onConfirm={() => review("approved")}
      />
      <ConfirmDialog
        open={open === "deny"}
        onClose={() => setOpen(null)}
        title={`Deny the change to ${ownerName}’s ${label.toLowerCase()}?`}
        subtitle="The detail stays as it is. The owner can ask again."
        confirmLabel="Deny change"
        reason={{ label: "Reason", hint: "Required. The owner reads it in their Alerts.", placeholder: "e.g. The document doesn’t show the new name.", maxLength: ADMIN_REASON_MAX }}
        onConfirm={({ reason }) => review("denied", reason)}
      />
      <DocumentViewer
        open={open === "document"}
        onClose={() => setOpen(null)}
        title={`Supporting document: ${label}`}
        subtitle={`Sent ${formatDate(request.created_at)} with the request`}
        alt={`Supporting document for the change to ${ownerName}’s ${label.toLowerCase()}`}
        file={file}
      />
    </li>
  );
}

// Changes to locked details that an owner asked for (AC-03), reviewed from the account's page (AC-07): what the
// account says now beside what is asked for, the owner's reason and their document, then Approve or Deny. A denial
// needs its reason (SEC-AUTHZ-07). The supporting document is read from the admin endpoint and shown from memory
// (SEC-PRIV-01, SEC-FE-09).
export function ChangeRequestsCard({ ownerName, requests }: Props) {
  const waiting = requests.filter((request) => request.status === "pending");
  const reviewed = requests.filter((request) => request.status !== "pending").slice(0, SHOWN_REVIEWED);
  if (requests.length === 0) return null;

  return (
    <Card title="Change requests" description={waiting.length > 0 ? "Changes to verified details that are waiting for you." : "No change is waiting. The latest ones:"}>
      <div className="flex flex-col gap-4">
        {waiting.length > 0 && (
          <ul className="flex flex-col gap-3">
            {waiting.map((request) => (
              <PendingRequest key={request.id} request={request} ownerName={ownerName} />
            ))}
          </ul>
        )}
        {reviewed.length > 0 && (
          <ul className="flex flex-col gap-2 text-sm">
            {reviewed.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="wrap-break-word">
                  {LOCKED_FIELD_LABELS[request.field]} to “{formatLockedValue(request.field, request.new_value)}”
                </span>
                <Badge tone={request.status === "approved" ? "progress" : "closed"}>{CHANGE_STATUS_LABELS[request.status]}</Badge>
                {request.reviewed_at && (
                  <span className="text-ink-muted">
                    <time dateTime={request.reviewed_at}>{formatDate(request.reviewed_at)}</time>
                    {request.reviewed_by && ` by ${request.reviewed_by}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
