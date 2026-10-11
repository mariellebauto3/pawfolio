"use client";

import { useState } from "react";
import { Checkbox } from "@/components/forms/checkbox";
import { ChoiceChips } from "@/components/forms/choice-chips";
import { Field } from "@/components/forms/field";
import { FileUpload } from "@/components/forms/file-upload";
import { Input } from "@/components/forms/input";
import { Select } from "@/components/forms/select";
import { Wizard } from "@/components/forms/wizard";
import { Button } from "@/components/ui/button";

// Dev-only demo for /ui-kit: the pet sign-up wizard shape (AU-07…AU-12) with fake data and no network calls.

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Errors = { email?: string; password?: string; name?: string };

const FIELD_NAMES: Record<keyof Errors, string> = { email: "email", password: "password", name: "pet-name" };

export function WizardDemo() {
  const [errors, setErrors] = useState<Errors>({});
  const [draftStatus, setDraftStatus] = useState("");
  const [done, setDone] = useState(false);
  const [run, setRun] = useState(0);

  function validate(step: number, form: HTMLFormElement): boolean {
    const data = new FormData(form);
    const next: Errors = {};
    if (step === 0) {
      const email = String(data.get("email") ?? "").trim();
      const password = String(data.get("password") ?? "");
      if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter an email address like you@email.com.";
      if (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
        next.password = "Use at least 8 characters with a letter and a number.";
      }
    }
    if (step === 1 && !String(data.get("pet-name") ?? "").trim()) next.name = "Enter your pet's name.";
    setErrors(next);
    // Focus the first field with an error so its message is read out.
    const first = (Object.keys(next) as Array<keyof Errors>)[0];
    if (first) form.querySelector<HTMLElement>(`[name="${FIELD_NAMES[first]}"]`)?.focus();
    return !first;
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="status" className="rounded-card bg-success-soft px-4 py-3 text-success-soft-ink">
          Submitted for review. In the app, the account would now be Pending Verification.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setDone(false);
            setDraftStatus("");
            setRun((r) => r + 1);
          }}
        >
          Start the demo again
        </Button>
      </div>
    );
  }

  return (
    <Wizard
      key={run}
      finishLabel="Submit for review"
      draftStatus={draftStatus}
      onNext={(step, form) => validate(step, form)}
      onSaveDraft={async () => {
        await wait(800);
        const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        setDraftStatus(`Draft saved at ${time}`);
      }}
      onFinish={async () => {
        await wait(1000);
        setDone(true);
      }}
      steps={[
        {
          label: "Account",
          content: (
            <>
              <Field label="Email" error={errors.email}>
                <Input name="email" type="email" autoComplete="email" placeholder="you@email.com" />
              </Field>
              <Field label="Password" error={errors.password} hint="At least 8 characters with a letter and a number.">
                <Input name="password" type="password" autoComplete="new-password" />
              </Field>
            </>
          ),
        },
        {
          label: "Details",
          content: (
            <>
              <Field label="Pet name" error={errors.name}>
                <Input name="pet-name" autoComplete="off" />
              </Field>
              <Field label="Species">
                <Select name="species" placeholder="Choose a species" options={["Dog", "Cat", "Other"]} />
              </Field>
              <ChoiceChips name="energy" legend="Energy level" options={["Relaxed", "Moderate", "Active"]} />
            </>
          ),
        },
        {
          label: "Photo",
          content: (
            <FileUpload
              name="photos"
              label="Photos of your pet"
              accept={["jpg", "png"]}
              multiple
              hint="JPG or PNG, up to 5 MB each. Up to 5 photos. The first one is the main photo."
            />
          ),
        },
        {
          label: "ID",
          content: (
            <FileUpload
              name="caretaker-id"
              label="Caretaker's valid ID"
              hint="JPG, PNG or PDF, up to 5 MB. Only admins can see it."
            />
          ),
        },
        {
          label: "Review",
          content: (
            <>
              <p className="max-w-[65ch] text-ink-muted">
                An admin checks every new account before it can send or receive requests. This usually takes a day or
                two.
              </p>
              <Checkbox name="terms" label="I agree to the Terms and Community Guidelines" />
            </>
          ),
        },
      ]}
    />
  );
}
