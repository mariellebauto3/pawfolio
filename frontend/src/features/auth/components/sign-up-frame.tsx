import Link from "next/link";
import type { ReactNode } from "react";
import { Alert } from "@/components/feedback/alert";
import { ROUTES } from "@/constants/routes";

type Props = {
  title: string;
  /** A problem that isn't about one field, shown above the wizard and read out. */
  problem?: string | null;
  children: ReactNode;
};

// The card a sign-up wizard sits in (AU-08…AU-17, LoFi "container narrow"): the page's h1, the way back to sign in,
// then the wizard.
export function SignUpFrame({ title, problem, children }: Props) {
  return (
    <div className="mx-auto w-full max-w-narrow px-gutter py-8 md:py-12">
      <div className="flex flex-col gap-6 rounded-dialog border border-line bg-surface p-5 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h1 className="text-3xl">{title}</h1>
          <p className="text-sm text-ink-muted">
            Have an account?{" "}
            <Link href={ROUTES.signIn} className="font-bold text-primary underline hover:text-primary-hover">
              Sign in
            </Link>
          </p>
        </div>
        {problem && (
          <Alert tone="error" announce>
            {problem}
          </Alert>
        )}
        {children}
      </div>
    </div>
  );
}
