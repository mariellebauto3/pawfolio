import type { Metadata } from "next";
import { PetSignUpWizard } from "@/features/auth/forms/pet-sign-up-wizard";
import { redirectSignedInAccount } from "@/lib/auth/guest-only";

export const metadata: Metadata = { title: "Sign up a pet" };

// AU-08…AU-12 Pet sign-up, five steps on one URL.
export default async function PetSignUpPage() {
  await redirectSignedInAccount();
  return <PetSignUpWizard />;
}
