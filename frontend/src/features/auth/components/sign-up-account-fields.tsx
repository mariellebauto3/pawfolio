"use client";

import { Field } from "@/components/forms/field";
import { Input } from "@/components/forms/input";
import type { FieldErrors } from "@/lib/api/errors";
import { SIGN_UP_TEXT_LIMITS } from "@/lib/auth/sign-up-rules";
import type { TextFieldProps } from "../hooks/use-form-fields";
import { NewPasswordGuide } from "./new-password-guide";
import { PasswordInput } from "./password-input";

type Props = {
  email: TextFieldProps;
  password: TextFieldProps;
  confirmation: TextFieldProps;
  errors: FieldErrors;
  emailPlaceholder: string;
  emailHint?: string;
};

const GUIDE_ID = "sign-up-password-guide";

// Step 1 of both wizards (AU-08, AU-13): the login. The password rules tick off as they are met (SEC-AUTH-03).
export function SignUpAccountFields({ email, password, confirmation, errors, emailPlaceholder, emailHint }: Props) {
  return (
    <>
      <Field label="Email" error={errors.email} hint={emailHint}>
        <Input
          {...email}
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={SIGN_UP_TEXT_LIMITS.email}
          placeholder={emailPlaceholder}
        />
      </Field>
      <div className="flex flex-col gap-3">
        <Field label="Password" error={errors.password}>
          <PasswordInput {...password} autoComplete="new-password" aria-describedby={GUIDE_ID} />
        </Field>
        <NewPasswordGuide id={GUIDE_ID} password={password.value} />
      </div>
      <Field label="Confirm password" error={errors.password_confirmation}>
        <PasswordInput {...confirmation} autoComplete="new-password" />
      </Field>
    </>
  );
}
