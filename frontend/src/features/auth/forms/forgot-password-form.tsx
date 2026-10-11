"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/forms/input";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/toast-provider";
import { requestPasswordReset } from "../api/auth";
import { AuthCard } from "../components/auth-card";
import { emailProblem } from "../schemas/auth-schemas";

/** The API won't send a new link within a minute of the last one (password broker throttle), so neither do we. */
const RESEND_COOLDOWN_SECONDS = 60;

const BACK_LINK = "flex min-h-11 items-center justify-center text-sm font-bold text-primary underline hover:text-primary-hover";

// AU-04 Forgot password and AU-05 Reset link sent. The confirmation reads the same whether the account exists
// (SEC-AUTH-05). The email lives in this component's state only, never in the URL (SEC-FE-04).
export function ForgotPasswordForm() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const emailInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const cooldown = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  // Moving to the confirmation, focus its heading so screen readers hear it.
  useEffect(() => {
    if (sentTo) heading.current?.focus();
  }, [sentTo]);

  async function send(address: string): Promise<boolean> {
    setPending(true);
    setProblem(null);
    try {
      await requestPasswordReset(api, address.trim());
      setNow(Date.now());
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      return true;
    } catch (failure) {
      if (isApiError(failure) && failure.kind === "validation" && failure.fieldErrors.email) {
        setError(failure.fieldErrors.email);
      } else {
        setProblem(isApiError(failure) ? failure.message : "Something went wrong. Please try again.");
      }
      return false;
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = emailProblem(email);
    setError(found);
    if (found) return emailInput.current?.focus();
    if (await send(email)) setSentTo(email.trim());
  }

  async function onResend() {
    if (sentTo && cooldown === 0 && (await send(sentTo))) toast.show("We sent the link again.");
  }

  if (sentTo) {
    return (
      <AuthCard
        headingRef={heading}
        icon="mail"
        title="Check your email"
        description={
          <>
            If an account exists for <strong className="break-all text-ink">{sentTo}</strong>, we sent a link to reset
            the password. The link expires in 30 minutes.
          </>
        }
        footer={
          <Link href={ROUTES.signIn} className={BACK_LINK}>
            Back to sign in
          </Link>
        }
      >
        {problem && (
          <Alert tone="error" announce>
            {problem}
          </Alert>
        )}
        <div className="flex flex-col gap-2 rounded-card bg-surface-sunken p-4 text-sm text-ink-muted">
          <p>Didn&apos;t get it? Check your spam folder, or send it again.</p>
          <Button variant="secondary" onClick={onResend} loading={pending} loadingLabel="Sending" disabled={cooldown > 0}>
            {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend email"}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter the email you signed up with and we'll send you a link to set a new one."
      footer={
        <Link href={ROUTES.signIn} className={BACK_LINK}>
          Back to sign in
        </Link>
      }
    >
      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label="Email" error={error}>
          <Input
            ref={emailInput}
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            placeholder="you@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" block loading={pending} loadingLabel="Sending reset link">
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
