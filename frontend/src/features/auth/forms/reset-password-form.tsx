"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/toast-provider";
import { resetPassword } from "../api/auth";
import { AuthCard } from "../components/auth-card";
import { NewPasswordGuide } from "../components/new-password-guide";
import { PasswordInput } from "../components/password-input";
import { type ResetLink, parseResetLink, validateNewPassword } from "../schemas/auth-schemas";

type LinkState = { status: "reading" } | { status: "missing" } | { status: "ready"; link: ResetLink };

const GUIDE_ID = "new-password-guide";

// AU-06 Set a new password, opened from the emailed link `/reset-password#token=…&email=…` (docs/api/auth.md). The
// token and email are read once into memory and the "#…" is removed from the address bar, so they don't stay in
// history or get copied along with the URL (SEC-FE-04). On success: sign in, with a "Password reset" toast.
export function ResetPasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const [linkState, setLinkState] = useState<LinkState>({ status: "reading" });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [linkExpired, setLinkExpired] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);
  // undefined until read. Kept in a ref because the "#…" is gone after the first read and Strict Mode runs effects twice.
  const readLink = useRef<ResetLink | null | undefined>(undefined);

  // The "#" part only exists in the browser, so it's read after the first render.
  useEffect(() => {
    const show = (link: ResetLink | null) => setLinkState(link ? { status: "ready", link } : { status: "missing" });
    if (readLink.current === undefined) readLink.current = parseResetLink(window.location.hash);
    const link = readLink.current;
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname);
    const timer = window.setTimeout(() => show(link), 0);

    // A link pasted into this same tab only changes the "#…", which doesn't load the page again.
    function onHashChange() {
      const pasted = parseResetLink(window.location.hash);
      if (!pasted) return;
      window.history.replaceState(window.history.state, "", window.location.pathname);
      readLink.current = pasted;
      setLinkExpired(false);
      setErrors({});
      setProblem(null);
      show(pasted);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (linkState.status !== "ready" || pending) return;
    const found = validateNewPassword({ password, confirmation });
    setErrors(found);
    if (found.password) return passwordInput.current?.focus();
    if (found.password_confirmation) return confirmationInput.current?.focus();

    setPending(true);
    setProblem(null);
    try {
      await resetPassword(api, {
        token: linkState.link.token,
        email: linkState.link.email,
        password,
        password_confirmation: confirmation,
      });
      toast.show("Password reset. Sign in with your new password.");
      router.replace(ROUTES.signIn);
    } catch (failure) {
      setPending(false);
      if (isApiError(failure) && failure.kind === "validation") {
        if (failure.fieldErrors.token) return setLinkExpired(true);
        setErrors(failure.fieldErrors);
        return passwordInput.current?.focus();
      }
      setProblem(isApiError(failure) ? failure.message : "Something went wrong. Please try again.");
    }
  }

  if (linkState.status === "reading") {
    return (
      <AuthCard title="Set a new password">
        <SkeletonGroup label="Opening your reset link" className="flex flex-col gap-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </SkeletonGroup>
      </AuthCard>
    );
  }

  if (linkState.status === "missing" || linkExpired) {
    return (
      <AuthCard
        title={linkExpired ? "This link has expired" : "This link is incomplete"}
        description={
          linkExpired
            ? "Reset links work once and expire after 30 minutes. Ask for a new one and use it from your email."
            : "Open the link from your reset email again, or ask for a new one."
        }
        footer={
          <Link href={ROUTES.signIn} className="font-bold text-primary underline hover:text-primary-hover">
            Back to sign in
          </Link>
        }
      >
        <Link href={ROUTES.forgotPassword} className={buttonClasses({ variant: "primary", block: true })}>
          Ask for a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set a new password"
      description={
        <>
          For <strong className="break-all text-ink">{linkState.link.email}</strong>. You&apos;ll sign in with it next.
        </>
      }
    >
      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {/* For password managers: which account this new password belongs to. */}
        <input type="email" name="email" autoComplete="username" value={linkState.link.email} readOnly hidden />
        <div className="flex flex-col gap-3">
          <Field label="New password" error={errors.password}>
            <PasswordInput
              ref={passwordInput}
              name="password"
              autoComplete="new-password"
              aria-describedby={GUIDE_ID}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <NewPasswordGuide id={GUIDE_ID} password={password} />
        </div>
        <Field label="Confirm new password" error={errors.password_confirmation}>
          <PasswordInput
            ref={confirmationInput}
            name="password_confirmation"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" block loading={pending} loadingLabel="Saving your new password">
          Save new password
        </Button>
      </form>
    </AuthCard>
  );
}
