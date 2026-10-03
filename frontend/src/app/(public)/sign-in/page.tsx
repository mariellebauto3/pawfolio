import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NEXT_PATH_PARAM } from "@/constants/routes";
import { SignInForm } from "@/features/auth/forms/sign-in-form";
import { lookUpAccount } from "@/lib/auth/lookup-account";
import { afterSignInPath } from "@/lib/auth/redirects";

export const metadata: Metadata = { title: "Sign in" };

// AU-02 / AU-03. Someone already signed in goes straight to where signing in would take them.
export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const raw = (await searchParams)[NEXT_PATH_PARAM];
  const next = typeof raw === "string" ? raw : null;

  const account = await lookUpAccount((await cookies()).toString() || null);
  if (account) redirect(afterSignInPath(account, next));

  return <SignInForm next={next} />;
}
