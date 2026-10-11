"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { useSession } from "@/providers/session-provider";
import { useToast } from "@/providers/toast-provider";
import { updateSubmission } from "../api/account-status";
import { placeFieldErrors } from "../schemas/sign-up-schemas";
import { useFormFields } from "./use-form-fields";

const SAVED = "Details saved. Your account is back in the review queue.";
const UNKNOWN_PROBLEM = "We couldn't save your details. Please try again.";

type Options<V> = {
  /** The form filled with what was submitted. Must be the same object on every render. */
  initial: V;
  /** The API fields the form shows, to place a 422's errors. */
  fields: readonly string[];
  validate: (values: V) => FieldErrors;
  toForm: (values: V) => FormData;
};

// State for "Edit submitted details" (AU-19): the typed values and inline errors (useFormFields), and the save. On
// success the account is Pending Verification again and returns to the status screen (AU-18) with a toast.
export function useSubmissionForm<V extends object>({ initial, fields, validate, toForm }: Options<V>) {
  const router = useRouter();
  const session = useSession();
  const toast = useToast();
  const { values, errors, setErrors, set, text, markSaved, isSaved } = useFormFields(initial, validate);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const form = useRef<HTMLFormElement | null>(null);
  const focusInvalid = useRef(false);

  // After a failed check, put focus on the first field with an error so its message is read out.
  useEffect(() => {
    if (!focusInvalid.current) return;
    focusInvalid.current = false;
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  function showErrors(found: FieldErrors) {
    setErrors(found);
    focusInvalid.current = true;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (saving || isSaved()) return;
    form.current = event.currentTarget;
    setProblem(null);

    const found = validate(values);
    if (Object.keys(found).length) return showErrors(found);

    setSaving(true);
    try {
      await updateSubmission(api, toForm(values));
      markSaved();
      // The account is Pending Verification again; the status screen reads it fresh from the API.
      await session.refresh();
      toast.show(SAVED);
      router.replace(ROUTES.accountStatus);
    } catch (failure) {
      setSaving(false);
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      if (failure.kind !== "validation") return setProblem(failure.message);
      const placed = placeFieldErrors([fields], failure.fieldErrors);
      if (placed.firstStep === null) return setProblem(placed.unplaced[0] ?? UNKNOWN_PROBLEM);
      showErrors(placed.errors);
    }
  }

  return {
    values,
    errors,
    /** A problem that isn't about one field: the server is unreachable, the account can no longer be edited. */
    problem,
    set,
    text,
    formProps: { onSubmit, saving },
  };
}
