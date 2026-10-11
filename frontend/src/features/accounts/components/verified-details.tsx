"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LockedField } from "@/components/forms/locked-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format-date";
import { useToast } from "@/providers/toast-provider";
import { RequestChangeDialog } from "../dialogs/request-change-dialog";
import { CHANGE_STATUS_LABELS, LOCKED_FIELD_LABELS, formatLockedValue, lockedFieldsFor } from "../schemas/accounts";
import type { ChangeRequest, LockedField as LockedFieldName, Settings } from "../types/accounts";

type Props = {
  role: "pet" | "human";
  details: Settings["locked_details"];
  /** The account's change requests, newest first. */
  requests: ChangeRequest[];
};

/** How many past requests the card lists under the fields. */
const SHOWN_REQUESTS = 3;

// The details an admin checked at verification (AC-01, AC-02): shown locked, each with "Request a change" (AC-03).
// A detail whose change is already waiting says so instead of offering a second request, which the API would refuse.
export function VerifiedDetails({ role, details, requests }: Props) {
  const router = useRouter();
  const toast = useToast();
  // null: closed. Otherwise the detail the dialog opens on, or "any" from the card's own button.
  const [asking, setAsking] = useState<LockedFieldName | "any" | null>(null);

  const fields = lockedFieldsFor(role);
  const waiting = new Map(requests.filter((request) => request.status === "pending").map((request) => [request.field, request]));
  const open = fields.filter((field) => !waiting.has(field));
  const decided = requests.filter((request) => request.status !== "pending").slice(0, SHOWN_REQUESTS);

  return (
    <>
      <Card
        title="Verified details"
        description="Checked during verification, so they’re locked. Other profile edits go live right away."
        action={
          open.length > 0 && (
            <Button size="sm" onClick={() => setAsking("any")}>
              Request a change
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {fields.map((field) => {
              const request = waiting.get(field);
              return (
                <div key={field} className="flex flex-col gap-1">
                  <LockedField label={LOCKED_FIELD_LABELS[field]} value={formatLockedValue(field, details[field])} hint="" onRequestChange={request ? undefined : () => setAsking(field)} />
                  {request && (
                    <p className="text-sm text-ink-muted">
                      You asked to change this to “{formatLockedValue(field, request.new_value)}”. An admin is reviewing it.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {decided.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <h3 className="text-base">Earlier requests</h3>
              <ul className="flex flex-col gap-2 text-sm">
                {decided.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="wrap-break-word">
                      {LOCKED_FIELD_LABELS[request.field]} to “{formatLockedValue(request.field, request.new_value)}”
                    </span>
                    <Badge tone={request.status === "approved" ? "progress" : "closed"}>{CHANGE_STATUS_LABELS[request.status]}</Badge>
                    {request.reviewed_at && (
                      <time dateTime={request.reviewed_at} className="text-ink-muted">
                        {formatDate(request.reviewed_at)}
                      </time>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-ink-muted">When a request is denied, the admin’s reason is in your Alerts.</p>
            </div>
          )}
        </div>
      </Card>

      <RequestChangeDialog
        open={asking !== null}
        onClose={() => setAsking(null)}
        role={role}
        fields={open}
        initialField={asking === "any" || asking === null ? undefined : asking}
        details={details}
        onSent={() => {
          router.refresh();
          toast.show("Request sent. An admin will review it.");
        }}
        onAlreadyWaiting={(message) => {
          router.refresh();
          toast.show(message, { tone: "info" });
        }}
      />
    </>
  );
}
