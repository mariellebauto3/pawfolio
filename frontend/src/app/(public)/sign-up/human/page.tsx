import type { Metadata } from "next";
import { HumanSignUpWizard } from "@/features/auth/forms/human-sign-up-wizard";
import { redirectSignedInAccount } from "@/lib/auth/guest-only";

export const metadata: Metadata = { title: "Sign up to adopt" };

// AU-13…AU-17 Human sign-up, five steps on one URL.
export default async function HumanSignUpPage() {
  await redirectSignedInAccount();
  return <HumanSignUpWizard />;
}
