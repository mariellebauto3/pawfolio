"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { type FieldErrors, isApiError } from "@/lib/api/errors";

// One change to a Meet & Greet or a slot, sent from a form or a dialog: busy while it runs, and what went wrong in
// words to show beside the button. A 409 means the page behind is out of date (the slot was just booked, the
// meeting was already cancelled), so the page is read again while the message is shown.
export function useMeetChange(unknownProblem: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /**
   * Runs the call and says whether it went through. It stays busy after a success, since what sent it is about to
   * close or be replaced; `settle` ends that for a form that stays. A 422 goes to `onInvalid` when there is one.
   */
  async function run(change: () => Promise<unknown>, onInvalid?: (errors: FieldErrors, message: string) => void): Promise<boolean> {
    if (busy) return false;
    setProblem(null);
    setBusy(true);
    try {
      await change();
      return true;
    } catch (failure) {
      setBusy(false);
      if (!isApiError(failure)) {
        setProblem(unknownProblem);
      } else if (failure.kind === "validation" && onInvalid) {
        onInvalid(failure.fieldErrors, failure.message);
      } else {
        if (failure.kind === "conflict") router.refresh();
        setProblem(failure.kind === "not_found" ? "This request isn’t available any more." : failure.message);
      }
      return false;
    }
  }

  return { busy, problem, setProblem, run, settle: () => setBusy(false) };
}
