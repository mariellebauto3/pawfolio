"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/utils/format-date";
import { useToast } from "@/providers/toast-provider";
import { deactivateAccount, reactivateAccount, suspendAccount } from "../api/admin-accounts";
import { ADMIN_REASON_MAX, accountActionsFor } from "../schemas/accounts";
import type { AccountActionKind, AccountActionRecord, AccountDetail } from "../types/accounts";

type Props = {
  account: Pick<AccountDetail, "id" | "display_name" | "status" | "role">;
  /** The suspension an admin would be lifting, shown in the Reactivate dialog (AC-09). */
  suspension: AccountActionRecord | null;
};

const SEND: Record<AccountActionKind, typeof suspendAccount> = { suspend: suspendAccount, reactivate: reactivateAccount, deactivate: deactivateAccount };
const DONE: Record<AccountActionKind, string> = {
  suspend: "Account suspended. The owner sees your reason.",
  reactivate: "Account reactivated. It is Active again.",
  deactivate: "Account deactivated. Its records are kept.",
};

// Suspend, Reactivate and Deactivate on an account's page (AC-07 → AC-08, AC-09, AC-10; FR34). Each is its own API
// action with a required reason, never a status that is set (FR27, SEC-AUTHZ-07); the API writes it to the activity
// log with the admin's name. Only what the account's status allows is offered, and the API refuses the rest
// (SEC-FE-05). The page is rendered again afterwards, so it shows what the API now says.
export function AccountActions({ account, suspension }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<AccountActionKind | null>(null);
  const offered = accountActionsFor(account.status);
  const { display_name: name } = account;

  async function run(action: AccountActionKind, reason: string) {
    try {
      await SEND[action](api, account.id, reason);
    } catch (failure) {
      // Another admin got there first: the page shows where the account stands, and the dialog closes.
      if (isApiError(failure) && failure.kind === "conflict") {
        router.refresh();
        return toast.show(failure.message, { tone: "info" });
      }
      throw failure;
    }
    router.refresh();
    toast.show(DONE[action]);
  }

  if (offered.length === 0) return null;

  return (
    <>
      {offered.includes("suspend") && (
        <Button size="sm" onClick={() => setOpen("suspend")}>
          Suspend
        </Button>
      )}
      {offered.includes("reactivate") && (
        <Button size="sm" variant="primary" onClick={() => setOpen("reactivate")}>
          Reactivate
        </Button>
      )}
      {offered.includes("deactivate") && (
        <Button size="sm" variant="tertiary" onClick={() => setOpen("deactivate")}>
          Deactivate
        </Button>
      )}

      <ConfirmDialog
        open={open === "suspend"}
        onClose={() => setOpen(null)}
        title={`Suspend ${name}?`}
        subtitle="The profile is hidden and the owner sees only your reason."
        confirmLabel="Suspend account"
        destructive
        consequences={[
          "The owner is signed out on every device.",
          "Open adoption requests are closed and their Meet & Greets end. The other side is told.",
          "Their posts and comments leave the feed.",
          "You can reactivate the account later.",
        ]}
        reason={{ label: "Reason", hint: "Required. Shown to the owner.", placeholder: "e.g. Multiple confirmed reports of misleading profile information.", maxLength: ADMIN_REASON_MAX }}
        onConfirm={({ reason }) => run("suspend", reason ?? "")}
      />

      <ConfirmDialog
        open={open === "reactivate"}
        onClose={() => setOpen(null)}
        title={`Reactivate ${name}?`}
        subtitle="The account becomes Active and the profile is visible again."
        confirmLabel="Reactivate account"
        consequences={["The owner can sign in and is told the account is Active.", "Requests that were closed stay closed: new ones start over."]}
        reason={{ label: "Note for the log", hint: "Required. Kept in the activity log.", placeholder: "e.g. Owner verified the photos with a vet certificate.", maxLength: ADMIN_REASON_MAX }}
        onConfirm={({ reason }) => run("reactivate", reason ?? "")}
      >
        {suspension && (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-card bg-surface-sunken p-3 text-sm">
            <dt className="text-ink-muted">Suspended</dt>
            <dd>
              <time dateTime={suspension.created_at}>{formatDate(suspension.created_at)}</time>
              {suspension.performed_by && ` by ${suspension.performed_by}`}
            </dd>
            <dt className="text-ink-muted">Reason</dt>
            <dd className="wrap-break-word whitespace-pre-line">{suspension.reason ?? "None recorded"}</dd>
          </dl>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={open === "deactivate"}
        onClose={() => setOpen(null)}
        title={`Deactivate ${name}?`}
        subtitle="Removes the account from Pawfolio. Records are kept for adoption history and logs."
        confirmLabel="Deactivate account"
        destructive
        permanent
        consequences={[
          account.role === "pet" ? "The resume is hidden from everyone." : "The Home Profile is hidden from everyone.",
          "Open adoption requests are closed and their Meet & Greets end. The other side is told.",
          "A deactivated account can’t be reactivated.",
        ]}
        reason={{ label: "Reason", hint: "Required. Kept in the activity log.", placeholder: "e.g. Duplicate account.", maxLength: ADMIN_REASON_MAX }}
        acknowledgement="I understand the owner won’t be able to sign in."
        onConfirm={({ reason }) => run("deactivate", reason ?? "")}
      />
    </>
  );
}
