"use client";

import type { ReactNode } from "react";
import { Checkbox } from "@/components/forms/checkbox";
import { Button } from "@/components/ui/button";

export type ReviewSection = {
  title: string;
  /** The wizard step these details were entered on (zero-based), opened by "Edit". */
  step: number;
  rows: { label: string; value: ReactNode }[];
};

type Props = {
  sections: ReviewSection[];
  onEdit: (step: number) => void;
  termsAccepted: boolean;
  onTermsChange: (accepted: boolean) => void;
  termsError?: string;
};

// Step 5 of both wizards (AU-12, AU-17): what was entered, an Edit button per step, and the agreement. Passwords and
// file contents are never shown; a file appears by its name.
export function SignUpReview({ sections, onEdit, termsAccepted, onTermsChange, termsError }: Props) {
  return (
    <>
      <p className="max-w-[65ch] text-ink-muted">
        Check your details before you submit. An admin reviews every new account, which usually takes 1 to 2 days. Until
        then the account is Pending Verification.
      </p>
      <div className="flex flex-col gap-3">
        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-2 rounded-card border border-line p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg">{section.title}</h3>
              <Button variant="tertiary" size="sm" onClick={() => onEdit(section.step)} aria-label={`Edit ${section.title.toLowerCase()}`}>
                Edit
              </Button>
            </div>
            <dl className="grid gap-x-6 gap-y-2 md:grid-cols-[10rem_1fr]">
              {section.rows.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="text-sm text-ink-muted md:pt-0.5">{row.label}</dt>
                  <dd className="-mt-1.5 break-words md:mt-0">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <Checkbox
        name="terms_accepted"
        label="I confirm the details are true and I agree to the Terms and Community Guidelines."
        description="Verification documents are visible to admins only."
        checked={termsAccepted}
        onChange={(event) => onTermsChange(event.target.checked)}
        error={termsError}
      />
    </>
  );
}
