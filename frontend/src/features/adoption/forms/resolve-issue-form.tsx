"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { RadioCards } from "@/components/forms/radio-cards";
import { Select } from "@/components/forms/select";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { adminResolvePath } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/toast-provider";
import type { ResolutionAction } from "@/types/adoption-resolution";
import { previewResolution } from "../api/resolutions";
import { ConfirmResolutionDialog } from "../dialogs/confirm-resolution-dialog";
import { RESOLVE_REASON_MAX, type ResolutionErrors, actionChoices, initialRequestId, requestLabel, resolutionProblems } from "../schemas/resolutions";
import type { ResolutionChange, ResolveOptions } from "../types/resolutions";

type Props = {
  /** The pet, its requests and what each of the four actions offers, as the API says now. */
  options: ResolveOptions;
  /** The request the page was opened on (from an overdue row or a request's record). */
  requestId: number | null;
};

const UNKNOWN_PROBLEM = "That didn't go through. Check your connection and try again.";
const NO_REQUEST = "";

// AL-07 Resolve adoption issue: the related request, the action, the reason, then "Review change", which asks the
// API what the action would change and shows it in AL-08 before anything is written. The form never sends a status
// (FR27): it sends one of four actions, and only those the API says apply to the chosen request can be picked
// (SEC-FE-05). The reason is required here and by the API (FR37, SEC-AUTHZ-07). The card keys the form by where the
// pet stands, so once that changes (a change was applied, or another admin was first) it starts over.
export function ResolveIssueForm({ options, requestId: wanted }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { pet, requests } = options;

  const [requestId, setRequestId] = useState<number | null>(() => initialRequestId(options, wanted));
  const [action, setAction] = useState<ResolutionAction | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<ResolutionErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [change, setChange] = useState<ResolutionChange | null>(null);

  const choices = actionChoices(options, requestId);
  const chosen = choices.find((choice) => choice.action === action && choice.enabled) ?? null;
  const nothingApplies = options.actions.every((option) => !option.available);
  // An action that changes the pet alone is sent without a request, whatever the list says.
  const input = chosen ? { action: chosen.action, requestId: options.actions.find((option) => option.action === chosen.action)?.request_ids.length ? requestId : null } : null;

  function chooseRequest(value: string) {
    const next = value === NO_REQUEST ? null : Number(value);
    setRequestId(next);
    // An action picked for another request doesn't carry over to this one.
    if (action && !actionChoices(options, next).some((choice) => choice.action === action && choice.enabled)) setAction(null);
    setProblem(null);
  }

  /**
   * The pet or the request moved on (409): the API's words go in a toast, because reading the page again starts the
   * form over on where the pet stands now.
   */
  function refused(message: string) {
    toast.show(message, { tone: "info" });
    router.refresh();
  }

  function invalid(fieldErrors: FieldErrors) {
    setErrors({ action: fieldErrors.action?.[0] ?? fieldErrors.adoption_request_id?.[0], reason: fieldErrors.reason?.[0] });
  }

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found = resolutionProblems({ action: chosen?.action ?? null, reason });
    setErrors(found);
    if (Object.keys(found).length > 0 || !input) return;

    setBusy(true);
    setProblem(null);
    try {
      setChange(await previewResolution(api, pet.id, input));
    } catch (failure) {
      if (!isApiError(failure)) setProblem(UNKNOWN_PROBLEM);
      else if (failure.kind === "conflict") refused(failure.message);
      else if (failure.kind === "validation") invalid(failure.fieldErrors);
      else setProblem(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function applied() {
    toast.show("Change applied and written to the activity log.");
    // Back to the pet without a request in the address: the one that was acted on has moved on.
    router.replace(adminResolvePath(pet.id));
    router.refresh();
  }

  return (
    <>
      <form onSubmit={review} noValidate className="flex flex-col gap-5">
        {problem && (
          <Alert tone="error" announce>
            {problem}
          </Alert>
        )}

        {nothingApplies && (
          <Alert tone="info" title={`Nothing to resolve for ${pet.name} right now`}>
            None of the four actions applies to where {pet.name} and its requests stand. Each one says why below.
          </Alert>
        )}

        {requests.length > 0 ? (
          <Field label="Related request" hint={`The request of ${pet.name} this change is about.`}>
            <Select
              value={requestId === null ? NO_REQUEST : String(requestId)}
              onChange={(event) => chooseRequest(event.currentTarget.value)}
              options={[{ value: NO_REQUEST, label: "No request chosen" }, ...requests.map((request) => ({ value: String(request.id), label: requestLabel(request) }))]}
            />
          </Field>
        ) : (
          <p className="text-sm text-ink-muted">{pet.name} hasn’t sent a request yet.</p>
        )}

        <RadioCards
          legend="Action"
          required
          error={errors.action}
          value={chosen?.action ?? ""}
          onChange={(value) => {
            setAction(value as ResolutionAction);
            setErrors((current) => ({ ...current, action: undefined }));
          }}
          options={choices.map((choice) => ({ value: choice.action, label: choice.label, description: choice.description, disabled: !choice.enabled }))}
        />

        <Field label="Reason" required error={errors.reason} hint="Both accounts read this in their Alerts, and it is kept in the activity log with your name.">
          <Textarea
            value={reason}
            onChange={(event) => {
              setReason(event.currentTarget.value);
              if (errors.reason) setErrors((current) => ({ ...current, reason: undefined }));
            }}
            rows={3}
            maxLength={RESOLVE_REASON_MAX}
            placeholder="e.g. The Furparent returned the pet on Sep 20 because of a severe allergy."
          />
        </Field>

        <Button type="submit" variant="primary" className="self-start" loading={busy} loadingLabel="Checking what this changes" disabled={nothingApplies}>
          Review change
        </Button>
      </form>

      {input && (
        <ConfirmResolutionDialog
          change={change}
          petId={pet.id}
          input={input}
          reason={reason.trim()}
          onClose={() => setChange(null)}
          onApplied={applied}
          onRefused={refused}
          onInvalid={invalid}
        />
      )}
    </>
  );
}
