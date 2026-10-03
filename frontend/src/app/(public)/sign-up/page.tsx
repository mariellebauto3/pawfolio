import type { Metadata } from "next";
import { AccountTypeChoice } from "@/features/auth/components/account-type-choice";
import { redirectSignedInAccount } from "@/lib/auth/guest-only";

export const metadata: Metadata = { title: "Join Pawfolio" };

// AU-07 Join · choose account type.
export default async function SignUpPage() {
  await redirectSignedInAccount();
  return <AccountTypeChoice />;
}
