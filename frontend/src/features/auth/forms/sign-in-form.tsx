"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Checkbox } from "@/components/forms/checkbox";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/forms/input";
import { Button } from "@/components/ui/button";
import { HELP_CENTER_PATH, ROUTES } from "@/constants/routes";
import { api } from "@/lib/api/client";
import type { FieldErrors } from "@/lib/api/errors";
import { isApiError } from "@/lib/api/errors";
import { afterSignInPath } from "@/lib/auth/redirects";
import { useSession } from "@/providers/session-provider";
import { signIn } from "../api/auth";
import { AuthCard } from "../components/auth-card";
import { PasswordInput } from "@/components/forms/password-input";
import { validateSignIn } from "../schemas/auth-schemas";

const CLOSED_MESSAGE = "This account was closed.";

type Problem =
  | { kind: "mismatch" }
  | { kind: "closed" }
  | { kind: "locked"; until: number }
  | { kind: "other"; message: string };

type Props = {
  /** The page to return to after signing in (`?next=`); checked with safeNextPath before use (SEC-FE-07). */
  next: string | null;
};

// AU-02 Sign in and AU-03 its errors. One page for pets, humans and admins; the server decides where each lands
// (FR2, FR19). A wrong password keeps the typed email and clears the password; a lockout counts down (SEC-AUTH-04).
export function SignInForm({ next }: Props) {
  const router = useRouter();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);

  const lockedFor = problem?.kind === "locked" ? Math.max(0, problem.until - now) : 0;

  // Tick once a second while locked, so the countdown and the button follow the clock.
  useEffect(() => {
    if (problem?.kind !== "locked") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [problem]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || lockedFor > 0) return;
    const found = validateSignIn({ email, password });
    setErrors(found);
    if (found.email) return emailInput.current?.focus();
    if (found.password) return passwordInput.current?.focus();

    setPending(true);
    setProblem(null);
    try {
      const account = await signIn(api, { email, password, remember });
      await session.refresh();
      router.replace(afterSignInPath(account, next));
      // Stays "pending" while the next page loads.
    } catch (error) {
      setPending(false);
      setPassword("");
      if (!isApiError(error)) return setProblem({ kind: "other", message: "Something went wrong. Please try again." });
      if (error.kind === "rate_limited") {
        const seconds = error.retryAfterSeconds ?? 15 * 60;
        setNow(Date.now());
        return setProblem({ kind: "locked", until: Date.now() + seconds * 1000 });
      }
      if (error.kind === "validation" && error.fieldErrors.email) {
        setProblem({ kind: error.fieldErrors.email === CLOSED_MESSAGE ? "closed" : "mismatch" });
        return passwordInput.current?.focus();
      }
      if (error.kind === "validation") return setErrors(error.fieldErrors);
      setProblem({ kind: "other", message: error.message });
    }
  }

  return (
    <AuthCard
      title="Sign in"
      description="Welcome back! Sign in to your Pawfolio account."
      footer={
        <>
          New to Pawfolio?{" "}
          <Link href={ROUTES.signUp} className="font-bold text-primary underline hover:text-primary-hover">
            Join now
          </Link>
        </>
      }
    >
      {problem && <SignInProblem problem={problem} lockedFor={lockedFor} />}

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label="Email" error={errors.email}>
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
        <Field label="Password" error={errors.password}>
          <PasswordInput
            ref={passwordInput}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Checkbox label="Keep me signed in" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <Link href={ROUTES.forgotPassword} className="flex min-h-11 items-center text-sm font-bold text-primary underline hover:text-primary-hover">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="primary" block loading={pending} loadingLabel="Signing in" disabled={lockedFor > 0}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}

function SignInProblem({ problem, lockedFor }: { problem: Problem; lockedFor: number }) {
  if (problem.kind === "mismatch") {
    return (
      <Alert tone="error" announce title="That email and password don't match.">
        Try again or{" "}
        <Link href={ROUTES.forgotPassword} className="font-bold underline">
          reset your password
        </Link>
        . After 5 failed tries, sign-in is paused for 15 minutes.
      </Alert>
    );
  }
  if (problem.kind === "closed") {
    return (
      <Alert tone="error" announce title={CLOSED_MESSAGE}>
        Deactivated accounts can&apos;t sign in. Questions? Visit the{" "}
        <Link href={HELP_CENTER_PATH} className="font-bold underline">
          Help center
        </Link>
        .
      </Alert>
    );
  }
  if (problem.kind === "locked") {
    const minutes = Math.ceil(lockedFor / 60000);
    return (
      <Alert tone="warning" announce title="Sign-in is paused">
        {lockedFor > 0 ? (
          <>
            Too many failed attempts. You can try again in {minutes} {minutes === 1 ? "minute" : "minutes"}, or{" "}
            <Link href={ROUTES.forgotPassword} className="font-bold underline">
              reset your password
            </Link>
            .
          </>
        ) : (
          "You can try signing in again now."
        )}
      </Alert>
    );
  }
  return (
    <Alert tone="error" announce>
      {problem.message}
    </Alert>
  );
}
