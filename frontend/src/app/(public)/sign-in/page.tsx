import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NEXT_PATH_PARAM } from "@/constants/routes";
import { SignInForm } from "@/features/auth/forms/sign-in-form";
import { afterSignInPath } from "@/lib/auth/redirects";
import { renderAccount } from "@/lib/auth/render-account";

export const metadata: Metadata = { title: "Sign in" };

// AU-02 / AU-03. Someone already signed in goes straight to where signing in would take them.
export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const raw = (await searchParams)[NEXT_PATH_PARAM];
  const next = typeof raw === "string" ? raw : null;

  const lookup = await renderAccount();
  if (lookup.ok && lookup.account) redirect(afterSignInPath(lookup.account, next));

  return <SignInForm next={next} />;
}
