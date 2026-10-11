"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { Alert } from "@/components/feedback/alert";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";

type Props = {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  /** A problem that isn't about one field, shown above the buttons and read out. */
  problem?: string | null;
  /** The form's sections, each a Card. */
  children: ReactNode;
};

// The form around "Edit submitted details" (AU-19): the sections, then Cancel on the left and the one primary
// action on the right. The browser's own validation is off; the fields show their errors inline.
export function SubmissionFormFrame({ onSubmit, saving, problem, children }: Props) {
  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {children}
      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={ROUTES.accountStatus} className={buttonClasses({ variant: "secondary" })}>
          Cancel
        </Link>
        <Button type="submit" variant="primary" loading={saving} loadingLabel="Saving your details">
          Save and resubmit
        </Button>
      </div>
    </form>
  );
}
